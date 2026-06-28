import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, StyleSheet, TextInput, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { loadBookmarks, saveBookmarks, backupBookmarks, restoreBookmarks } from '../helpers';

export default function SavedScreen({ navigation }) {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const data = await loadBookmarks();
        // Sort newest first
        const sorted = [...data].sort((a, b) => {
          const da = new Date(a.dateAdded || 0);
          const db = new Date(b.dateAdded || 0);
          return db - da;
        });
        setBookmarks(sorted);
        setLoading(false);
      })();
    }, [])
  );

  const handleDelete = (id) => {
    Alert.alert('Remove Bookmark', 'Remove this paper from saved trials?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          const updated = bookmarks.filter(b => b.id !== id);
          setBookmarks(updated);
          await saveBookmarks(updated);
        },
      },
    ]);
  };

  const handleBackup = async () => {
    setBacking(true);
    try {
      await backupBookmarks(bookmarks);
      Alert.alert('Backup Complete', `${bookmarks.length} papers backed up to Google Sheets.`);
    } catch (e) {
      Alert.alert('Backup Failed', e.message);
    } finally {
      setBacking(false);
    }
  };

  const handleRestore = async () => {
    Alert.alert(
      'Restore from Backup',
      'This will replace your current saved papers with the backup. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            setRestoring(true);
            try {
              const restored = await restoreBookmarks();
              setBookmarks(restored);
              await saveBookmarks(restored);
              Alert.alert('Restored', `${restored.length} papers restored.`);
            } catch (e) {
              Alert.alert('Restore Failed', e.message);
            } finally {
              setRestoring(false);
            }
          },
        },
      ]
    );
  };

  const filtered = query.trim()
    ? bookmarks.filter(b => {
        const s = [b.title, b.journal, b.pubdate, ...(b.keywords || [])].join(' ').toLowerCase();
        return s.includes(query.toLowerCase());
      })
    : bookmarks;

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#0066CC" />
    </View>
  );

  return (
    <View style={styles.flex1}>
      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color="#aaa" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search saved papers..."
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color="#aaa" />
          </TouchableOpacity>
        )}
      </View>

      {/* Backup / Restore buttons */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.toolbarBtn, backing && styles.btnDisabled]}
          onPress={handleBackup}
          disabled={backing}
        >
          {backing ? <ActivityIndicator size="small" color="#0066CC" /> : <Ionicons name="cloud-upload-outline" size={16} color="#0066CC" />}
          <Text style={styles.toolbarBtnText}>Backup</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toolbarBtn, restoring && styles.btnDisabled]}
          onPress={handleRestore}
          disabled={restoring}
        >
          {restoring ? <ActivityIndicator size="small" color="#0066CC" /> : <Ionicons name="cloud-download-outline" size={16} color="#0066CC" />}
          <Text style={styles.toolbarBtnText}>Restore</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        ListHeaderComponent={
          <Text style={styles.count}>
            {filtered.length} of {bookmarks.length} saved paper{bookmarks.length !== 1 ? 's' : ''}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="bookmark-outline" size={48} color="#ccc" />
            <Text style={styles.emptyTitle}>
              {query ? 'No results found' : 'No saved papers yet'}
            </Text>
            <Text style={styles.emptyText}>
              {query ? 'Try a different search term' : 'Tap the bookmark icon on any paper to save it here'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('SavedDetail', { trial: item })}
          >
            <View style={styles.cardTop}>
              <Text style={styles.pubdate}>{item.pubdate}</Text>
              <TouchableOpacity onPress={() => handleDelete(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={16} color="#ccc" />
              </TouchableOpacity>
            </View>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardJournal}>{item.journal}</Text>
            {item.keywords && item.keywords.length > 0 && (
              <View style={styles.keywords}>
                {item.keywords.slice(0, 3).map((kw, i) => (
                  <Text key={i} style={styles.keyword}>{kw}</Text>
                ))}
              </View>
            )}
            {item.dateAdded && (
              <Text style={styles.dateAdded}>Added {new Date(item.dateAdded).toLocaleDateString()}</Text>
            )}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, backgroundColor: '#f8f9fa' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, marginTop: 40 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', margin: 12, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#eee',
    gap: 8,
  },
  searchIcon: {},
  searchInput: { flex: 1, fontSize: 14, color: '#333' },
  toolbar: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginBottom: 4 },
  toolbarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#dde',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
  },
  btnDisabled: { opacity: 0.5 },
  toolbarBtnText: { color: '#0066CC', fontSize: 13, fontWeight: '600' },
  count: { fontSize: 12, color: '#888', marginBottom: 12 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04,
    shadowRadius: 4, elevation: 1,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  pubdate: { fontSize: 11, color: '#888' },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 4, lineHeight: 20 },
  cardJournal: { fontSize: 12, color: '#666', fontStyle: 'italic', marginBottom: 6 },
  keywords: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 6 },
  keyword: {
    fontSize: 11, color: '#0066CC', backgroundColor: '#e8f0fb',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden',
  },
  dateAdded: { fontSize: 11, color: '#bbb' },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#555', marginTop: 12, marginBottom: 6 },
  emptyText: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 20 },
});
