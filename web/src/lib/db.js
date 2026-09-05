import { PAPER_FIELDS, TOMBSTONE_MAX_AGE_DAYS } from './constants';

const DB_NAME = 'tribulator';
// v2 added the sync bookkeeping (uid / createdAt / updatedAt / deletedAt /
// fieldTimes) that multi-device merging needs. Records written by v1 are
// backfilled once, during the upgrade.
const DB_VERSION = 2;
const STORE_NAME = 'papers';

// Stands in for "as old as possible" when a record predates timestamps.
const EPOCH = '1970-01-01T00:00:00.000Z';

export function newUid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // randomUUID needs a secure context; this keeps non-https dev usable.
  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function migrateToV2(store) {
  store.openCursor().onsuccess = e => {
    const cursor = e.target.result;
    if (!cursor) return;
    const record = cursor.value;
    let changed = false;
    if (!record.uid) { record.uid = newUid(); changed = true; }
    // dateEntered is the closest thing v1 had to a write time.
    if (!record.createdAt) { record.createdAt = record.dateEntered || EPOCH; changed = true; }
    if (!record.updatedAt) { record.updatedAt = record.createdAt; changed = true; }
    if (record.deletedAt === undefined) { record.deletedAt = null; changed = true; }
    if (!record.fieldTimes) { record.fieldTimes = {}; changed = true; }
    if (changed) cursor.update(record);
    cursor.continue();
  };
}

// One shared connection for the whole session. Opening a fresh connection per
// call — and never closing it — would leave connections outstanding that block
// the version upgrade, and a blocked upgrade hangs with no error at all.
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = event => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        return;
      }
      if (event.oldVersion < 2) migrateToV2(req.transaction.objectStore(STORE_NAME));
    };

    // Another tab is holding the old version open, so the upgrade can't run.
    req.onblocked = () => {
      dbPromise = null;
      reject(new Error('Tribulator is open in another tab — close it and reload to finish upgrading.'));
    };

    req.onsuccess = () => {
      const db = req.result;
      // Step aside when another tab needs to upgrade, rather than blocking it.
      db.onversionchange = () => { db.close(); dbPromise = null; };
      db.onclose = () => { dbPromise = null; };
      resolve(db);
    };

    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Mutation listeners let the sync layer schedule a push without db.js having
// to import it (which would be circular).
const mutationListeners = new Set();

export function onMutation(listener) {
  mutationListeners.add(listener);
  return () => mutationListeners.delete(listener);
}

function notifyMutation() {
  mutationListeners.forEach(l => {
    try { l(); } catch { /* a listener must never break a write */ }
  });
}

function sameValue(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

// Stamps sync bookkeeping onto a record about to be written. A brand new record
// gets no per-field times — merging falls back to updatedAt for those, which
// keeps the common record small. An edit records the time of only the fields
// that actually changed, so a concurrent edit to a different field survives.
export function stampRecord(next, previous, now = new Date().toISOString()) {
  if (!previous) {
    return {
      ...next,
      uid: next.uid || newUid(),
      createdAt: next.createdAt || now,
      updatedAt: next.updatedAt || now,
      deletedAt: next.deletedAt ?? null,
      fieldTimes: next.fieldTimes || {},
    };
  }

  const fieldTimes = { ...(previous.fieldTimes || {}) };
  let changed = false;
  for (const field of PAPER_FIELDS) {
    if (!sameValue(next[field], previous[field])) {
      fieldTimes[field] = now;
      changed = true;
    }
  }
  const deletedChanged = !sameValue(next.deletedAt ?? null, previous.deletedAt ?? null);

  return {
    ...next,
    uid: next.uid || previous.uid || newUid(),
    createdAt: previous.createdAt || now,
    updatedAt: changed || deletedChanged ? now : previous.updatedAt || now,
    deletedAt: next.deletedAt ?? null,
    fieldTimes,
  };
}

async function getRecord(store, id) {
  return reqToPromise(store.get(id));
}

// Every record, tombstones included — what the sync layer needs to see.
export async function getAllRecords() {
  const db = await openDb();
  return reqToPromise(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll());
}

// The live library, which is what every screen wants.
export async function getAllPapers() {
  const all = await getAllRecords();
  return all.filter(p => !p.deletedAt);
}

export async function addPaper(paper) {
  const db = await openDb();
  const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
  const id = await reqToPromise(store.add(stampRecord(paper, null)));
  notifyMutation();
  return id;
}

export async function putPaper(paper) {
  const db = await openDb();
  const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
  const previous = paper.id != null ? await getRecord(store, paper.id) : null;
  const result = await reqToPromise(store.put(stampRecord(paper, previous)));
  notifyMutation();
  return result;
}

// Soft delete: the record stays as a tombstone so other devices learn about
// the deletion instead of re-adding the paper on the next merge.
export async function deletePaper(id) {
  const db = await openDb();
  const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
  const existing = await getRecord(store, id);
  if (!existing) return;
  await reqToPromise(store.put(stampRecord({ ...existing, deletedAt: new Date().toISOString() }, existing)));
  notifyMutation();
}

// Replaces the whole store with the merged result of a sync. Records carrying
// an `id` update in place; the rest are new arrivals from another device.
export async function applyMergedRecords(records) {
  const db = await openDb();
  const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
  for (const record of records) {
    if (record.id != null) await reqToPromise(store.put(record));
    else await reqToPromise(store.add(record));
  }
}

// Drops tombstones old enough that every device has certainly merged them.
export async function purgeExpiredTombstones(maxAgeDays = TOMBSTONE_MAX_AGE_DAYS) {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const db = await openDb();
  const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
  const all = await reqToPromise(store.getAll());
  let purged = 0;
  for (const record of all) {
    if (record.deletedAt && new Date(record.deletedAt).getTime() < cutoff) {
      await reqToPromise(store.delete(record.id));
      purged++;
    }
  }
  return purged;
}

export async function clearAllPapers() {
  const db = await openDb();
  await reqToPromise(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear());
  notifyMutation();
}

export function pubmedIdFromUrl(url) {
  const m = /pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/.exec(url || '');
  return m ? m[1] : null;
}

// Papers are matched by PubMed ID when present (extracted from the stored
// PubMed URL), falling back to an exact Reference string match — covers both
// freshly-saved papers and records merged in from legacy spreadsheet exports
// that never had a PubMed URL.
export function paperDedupeKey(paper) {
  const pmid = pubmedIdFromUrl(paper.url);
  return pmid ? `pmid:${pmid}` : `ref:${(paper.reference || '').trim().toLowerCase()}`;
}

export function findMatchingPaper(papers, candidate) {
  const key = paperDedupeKey(candidate);
  return papers.find(p => paperDedupeKey(p) === key) || null;
}
