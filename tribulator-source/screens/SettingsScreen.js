import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SETTINGS_KEYS, getSetting, setSetting } from '../settings';
import { BOOKMARKS_KEY, CONFIG_SPREADSHEET_ID, BOOTSTRAP_SCRIPT_URL } from '../constants';

export default function SettingsScreen({ navigation }) {
  const [apiKey, setApiKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [saved, setSaved] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);

  useEffect(() => {
    (async () => {
      const key = await getSetting(SETTINGS_KEYS.API_KEY);
      const url = await getSetting(SETTINGS_KEYS.WEBHOOK_URL);
      const sid = await getSetting(SETTINGS_KEYS.SPREADSHEET_ID);
      if (key) setApiKey(key);
      if (url) setWebhookUrl(url);
      if (sid) setSpreadsheetId(sid);
    })();
  }, []);

  const handleSave = async () => {
    await setSetting(SETTINGS_KEYS.API_KEY, apiKey.trim());
    await setSetting(SETTINGS_KEYS.WEBHOOK_URL, webhookUrl.trim());
    await setSetting(SETTINGS_KEYS.SPREADSHEET_ID, spreadsheetId.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLoadFromSpreadsheet = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch(BOOTSTRAP_SCRIPT_URL + '?action=getConfig');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load config');
      if (data.apiKey) { setApiKey(data.apiKey); await setSetting(SETTINGS_KEYS.API_KEY, data.apiKey); }
      if (data.webhookUrl) { setWebhookUrl(data.webhookUrl); await setSetting(SETTINGS_KEYS.WEBHOOK_URL, data.webhookUrl); }
      if (data.spreadsheetId) { setSpreadsheetId(data.spreadsheetId); await setSetting(SETTINGS_KEYS.SPREADSHEET_ID, data.spreadsheetId); }
      Alert.alert('Config Loaded', 'Settings updated from config spreadsheet.');
    } catch (e) {
      Alert.alert('Failed', e.message);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleClearBookmarks = () => {
    Alert.alert(
      'Clear All Bookmarks',
      'This will permanently delete all saved papers. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All', style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(BOOKMARKS_KEY);
            Alert.alert('Done', 'All bookmarks cleared.');
          },
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>

      {/* Load from spreadsheet */}
      <TouchableOpacity
        style={[styles.loadButton, loadingConfig && styles.btnDisabled]}
        onPress={handleLoadFromSpreadsheet}
        disabled={loadingConfig}
      >
        <Ionicons name="cloud-download-outline" size={18} color="#fff" />
        <Text style={styles.loadButtonText}>
          {loadingConfig ? 'Loading...' : 'Load Config from Spreadsheet'}
        </Text>
      </TouchableOpacity>

      {/* API Key */}
      <Text style={styles.label}>🔑 Anthropic API Key</Text>
      <TextInput
        style={styles.input}
        placeholder="sk-ant-..."
        value={apiKey}
        onChangeText={setApiKey}
        autoCapitalize="none"
        secureTextEntry
      />

      {/* Webhook URL */}
      <Text style={styles.label}>📡 Apps Script Webhook URL</Text>
      <TextInput
        style={styles.input}
        placeholder="https://script.google.com/macros/s/..."
        value={webhookUrl}
        onChangeText={setWebhookUrl}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* Spreadsheet ID */}
      <Text style={styles.label}>📊 Google Spreadsheet ID</Text>
      <TextInput
        style={styles.input}
        placeholder="1wJZmg..."
        value={spreadsheetId}
        onChangeText={setSpreadsheetId}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* Save button */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Ionicons name={saved ? 'checkmark-circle' : 'save-outline'} size={18} color="#fff" />
        <Text style={styles.saveButtonText}>{saved ? 'Saved!' : 'Save Settings'}</Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      {/* Impact factors */}
      <Text style={styles.label}>📈 Journal Impact Factors</Text>
      <TouchableOpacity
        style={styles.navButton}
        onPress={() => navigation.navigate('ImpactFactors')}
      >
        <Ionicons name="newspaper-outline" size={18} color="#0066CC" />
        <Text style={styles.navButtonText}>Edit Journal Impact Factors</Text>
        <Ionicons name="chevron-forward" size={16} color="#aaa" />
      </TouchableOpacity>

      <View style={styles.divider} />

      {/* Danger zone */}
      <Text style={styles.label}>🗑 Data</Text>
      <TouchableOpacity style={styles.dangerButton} onPress={handleClearBookmarks}>
        <Ionicons name="trash-outline" size={18} color="#fff" />
        <Text style={styles.dangerButtonText}>Clear All Bookmarks</Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      {/* About */}
      <View style={styles.aboutBox}>
        <Text style={styles.aboutTitle}>Tribulator</Text>
        <Text style={styles.aboutText}>Version 2.0</Text>
        <Text style={styles.aboutText}>Clinical trial search & summarisation</Text>
        <Text style={styles.aboutText}>for anaesthesia & critical care</Text>
        <Text style={styles.aboutText}>Kieran Gillick</Text>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 48 },
  loadButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0066CC', borderRadius: 10,
    padding: 14, justifyContent: 'center', marginBottom: 24,
  },
  loadButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
  label: { fontSize: 13, fontWeight: '700', color: '#0066CC', marginBottom: 8, marginTop: 4 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    padding: 14, fontSize: 14, marginBottom: 16, backgroundColor: '#fff',
  },
  saveButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0066CC', borderRadius: 10,
    padding: 14, justifyContent: 'center', marginTop: 4,
  },
  saveButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
  navButton: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#e0e0e0', marginBottom: 8,
  },
  navButtonText: { flex: 1, fontSize: 14, color: '#0066CC', fontWeight: '600' },
  dangerButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#c62828', borderRadius: 10,
    padding: 14, justifyContent: 'center',
  },
  dangerButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  aboutBox: { backgroundColor: '#f8f9fa', borderRadius: 10, padding: 16, gap: 4, alignItems: 'center' },
  aboutTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 4 },
  aboutText: { fontSize: 13, color: '#666' },
});
