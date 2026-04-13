import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet, BackHandler } from 'react-native';
import { fetchPubMed } from '../helpers';

const QUARTILE_RANK = { 'Q1': 1, 'Q2': 2, 'Q3': 3, 'Q4': 4 };

export default function ResultsScreen({ route, navigation }) {
  const { query, dateRange, quartile, medlineOnly, studyTypes, totalStudyTypes } = route.params;
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const onBack = () => { navigation.goBack(); return true; };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [navigation]);

  const filterByQuartile = (items) => {
    if (quartile === 'Any') return items;
    return items.filter(r =>
      r.quartile && QUARTILE_RANK[r.quartile] <= QUARTILE_RANK[quartile]
    );
  };

  useEffect(() => {
    (async () => {
      try {
        const pubmed = await fetchPubMed(query, dateRange, 0, medlineOnly, studyTypes, totalStudyTypes);
        const filtered = filterByQuartile(pubmed);
        setResults(filtered);
        setHasMore(pubmed.length === 20);
      } catch (e) {
        setError('Failed to fetch results: ' + e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const more = await fetchPubMed(query, dateRange, nextPage, medlineOnly, studyTypes, totalStudyTypes);
      const filtered = filterByQuartile(more);
      setResults(prev => [...prev, ...filtered]);
      setPage(nextPage);
      setHasMore(more.length === 20);
    } catch (e) {
      setError('Failed to load more results.');
    } finally {
      setLoadingMore(false);
    }
  };

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

  return (
    <FlatList
      data={results}
      keyExtractor={item => item.id}
      contentContainerStyle={{ padding: 16 }}
      ListHeaderComponent={
        <Text style={styles.resultsHeader}>{results.length} results for "{query}"</Text>
      }
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.sub}>No published trials found. Try a different search term or date range.</Text>
        </View>
      }
      ListFooterComponent={
        hasMore ? (
          <TouchableOpacity
            style={[styles.loadMoreButton, loadingMore && styles.buttonDisabled]}
            onPress={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.loadMoreText}>Load More</Text>
            )}
          </TouchableOpacity>
        ) : (
          results.length > 0 ? <Text style={styles.endText}>No more results</Text> : null
        )
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('Detail', { trial: item })}
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
                <Text key={`kw-${i}`} style={styles.keyword} numberOfLines={1}>{kw}</Text>
              ))}
            </View>
          )}
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  sub: { fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center' },
  errorText: { fontSize: 14, color: 'red', textAlign: 'center', marginTop: 8 },
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
  keywordRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  keyword: {
    fontSize: 11, color: '#0066CC', backgroundColor: '#e8f0fb',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden',
  },
  loadMoreButton: {
    backgroundColor: '#0066CC', borderRadius: 10,
    padding: 14, alignItems: 'center', marginTop: 8, marginBottom: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  loadMoreText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  endText: { textAlign: 'center', color: '#888', fontSize: 13, marginVertical: 24 },
});