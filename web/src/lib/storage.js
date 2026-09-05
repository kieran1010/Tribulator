export const SETTINGS_KEYS = {
  API_KEY: 'tribulator_api_key',
  AI_ENABLED: 'tribulator_ai_enabled',
  LAST_BACKUP: 'tribulator_last_backup',
  GOOGLE_CLIENT_ID: 'tribulator_google_client_id',
  SYNC_ENABLED: 'tribulator_sync_enabled',
  DRIVE_FILE_ID: 'tribulator_drive_file_id',
  LAST_SYNC: 'tribulator_last_sync',
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

export function isAiEnabled() {
  return getSetting(SETTINGS_KEYS.AI_ENABLED) === 'true' && !!getSetting(SETTINGS_KEYS.API_KEY);
}
