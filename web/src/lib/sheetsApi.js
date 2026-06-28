import { CATEGORIES, BOOTSTRAP_SCRIPT_URL } from './constants';
import { SETTINGS_KEYS, getSetting } from './storage';
import { buildVancouverReference } from './format';

// Apps Script web apps can't answer a CORS preflight, so a POST with
// Content-Type: application/json is blocked by the browser before it ever
// reaches Google. Sending the same JSON body as text/plain keeps the request
// "simple" (no preflight) — Apps Script's doPost(e) reads e.postData.contents
// either way, so the payload itself doesn't change.
const WEBHOOK_HEADERS = { 'Content-Type': 'text/plain;charset=utf-8' };

function requireWebhookConfig() {
  const webhookUrl = getSetting(SETTINGS_KEYS.WEBHOOK_URL);
  const spreadsheetId = getSetting(SETTINGS_KEYS.SPREADSHEET_ID);
  if (!webhookUrl) throw new Error('No webhook URL set in Settings');
  return { webhookUrl, spreadsheetId };
}

export async function exportToSheets(trial, details, aiSummary, retries = 5) {
  const { webhookUrl, spreadsheetId } = requireWebhookConfig();
  const reference = buildVancouverReference(trial, details);

  const categoryFlags = {};
  CATEGORIES.forEach(cat => {
    categoryFlags[cat] = aiSummary.category?.includes(cat) ? 'TRUE' : 'FALSE';
  });

  const payload = {
    spreadsheetId,
    subject: aiSummary.subject || '',
    oss: aiSummary.headline || '',
    fullSummary: aiSummary.comprehensive || '',
    year: trial.pubdate ? trial.pubdate.split(' ')[0] : '',
    title: trial.title,
    reference,
    url: `https://pubmed.ncbi.nlm.nih.gov/${trial.pubmedId}/`,
    date: new Date().toLocaleDateString(),
    categoryFlags,
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: WEBHOOK_HEADERS,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) return;
      throw new Error(data.error || 'Export failed');
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
}

// There's no dedicated backup/restore endpoint on the Apps Script side — only
// an export log (one row per paper, in the AI-summary export shape) and
// importAll (reads that log back). So "backup" appends bookmarks to that log
// via bulkExport, and "restore" reads it back via importAll. Trade-off: a
// restored paper won't have keywords/quartile/impact-factor (not stored in
// the sheet), and only ever-exported papers round-trip — not just bookmarked ones.
export async function backupBookmarks(bookmarks) {
  const { webhookUrl, spreadsheetId } = requireWebhookConfig();

  const rows = bookmarks.map(b => ({
    subject: '',
    oss: '',
    fullSummary: '',
    year: b.pubdate ? b.pubdate.split(' ')[0] : '',
    title: b.title,
    reference: [b.journal, b.pubdate].filter(Boolean).join(' '),
    url: `https://pubmed.ncbi.nlm.nih.gov/${b.pubmedId}/`,
    date: b.dateAdded ? new Date(b.dateAdded).toLocaleDateString() : new Date().toLocaleDateString(),
  }));

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: WEBHOOK_HEADERS,
    body: JSON.stringify({ action: 'bulkExport', spreadsheetId, rows }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Backup failed');
}

export async function restoreBookmarks() {
  const { webhookUrl, spreadsheetId } = requireWebhookConfig();

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: WEBHOOK_HEADERS,
    body: JSON.stringify({ action: 'importAll', spreadsheetId }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Restore failed');
  return data.bookmarks;
}

export async function loadBootstrapConfig() {
  const res = await fetch(BOOTSTRAP_SCRIPT_URL + '?action=getConfig');
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to load config');
  return data;
}
