import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Linking, BackHandler, StyleSheet, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchFullDetails, fetchAISummary, buildVancouverReference,
  exportToSheets, loadBookmarks, saveBookmarks
} from '../helpers';

export default function DetailScreen({ route, navigation }) {
    const { trial, fromBookmarks } = route.params;
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [exportError, setExportError] = useState(null);

  useEffect(() => {
    const onBack = () => { navigation.goBack(); return true; };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [navigation]);

  useEffect(() => {
    (async () => {
      try {
        const d = await fetchFullDetails(trial.pubmedId);
        setDetails(d);
      } catch {
        setDetails({});
      } finally {
        setDetailsLoading(false);
      }
      const bookmarks = await loadBookmarks();
      const isBookmarked = bookmarks.some(b => b.id === trial.id) || trial.bookmarked === true;
      setBookmarked(isBookmarked);
      if (trial.aiSummary) {
        setAiSummary(trial.aiSummary);
      }
    })();
  }, []);

useEffect(() => {
    if (!aiSummary || !bookmarked) return;
    (async () => {
      const bookmarks = await loadBookmarks();
      const updated = bookmarks.map(b =>
        b.id === trial.id ? { ...b, aiSummary, details } : b
      );
      await saveBookmarks(updated);

      // Auto-export when summary is generated for a bookmarked paper
      try {
        await exportToSheets(trial, details || {}, aiSummary);
      } catch {
        // Fail silently
      }
    })();
  }, [aiSummary]);

const toggleBookmark = async () => {
    const bookmarks = await loadBookmarks();
    if (bookmarked) {
      const updated = bookmarks.filter(b => b.id !== trial.id);
      await saveBookmarks(updated);
      setBookmarked(false);
    } else {
      const trialToSave = {
        ...trial,
        dateAdded: new Date().toISOString(),
        ...(aiSummary ? { aiSummary } : {}),
        ...(details ? { details } : {}),
      };
      const updated = [...bookmarks, trialToSave];
      await saveBookmarks(updated);
      setBookmarked(true);

      // Auto-export to Sheets — with or without AI summary
      try {
        await exportToSheets(trialToSave, details || {}, aiSummary || {});
      } catch {
        // Fail silently
      }
    }
  };

  const handleSummarise = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const summary = await fetchAISummary(trial, details?.abstract);
      setAiSummary(summary);

    } catch {
      setAiError('Failed to generate summary. Check your API key.');
    } finally {
      setAiLoading(false);
    }
  };

const reference = trial.storedReference || (details ? buildVancouverReference(trial, details) : null);
const studyLink = trial.url || `https://pubmed.ncbi.nlm.nih.gov/${trial.pubmedId}/`;

  return (
    <ScrollView contentContainerStyle={styles.detailContainer}>

      <View style={styles.detailTitleRow}>
        <Text style={[styles.detailTitle, { flex: 1 }]}>{trial.title}</Text>
        <TouchableOpacity onPress={toggleBookmark} style={styles.bookmarkBtn}>
          <Ionicons
            name={bookmarked ? 'bookmark' : 'bookmark-outline'}
            size={26}
            color={bookmarked ? '#0066CC' : '#aaa'}
          />
        </TouchableOpacity>
      </View>
      <Text style={styles.detailJournal}>{trial.journal} · {trial.pubdate}</Text>
      {trial.quartile && (
        <View style={[styles.quartileBadge, styles[`quartile${trial.quartile}`]]}>
          <Text style={styles.quartileText}>{trial.quartile}</Text>
        </View>
      )}

      <View style={styles.divider} />

      <Text style={styles.sectionLabel}>📎 Vancouver Reference</Text>
      {detailsLoading ? (
        <ActivityIndicator color="#0066CC" style={{ marginVertical: 8 }} />
      ) : (
        <View style={styles.referenceBox}>
          <Text style={styles.referenceText}>{reference}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.linkButton} onPress={() => Linking.openURL(studyLink)}>
        <Ionicons name="open-outline" size={16} color="#0066CC" />
        <Text style={styles.linkText}>View on PubMed</Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <Text style={styles.sectionLabel}>📄 Abstract</Text>
      {detailsLoading ? (
        <ActivityIndicator color="#0066CC" style={{ marginVertical: 8 }} />
      ) : (
        <Text style={styles.abstractText}>{details?.abstract || 'No abstract available.'}</Text>
      )}

      <View style={styles.divider} />

      {(trial.keywords?.length > 0 || trial.mesh?.length > 0) && (
        <View>
          {trial.keywords?.length > 0 && (
            <View style={styles.keywordSection}>
              <Text style={styles.sectionLabel}>🔑 Author Keywords</Text>
              <View style={styles.keywordRow}>
                {trial.keywords.map((kw, i) => (
                  <Text key={`kw-${i}`} style={styles.keyword}>{kw}</Text>
                ))}
              </View>
            </View>
          )}
          <View style={styles.divider} />
        </View>
      )}

      <Text style={styles.sectionLabel}>✨ AI Clinical Summary</Text>

      {!aiSummary && !aiLoading && (
        <TouchableOpacity style={styles.aiButton} onPress={handleSummarise}>
          <Text style={styles.aiButtonText}>Generate AI Summary</Text>
        </TouchableOpacity>
      )}

      {aiLoading && (
        <View style={styles.aiLoading}>
          <ActivityIndicator color="#0066CC" />
          <Text style={styles.sub}>Summarising for clinicians...</Text>
        </View>
      )}

      {aiError && <Text style={styles.errorText}>{aiError}</Text>}

      {aiSummary && (
        <View>
          <View style={styles.categoryBox}>
            <Text style={styles.headlineLabel}>CATEGORY</Text>
            <View style={styles.categoryRow}>
              {(Array.isArray(aiSummary.category)
                ? aiSummary.category
                : [aiSummary.category]
              ).filter(Boolean).map((cat, i) => (
                <Text key={i} style={styles.categoryTag}>{cat}</Text>
              ))}
            </View>
          </View>

          <View style={styles.subjectBox}>
            <Text style={styles.headlineLabel}>SUBJECT AREA</Text>
            <TextInput
              style={styles.subjectText}
              value={aiSummary.subject}
              onChangeText={v => setAiSummary(s => ({ ...s, subject: v }))}
              multiline
            />
          </View>

          <View style={styles.headlineBox}>
            <Text style={styles.headlineLabel}>ONE SENTENCE SUMMARY</Text>
            <TextInput
              style={styles.headlineText}
              value={aiSummary.headline}
              onChangeText={v => setAiSummary(s => ({ ...s, headline: v }))}
              multiline
              scrollEnabled={false}
            />
          </View>

          <View style={styles.aiBox}>
            <Text style={styles.headlineLabel}>FULL SUMMARY</Text>
            <Text style={styles.aiText}>{aiSummary.comprehensive}</Text>
          </View>

          <TouchableOpacity onPress={handleSummarise} style={styles.regenerate}>
            <Text style={styles.regenerateText}>↻ Regenerate</Text>
          </TouchableOpacity>

        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  detailContainer: { padding: 20, paddingBottom: 40 },
  detailTitleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  detailTitle: { fontSize: 18, fontWeight: '700', color: '#111', lineHeight: 26 },
  bookmarkBtn: { paddingLeft: 12, paddingTop: 2 },
  detailJournal: { fontSize: 13, color: '#666', fontStyle: 'italic', marginBottom: 6 },
  quartileBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4 },
  quartileQ1: { backgroundColor: '#e8f5e9' },
  quartileQ2: { backgroundColor: '#e3f2fd' },
  quartileQ3: { backgroundColor: '#fff8e1' },
  quartileQ4: { backgroundColor: '#fce4ec' },
  quartileText: { fontSize: 11, fontWeight: '700', color: '#333' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#0066CC', marginBottom: 8 },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
  referenceBox: {
    backgroundColor: '#fffbf0', borderLeftWidth: 3,
    borderLeftColor: '#f0a500', padding: 14, borderRadius: 6, marginBottom: 12,
  },
  referenceText: { fontSize: 13, color: '#333', lineHeight: 20, fontStyle: 'italic' },
  abstractText: { fontSize: 14, color: '#333', lineHeight: 22 },
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  linkText: { color: '#0066CC', fontSize: 14, textDecorationLine: 'underline' },
  keywordSection: { marginBottom: 12 },
  keywordRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  keyword: {
    fontSize: 12, color: '#0066CC', backgroundColor: '#e8f0fb',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden',
  },
  meshKeyword: {
    fontSize: 12, color: '#2e7d32', backgroundColor: '#e8f5e9',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden',
  },
  aiButton: {
    borderWidth: 1.5, borderColor: '#0066CC', borderRadius: 10,
    padding: 14, alignItems: 'center', marginTop: 8,
  },
  aiButtonText: { color: '#0066CC', fontWeight: '600', fontSize: 15 },
  aiLoading: { alignItems: 'center', marginTop: 16, gap: 8 },
  sub: { fontSize: 14, color: '#888', marginTop: 8, textAlign: 'center' },
  categoryBox: { backgroundColor: '#e8eaf6', borderRadius: 10, padding: 14, marginBottom: 10 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  categoryTag: {
    fontSize: 13, fontWeight: '600', color: '#fff',
    backgroundColor: '#283593', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 6, overflow: 'hidden',
  },
  subjectBox: { backgroundColor: '#f3e5f5', borderRadius: 10, padding: 14, marginBottom: 10 },
  subjectText: { fontSize: 15, fontWeight: '600', color: '#6a1b9a', lineHeight: 22 },
  headlineBox: { backgroundColor: '#e8f5e9', borderRadius: 10, padding: 14, marginBottom: 10 },
  headlineLabel: { fontSize: 10, fontWeight: '800', color: '#888', letterSpacing: 1, marginBottom: 6 },
  headlineText: { fontSize: 15, fontWeight: '600', color: '#1b5e20', lineHeight: 22, minHeight: 80 },
  aiBox: { backgroundColor: '#f0f7ff', borderRadius: 10, padding: 16, marginTop: 8 },
  aiText: { fontSize: 14, color: '#111', lineHeight: 22 },
  regenerate: { marginTop: 12, alignSelf: 'flex-end' },
  regenerateText: { color: '#0066CC', fontSize: 13 },
  errorText: { fontSize: 14, color: 'red', textAlign: 'center', marginTop: 8 },
  sheetsButton: {
    backgroundColor: '#0F9D58', borderRadius: 10,
    padding: 14, alignItems: 'center', marginTop: 8,
  },
  sheetsButtonDisabled: { opacity: 0.6 },
  sheetsButtonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetsButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  sheetsSuccess: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  sheetsSuccessText: { color: '#0F9D58', fontWeight: '600', fontSize: 15 },
});