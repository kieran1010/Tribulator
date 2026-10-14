import { SYNC_FIELDS, TAGS } from './constants';
import { getAllPapers, addPaper, findMatchingPaper } from './db';
import { toSyncDocument } from './merge';
import { SETTINGS_KEYS, getSetting, setSetting } from './storage';
import { getLastSync, isSyncConfigured, isSyncEnabled } from './sync';

const DAY_MS = 24 * 60 * 60 * 1000;

// How old the newest backup may get before the reminder appears, and how long
// "Not now" puts it off for.
export const BACKUP_REMINDER_DAYS = 5;

// Decides whether the backup reminder is due and what it should offer:
// 'resync' when Drive sync is linked but hasn't completed recently, 'setup'
// when Drive sync is available but not yet set up, or 'file' when this build
// has no Drive sync at all. Returns null when no reminder is due.
export function getBackupReminder() {
  const snoozedUntil = getSetting(SETTINGS_KEYS.BACKUP_SNOOZED_UNTIL);
  if (snoozedUntil && Date.now() < new Date(snoozedUntil).getTime()) return null;

  // A Drive sync is a backup too, so a recent one counts — including a manual
  // sync on a linked device with automatic sync switched off.
  const driveLinked = isSyncConfigured() && (isSyncEnabled() || !!getSetting(SETTINGS_KEYS.DRIVE_FILE_ID));
  const lastBackup = [getSetting(SETTINGS_KEYS.LAST_BACKUP), driveLinked ? getLastSync() : null]
    .filter(Boolean)
    .sort()
    .pop() || null;
  const daysSince = lastBackup ? (Date.now() - new Date(lastBackup).getTime()) / DAY_MS : Infinity;
  if (daysSince <= BACKUP_REMINDER_DAYS) return null;

  return {
    daysSince: lastBackup ? Math.floor(daysSince) : null,
    offer: driveLinked ? 'resync' : isSyncConfigured() ? 'setup' : 'file',
  };
}

export function snoozeBackupReminder() {
  setSetting(SETTINGS_KEYS.BACKUP_SNOOZED_UNTIL, new Date(Date.now() + BACKUP_REMINDER_DAYS * DAY_MS).toISOString());
}

export async function exportLibraryToFile() {
  const papers = await getAllPapers();
  // The same document shape the cloud copy uses, so a file backup and a Drive
  // library are interchangeable — either can restore the other.
  const data = toSyncDocument(papers);

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  // Date only would let two backups taken the same day silently overwrite
  // each other in a downloads folder (Optimise Library takes one before every
  // apply). ':' is stripped since it's invalid in a Windows filename.
  const stamp = new Date().toISOString().replace('T', '_').replace(/:/g, '-').split('.')[0];
  const a = document.createElement('a');
  a.href = url;
  a.download = `tribulator-backup-${stamp}.json`;
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
  journal: ['journal'],
  paperType: ['papertype', 'paper type', 'publication type'],
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
    journal: paper.journal || '',
    paperType: paper.paperType || '',
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
