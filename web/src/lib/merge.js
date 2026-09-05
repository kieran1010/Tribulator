import { PAPER_FIELDS, SYNC_FIELDS } from './constants';
import { paperDedupeKey } from './db';

const EPOCH = '1970-01-01T00:00:00.000Z';

// When a field was last written. A field with no recorded edit has held its
// value since the record was created, so it falls back to createdAt — never to
// updatedAt, which would let an edit to one field silently outrank a real edit
// to a different field on another device.
function fieldTime(record, field) {
  return record.fieldTimes?.[field] || record.createdAt || record.updatedAt || EPOCH;
}

function earlier(a, b) {
  if (!a) return b || EPOCH;
  if (!b) return a;
  return a < b ? a : b;
}

function later(a, b) {
  if (!a) return b || EPOCH;
  if (!b) return a;
  return a > b ? a : b;
}

// Every tie-break here has to reach the same answer on both devices, otherwise
// the two copies never converge and each sync flips the value back. Comparing
// the serialised values is arbitrary but identical everywhere.
function pickTied(valueA, valueB) {
  const a = JSON.stringify(valueA ?? null);
  const b = JSON.stringify(valueB ?? null);
  return a >= b ? valueA : valueB;
}

// Merges two versions of the same paper field by field, each field going to
// whichever side wrote it last. An edit on one device therefore survives a
// simultaneous edit to a different field on another.
export function mergeRecords(a, b) {
  const merged = {};

  for (const field of PAPER_FIELDS) {
    const timeA = fieldTime(a, field);
    const timeB = fieldTime(b, field);
    if (timeA > timeB) merged[field] = a[field];
    else if (timeB > timeA) merged[field] = b[field];
    else merged[field] = pickTied(a[field], b[field]);
  }

  const fieldTimes = {};
  for (const field of PAPER_FIELDS) {
    const time = later(a.fieldTimes?.[field], b.fieldTimes?.[field]);
    if (time && time !== EPOCH) fieldTimes[field] = time;
  }

  // Deletion is a record-level fact, so it follows the record's own write time:
  // a later edit on the other device resurrects the paper, which is what the
  // user who made that edit most recently intended.
  const updatedA = a.updatedAt || EPOCH;
  const updatedB = b.updatedAt || EPOCH;
  let deletedAt;
  if (updatedA > updatedB) deletedAt = a.deletedAt ?? null;
  else if (updatedB > updatedA) deletedAt = b.deletedAt ?? null;
  else deletedAt = (a.deletedAt ?? null) || (b.deletedAt ?? null);

  return {
    ...merged,
    // Two devices that each migrated the same legacy paper invented different
    // uids for it. Collapsing to the smaller one is deterministic, so both
    // devices settle on the same identity rather than swapping every sync.
    uid: earlier(a.uid, b.uid),
    createdAt: earlier(a.createdAt, b.createdAt),
    updatedAt: later(updatedA, updatedB),
    deletedAt,
    fieldTimes,
  };
}

function indexRecords(records) {
  const byUid = new Map();
  const byDedupe = new Map();
  for (const record of records) {
    if (record.uid) byUid.set(record.uid, record);
    const key = paperDedupeKey(record);
    // A dedupe key of "ref:" means the record has neither a PubMed URL nor a
    // reference, so it can't be matched that way — only by uid.
    if (key !== 'ref:' && !byDedupe.has(key)) byDedupe.set(key, record);
  }
  return { byUid, byDedupe };
}

// Combines this device's records with the ones from the cloud copy. Papers are
// matched by uid, or by PubMed ID / reference for records that predate uids.
// Returns the full merged library: entries carrying an `id` already exist in
// this device's database, entries without one arrived from another device.
export function mergeLibraries(local, remote) {
  const { byUid, byDedupe } = indexRecords(local);
  const merged = [];
  const usedLocal = new Set();
  const stats = { updated: 0, added: 0, unchanged: 0 };

  for (const remoteRecord of remote) {
    const match =
      (remoteRecord.uid && byUid.get(remoteRecord.uid)) ||
      byDedupe.get(paperDedupeKey(remoteRecord)) ||
      null;

    if (!match) {
      merged.push({ ...mergeRecords(remoteRecord, remoteRecord) });
      stats.added++;
      continue;
    }

    usedLocal.add(match);
    const result = mergeRecords(match, remoteRecord);
    // Keep this device's primary key so the row updates rather than duplicates.
    const withId = { ...result, id: match.id };
    if (JSON.stringify(withId) === JSON.stringify(match)) stats.unchanged++;
    else stats.updated++;
    merged.push(withId);
  }

  // Local-only papers still belong in the merged library — they are what this
  // sync pushes up to the cloud copy.
  for (const localRecord of local) {
    if (!usedLocal.has(localRecord)) {
      merged.push(localRecord);
      stats.unchanged++;
    }
  }

  return { records: merged, stats };
}

// Reduces a record to exactly the fields that belong in the cloud copy. The
// local primary key is dropped — it is this device's IndexedDB id and means
// nothing anywhere else — along with anything else not part of the schema.
export function toSyncRecord(record) {
  const out = {};
  for (const field of [...PAPER_FIELDS, ...SYNC_FIELDS]) {
    if (record[field] !== undefined) out[field] = record[field];
  }
  return out;
}

export function toSyncDocument(records) {
  return {
    schemaVersion: 2,
    app: 'tribulator',
    updatedAt: new Date().toISOString(),
    papers: records.map(toSyncRecord),
  };
}

export function papersFromSyncDocument(doc) {
  if (Array.isArray(doc)) return doc; // a v1 export used as the cloud copy
  if (Array.isArray(doc?.papers)) return doc.papers;
  return [];
}
