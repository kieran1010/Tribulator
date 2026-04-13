import AsyncStorage from '@react-native-async-storage/async-storage';

export const SETTINGS_KEYS = {
  API_KEY: 'tribulator_api_key',
  WEBHOOK_URL: 'tribulator_webhook_url',
  IMPACT_FACTORS: 'tribulator_impact_factors',
  SPREADSHEET_ID: 'tribulator_spreadsheet_id',
};

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