import AsyncStorage from '@react-native-async-storage/async-storage';

export const SETTINGS_KEYS = {
  API_KEY: 'tribulator_api_key',
  WEBHOOK_URL: 'tribulator_webhook_url',
  SPREADSHEET_ID: 'tribulator_spreadsheet_id',
  IMPACT_FACTORS: 'tribulator_impact_factors',
  LAST_BACKUP: 'tribulator_last_backup',
};

// These are loaded from the config spreadsheet on startup (see SettingsScreen.js)
export const DEFAULT_API_KEY = '';
export const DEFAULT_WEBHOOK_URL = '';
export const DEFAULT_SPREADSHEET_ID = '';

export async function getSetting(key) {
  try {
    const value = await AsyncStorage.getItem(key);
    return value || null;
  } catch {
    return null;
  }
}

export async function setSetting(key, value) {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {}
}
