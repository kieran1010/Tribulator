import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, ActivityIndicator,
  StyleSheet, TextInput, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { loadBookmarks, saveBookmarks, buildVancouverReference } from '../helpers';
import { getSetting, SETTINGS_KEYS } from '../settings';

const CATEGORIES = [
  'Airway', 'Cardiac', 'Crisis Management', 'Drugs', 'Education',
  'ENT', 'Head + Neck', 'ICU', 'Interventional Radiology', 'Neuroanasesthesia',
  'Obstetrics', 'Orthopaedics', 'Paediatrics', 'Pain', 'Perioperative',
  'Plastics', 'Regional Anaesthesia', 'Resuscitation', 'Safety', 'Sedation',
  'Thoracics', 'Trauma', 'Vascular'
];

async function backupBookmarks(bookmarks) {
  const webhookUrl = await getSetting(SETTINGS_KEYS.WEBHOOK_URL);
  const spreadsheetId = await getSetting(SETTINGS_KEYS.SPREADSHEET_ID);
  if (!webhookUrl) throw new Error('No webhook URL set in Settings');
  if (!spreadsheetId) throw new Error('No spreadsheet ID set in Settings');

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spreadsheetId,
      action: 'backup',
      bookmarks: JSON.stringify(bookmarks),
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Backup failed');
}

async function importBookmarks() {
  const webhookUrl = await getSetting(SETTINGS_KEYS.WEBHOOK_URL);
  const spreadsheetId = await getSetting(SETTINGS_KEYS.SPREADSHEET_ID);
  if (!webhookUrl) throw new Error('No webhook URL set in Settings');
  if (!spreadsheetId) throw new Error('No spreadsheet ID set in Settings');

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ spreadsheetId, action: 'importAll' }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Import failed');
  return data.bookmarks;
}

export default function BookmarksScreen({ navigation }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);

useFocusEffect(
    useCallback(() => {
      (async () => {
        const data = await loadBookmarks();
        const sorted = [...data].sort((a, b) => {
          const dateA = new Date(a.dateAdded || 0);
          const dateB = new Date(b.dateAdded || 0);
          return dateB - dateA;
        });
        setBookmarks(sorted);
        setLoading(false);
      })();
    }, [])
  );

  const filtered = bookmarks.filter(b => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (typeof b.title === 'string' && b.title.toLowerCase().includes(q)) ||
      (typeof b.journal === 'string' && b.journal.toLowerCase().includes(q)) ||
      (typeof b.pubdate === 'string' && b.pubdate.toLowerCase().includes(q)) ||
      (Array.isArray(b.keywords) && b.keywords.some(k => typeof k === 'string' && k.toLowerCase().includes(q))) ||
      (Array.isArray(b.mesh) && b.mesh.some(m => typeof m === 'string' && m.toLowerCase().includes(q)))
    );
  });

  const handleBackup = async () => {
    setBacking(true);
    try {
      await backupBookmarks(bookmarks);
      Alert.alert('Backed up', `${bookmarks.length} trial${bookmarks.length !== 1 ? 's' : ''} backed up.`);
    } catch (e) {
      Alert.alert('Backup failed', e.message);
    } finally {
      setBacking(false);
    }
  };

  const handleImport = () => {
    Alert.alert(
      'Import Bookmarks',
      'This will replace all current bookmarks with every paper in your spreadsheet. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            setRestoring(true);
            try {
              const restored = await importBookmarks();
              await saveBookmarks(restored);
              setBookmarks(restored);
              Alert.alert('Imported', `${restored.length} trial${restored.length !== 1 ? 's' : ''} imported.`);
            } catch (e) {
              Alert.alert('Import failed', e.message);
            } finally {
              setRestoring(false);
            }
          },
        },
      ]
    );
  };

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#0066CC" />
    </View>
  );

  return (
    <View style={styles.container}>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color="#aaa" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search saved trials..."
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color="#aaa" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.backupButton, (backing || bookmarks.length === 0) && styles.buttonDisabled]}
          onPress={handleBackup}
          disabled={backing || bookmarks.length === 0}
        >
          {backing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View style={styles.buttonInner}>
              <Ionicons name="cloud-upload-outline" size={14} color="#fff" />
              <Text style={styles.backupButtonText}>Backup</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.importButton, restoring && styles.buttonDisabled]}
          onPress={handleImport}
          disabled={restoring}
        >
          {restoring ? (
            <ActivityIndicator color="#0066CC" size="small" />
          ) : (
            <View style={styles.buttonInner}>
              <Ionicons name="cloud-download-outline" size={14} color="#0066CC" />
              <Text style={styles.importButtonText}>Import</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListHeaderComponent={
          <Text style={styles.resultsHeader}>
            {search ? `${filtered.length} of ${bookmarks.length}` : bookmarks.length} saved trial{bookmarks.length !== 1 ? 's' : ''}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            {bookmarks.length === 0 ? (
              <>
                <Ionicons name="bookmark-outline" size={48} color="#ccc" />
                <Text style={styles.text}>No bookmarks yet.</Text>
                <Text style={styles.sub}>Tap the bookmark icon on any trial to save it here.</Text>
              </>
            ) : (
              <>
                <Ionicons name="search-outline" size={48} color="#ccc" />
                <Text style={styles.text}>No matches.</Text>
                <Text style={styles.sub}>Try a different search term.</Text>
              </>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('BookmarkDetail', { trial: item, fromBookmarks: true })}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.pubdate}>{item.pubdate}</Text>
              {item.quartile && (
                <View style={[styles.quartileBadge, styles[`quartile${item.quartile}`]]}>
                  <Text style={styles.quartileText}>{item.quartile}</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardJournal}>{item.journal}</Text>
            {item.keywords?.length > 0 && (
              <View style={styles.keywordRow}>
                {item.keywords.map((kw, i) => (
                  <Text key={`kw-${i}`} style={styles.keyword}>{kw}</Text>
                ))}
              </View>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4,
    margin: 16, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10, color: '#111' },
  buttonRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 8 },
  backupButton: {
    flex: 1, backgroundColor: '#0066CC', borderRadius: 10, padding: 10, alignItems: 'center',
  },
  backupButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  importButton: {
    flex: 1, borderWidth: 1.5, borderColor: '#0066CC',
    borderRadius: 10, padding: 10, alignItems: 'center',
  },
  importButtonText: { color: '#0066CC', fontWeight: '600', fontSize: 13 },
  buttonDisabled: { opacity: 0.6 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultsHeader: { fontSize: 13, color: '#666', marginBottom: 12 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  quartileBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  quartileQ1: { backgroundColor: '#e8f5e9' },
  quartileQ2: { backgroundColor: '#e3f2fd' },
  quartileQ3: { backgroundColor: '#fff8e1' },
  quartileQ4: { backgroundColor: '#fce4ec' },
  quartileText: { fontSize: 11, fontWeight: '700', color: '#333' },
  pubdate: { fontSize: 11, color: '#888' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 4, lineHeight: 21 },
  cardJournal: { fontSize: 12, color: '#666', fontStyle: 'italic' },
  keywordRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  keyword: {
    fontSize: 11, color: '#0066CC', backgroundColor: '#e8f0fb',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, 
    overflow: 'hidden', marginRight: 6, marginBottom: 6,
  },
  text: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 12 },
  sub: { fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center' },
});