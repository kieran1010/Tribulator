import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, StyleSheet, BackHandler
} from 'react-native';
import { fetchPubMed } from '../helpers';

export default function ResultsScreen({ route, navigation }) {
  const { query, filters } = route.params;
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const onBack = () => { navigation.goBack(); return true; };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [navigation]);

  useEffect(() => {
    (async () => {
      try {
        const pubmed = await fetchPubMed(query, filters);
        setResults(pubmed);
      } catch (e) {
        setError('Failed to fetch results: ' + e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#0066CC" />
      <Text style={styles.sub}>Searching PubMed...</Text>
    </View>
  );

  if (error) return (
    <View style={styles.centered}>
      <Text style={styles.errorText}>{error}</Text>
    </View>
  );

  const quartileColor = (q) => {
    if (q === 'Q1') return '#2e7d32';
    if (q === 'Q2') return '#0066CC';
    if (q === 'Q3') return '#e65100';
    if (q === 'Q4') return '#888';
    return '#888';
  };

  return (
    <FlatList
      data={results}
      keyExtractor={item => item.id}
      contentContainerStyle={{ padding: 16 }}
      ListHeaderComponent={
        <Text style={styles.header}>{results.length} results for "{query}"</Text>
      }
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.sub}>No results found. Try different search terms or filters.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('Detail', { trial: item })}
        >
          <View style={styles.cardTop}>
            <Text style={styles.pubdate}>{item.pubdate}</Text>
            <View style={styles.badges}>
              {item.quartile && (
                <View style={[styles.badge, { backgroundColor: quartileColor(item.quartile) + '22', borderColor: quartileColor(item.quartile) }]}>
                  <Text style={[styles.badgeText, { color: quartileColor(item.quartile) }]}>{item.quartile}</Text>
                </View>
              )}
              {item.impactFactor && (
                <View style={styles.ifBadge}>
                  <Text style={styles.ifText}>IF {item.impactFactor.toFixed(1)}</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.cardJournal}>{item.journal}</Text>
          {item.keywords.length > 0 && (
            <View style={styles.keywords}>
              {item.keywords.slice(0, 4).map((kw, i) => (
                <Text key={i} style={styles.keyword}>{kw}</Text>
              ))}
            </View>
          )}
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, marginTop: 40 },
  sub: { fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center' },
  errorText: { fontSize: 14, color: 'red', textAlign: 'center' },
  header: { fontSize: 13, color: '#666', marginBottom: 12 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 6, elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  pubdate: { fontSize: 11, color: '#888' },
  badges: { flexDirection: 'row', gap: 6 },
  badge: {
    borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  ifBadge: { backgroundColor: '#fff3e0', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  ifText: { fontSize: 11, fontWeight: '700', color: '#e65100' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 4, lineHeight: 21 },
  cardJournal: { fontSize: 12, color: '#666', fontStyle: 'italic', marginBottom: 6 },
  keywords: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  keyword: {
    fontSize: 11, color: '#0066CC', backgroundColor: '#e8f0fb',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden',
  },
});
