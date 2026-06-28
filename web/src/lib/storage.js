export const SETTINGS_KEYS = {
  API_KEY: 'tribulator_api_key',
  AI_ENABLED: 'tribulator_ai_enabled',
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
