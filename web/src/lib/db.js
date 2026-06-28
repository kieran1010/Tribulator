const DB_NAME = 'tribulator';
const DB_VERSION = 1;
const STORE_NAME = 'papers';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllPapers() {
  const db = await openDb();
  return reqToPromise(db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll());
}

export async function addPaper(paper) {
  const db = await openDb();
  return reqToPromise(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).add(paper));
}

export async function putPaper(paper) {
  const db = await openDb();
  return reqToPromise(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(paper));
}

export async function deletePaper(id) {
  const db = await openDb();
  await reqToPromise(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id));
}

export async function clearAllPapers() {
  const db = await openDb();
  await reqToPromise(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).clear());
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
