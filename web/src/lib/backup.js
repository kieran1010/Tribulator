import { SYNC_FIELDS, TAGS } from './constants';
import { getAllPapers, addPaper, findMatchingPaper } from './db';
import { toSyncDocument } from './merge';
import { SETTINGS_KEYS, setSetting } from './storage';

export async function exportLibraryToFile() {
  const papers = await getAllPapers();
  // The same document shape the cloud copy uses, so a file backup and a Drive
  // library are interchangeable — either can restore the other.
  const data = toSyncDocument(papers);

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().split('T')[0];
  const a = document.createElement('a');
  a.href = url;
  a.download = `tribulator-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  setSetting(SETTINGS_KEYS.LAST_BACKUP, new Date().toISOString());
  return papers.length;
}

// Accepts both the camelCase shape this app exports, and the human-readable
// column headers that show up in JSON derived from the old Google Sheets
// (e.g. "One-Sentence Summary"/"OSS", "Full Summary", "Date Entered"), plus
// per-category TRUE/FALSE boolean columns in place of a tags array.
const FIELD_ALIASES = {
  title: ['title'],
  reference: ['reference'],
  url: ['url'],
  year: ['year'],
  subject: ['subject'],
  abstract: ['abstract'],
  dateEntered: ['dateentered', 'date entered', 'date'],
  oneLineSummary: ['onelinesummary', 'one-sentence summary', 'one sentence summary', 'oss'],
  fullSummary: ['fullsummary', 'full summary'],
  tags: ['tags'],
};

function normalizePaperRecord(raw) {
  const lowerMap = {};
  Object.keys(raw).forEach(k => { lowerMap[k.trim().toLowerCase()] = raw[k]; });

  const paper = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      if (lowerMap[alias] !== undefined) { paper[field] = lowerMap[alias]; break; }
    }
  }

  // Carry sync bookkeeping through when the file has it (a v2 export), so a
  // restored paper keeps the identity other devices already know it by.
  for (const field of SYNC_FIELDS) {
    if (raw[field] !== undefined) paper[field] = raw[field];
  }

  if (!Array.isArray(paper.tags)) {
    paper.tags = TAGS.filter(tag => {
      const v = lowerMap[tag.toLowerCase()];
      return v === true || v === 'TRUE' || v === 'true';
    });
  }

  const record = {
    title: paper.title || '',
    reference: paper.reference || '',
    url: paper.url || '',
    year: paper.year ? String(paper.year) : '',
    subject: paper.subject || '',
    abstract: paper.abstract || '',
    dateEntered: paper.dateEntered || '',
    oneLineSummary: paper.oneLineSummary || '',
    fullSummary: paper.fullSummary || '',
    tags: paper.tags,
  };
  for (const field of SYNC_FIELDS) {
    if (paper[field] !== undefined) record[field] = paper[field];
  }
  return record;
}

export async function importLibraryFromFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const records = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.papers) ? parsed.papers : []);

  const existing = await getAllPapers();
  let imported = 0;
  let skipped = 0;

  for (const raw of records) {
    const candidate = normalizePaperRecord(raw);
    // A tombstone in a backup file is a deletion, not a paper to restore.
    if (candidate.deletedAt) { skipped++; continue; }
    if (findMatchingPaper(existing, candidate)) {
      skipped++;
      continue;
    }
    const id = await addPaper(candidate);
    existing.push({ ...candidate, id });
    imported++;
  }

  return { imported, skipped, total: records.length };
}
