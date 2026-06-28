const BOOKMARKS_KEY = 'tribulator_bookmarks';

export const SETTINGS_KEYS = {
  API_KEY: 'tribulator_api_key',
  WEBHOOK_URL: 'tribulator_webhook_url',
  SPREADSHEET_ID: 'tribulator_spreadsheet_id',
  IMPACT_FACTORS: 'tribulator_impact_factors',
};

export function getSetting(key) {
  try {
    return localStorage.getItem(key) || null;
  } catch {
    return null;
  }
}

export function setSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export function loadBookmarks() {
  try {
    const data = localStorage.getItem(BOOKMARKS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveBookmarks(bookmarks) {
  try {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  } catch {}
}

export function clearBookmarks() {
  try {
    localStorage.removeItem(BOOKMARKS_KEY);
  } catch {}
}
