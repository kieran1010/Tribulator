import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { getSetting, setSetting, SETTINGS_KEYS } from '../settings';
import { BOOKMARKS_KEY } from '../helpers';

export default function SettingsScreen({ navigation }) {
  const [apiKey, setApiKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const DEFAULT_API_KEY = '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';
  const DEFAULT_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycby6Rqzo6vVHEFZNVg84wEQ6lOU5YFIU9AoY3QElXbaDkgIVPa7k774UyQPOm5tRiF1b/exec';
  const DEFAULT_SPREADSHEET_ID = '1wJZmgJBmt8-HUsyxnyFM5Urc-pEc5-Mr2g0zcRsf-D8';

useEffect(() => {
    (async () => {
      const key = await getSetting(SETTINGS_KEYS.API_KEY);
      const url = await getSetting(SETTINGS_KEYS.WEBHOOK_URL);
      const sid = await getSetting(SETTINGS_KEYS.SPREADSHEET_ID);

      const newKey = key || DEFAULT_API_KEY;
      const newUrl = url || DEFAULT_WEBHOOK_URL;
      const newSid = sid || DEFAULT_SPREADSHEET_ID;

      setApiKey(newKey);
      setWebhookUrl(newUrl);
      setSpreadsheetId(newSid);

      // Auto-save defaults if nothing was previously saved
      if (!key) await setSetting(SETTINGS_KEYS.API_KEY, DEFAULT_API_KEY);
      if (!url) await setSetting(SETTINGS_KEYS.WEBHOOK_URL, DEFAULT_WEBHOOK_URL);
      if (!sid) await setSetting(SETTINGS_KEYS.SPREADSHEET_ID, DEFAULT_SPREADSHEET_ID);
    })();
  }, []);

  const handleSave = async () => {
    await setSetting(SETTINGS_KEYS.API_KEY, apiKey.trim());
    await setSetting(SETTINGS_KEYS.WEBHOOK_URL, webhookUrl.trim());
    await setSetting(SETTINGS_KEYS.SPREADSHEET_ID, spreadsheetId.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearBookmarks = () => {
    Alert.alert(
      'Clear Bookmarks',
      'Are you sure you want to delete all saved trials? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(BOOKMARKS_KEY);
            Alert.alert('Done', 'All bookmarks have been cleared.');
          },
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>

      <Text style={styles.sectionLabel}>🔑 Anthropic API Key</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { flex: 1, marginBottom: 0 }]}
          placeholder="sk-ant-..."
          value={apiKey}
          onChangeText={setApiKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={!showKey}
        />
        <TouchableOpacity onPress={() => setShowKey(s => !s)} style={styles.eyeBtn}>
          <Ionicons name={showKey ? 'eye-off-outline' : 'eye-outline'} size={20} color="#888" />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>📊 Google Sheets Webhook URL</Text>
      <TextInput
        style={styles.input}
        placeholder="https://script.google.com/macros/s/..."
        value={webhookUrl}
        onChangeText={setWebhookUrl}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.sectionLabel}>📋 Google Spreadsheet ID</Text>
      <TextInput
        style={styles.input}
        placeholder="Paste your spreadsheet ID here"
        value={spreadsheetId}
        onChangeText={setSpreadsheetId}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Ionicons name={saved ? 'checkmark-circle' : 'save-outline'} size={18} color="#fff" />
        <Text style={styles.saveButtonText}>{saved ? 'Saved!' : 'Save Settings'}</Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <Text style={styles.sectionLabel}>🗑 Bookmarks</Text>
      <TouchableOpacity style={styles.dangerButton} onPress={handleClearBookmarks}>
        <Ionicons name="trash-outline" size={18} color="#fff" />
        <Text style={styles.dangerButtonText}>Clear All Bookmarks</Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <Text style={styles.sectionLabel}>ℹ️ About</Text>
      <View style={styles.aboutBox}>
        <Text style={styles.aboutTitle}>Tribulator</Text>
        <Text style={styles.aboutText}>Version 2.0.0</Text>
        <Text style={styles.aboutText}>Clinical trial search & summarisation</Text>
        <Text style={styles.aboutText}>for anaesthesia & critical care</Text>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 40, paddingBottom: 40 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#0066CC', marginBottom: 8, marginTop: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  eyeBtn: { padding: 10 },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 10,
    padding: 14, fontSize: 14, marginBottom: 16, backgroundColor: '#fff',
  },
  navButton: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#e0e0e0', marginBottom: 16,
  },
  navButtonText: { flex: 1, fontSize: 14, color: '#0066CC', fontWeight: '600' },
  saveButton: {
    backgroundColor: '#0066CC', borderRadius: 10,
    padding: 14, alignItems: 'center', flexDirection: 'row',
    justifyContent: 'center', gap: 8, marginTop: 8,
  },
  saveButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  dangerButton: {
    backgroundColor: '#c62828', borderRadius: 10,
    padding: 14, alignItems: 'center', flexDirection: 'row',
    justifyContent: 'center', gap: 8,
  },
  dangerButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
  aboutBox: { backgroundColor: '#f8f9fa', borderRadius: 10, padding: 16, gap: 4 },
  aboutTitle: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 4 },
  aboutText: { fontSize: 13, color: '#666' },
});