import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  ActivityIndicator, Linking, BackHandler, StyleSheet, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchFullDetails, fetchAISummary, buildVancouverReference,
  exportToSheets, loadBookmarks, saveBookmarks
} from '../helpers';

export default function DetailScreen({ route, navigation }) {
  const { trial } = route.params;
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [abstractExpanded, setAbstractExpanded] = useState(false);

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
      setBookmarked(bookmarks.some(b => b.id === trial.id));
    })();
  }, []);

  const toggleBookmark = async () => {
    const bookmarks = await loadBookmarks();
    const updated = bookmarked
      ? bookmarks.filter(b => b.id !== trial.id)
      : [...bookmarks, { ...trial, dateAdded: new Date().toISOString() }];
    await saveBookmarks(updated);
    setBookmarked(!bookmarked);
  };

  const handleSummarise = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const summary = await fetchAISummary(trial, details?.abstract);
      setAiSummary(summary);
    } catch (e) {
      setAiError('Failed to generate summary: ' + e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleExport = async () => {
    if (exporting || !aiSummary) return;
    setExporting(true);
    setExportError(null);
    try {
      await exportToSheets(trial, details, aiSummary);
      setExported(true);
    } catch (e) {
      setExportError('Export failed: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  const reference = details ? buildVancouverReference(trial, details) : null;
  const studyLink = `https://pubmed.ncbi.nlm.nih.gov/${trial.pubmedId}/`;

  const quartileColor = (q) => {
    if (q === 'Q1') return '#2e7d32';
    if (q === 'Q2') return '#0066CC';
    if (q === 'Q3') return '#e65100';
    return '#888';
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>

      {/* Back button */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={20} color="#0066CC" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      {/* Title & bookmark */}
      <View style={styles.titleRow}>
        <Text style={[styles.title, { flex: 1 }]}>{trial.title}</Text>
        <TouchableOpacity onPress={toggleBookmark} style={styles.bookmarkBtn}>
          <Ionicons
            name={bookmarked ? 'bookmark' : 'bookmark-outline'}
            size={28}
            color={bookmarked ? '#0066CC' : '#aaa'}
          />
        </TouchableOpacity>
      </View>

      {/* Journal & quartile */}
      <Text style={styles.journal}>{trial.journal} · {trial.pubdate}</Text>
      {trial.quartile && (
        <View style={[styles.quartileBadge, { backgroundColor: quartileColor(trial.quartile) + '18', borderColor: quartileColor(trial.quartile) }]}>
          <Text style={[styles.quartileText, { color: quartileColor(trial.quartile) }]}>
            {trial.quartile} Journal · {trial.impactFactor ? `IF ${trial.impactFactor.toFixed(1)}` : ''}
          </Text>
        </View>
      )}

      <View style={styles.divider} />

      {/* Vancouver Reference */}
      <Text style={styles.sectionLabel}>📎 Reference</Text>
      {detailsLoading ? (
        <ActivityIndicator color="#0066CC" style={{ marginVertical: 8 }} />
      ) : (
        <View style={styles.referenceBox}>
          <Text style={styles.referenceText}>{reference}</Text>
          {details?.doi && <Text style={styles.doi}>{details.doi}</Text>}
        </View>
      )}

      <TouchableOpacity style={styles.linkButton} onPress={() => Linking.openURL(studyLink)}>
        <Ionicons name="open-outline" size={16} color="#0066CC" />
        <Text style={styles.linkText}>View on PubMed</Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      {/* Abstract */}
      <Text style={styles.sectionLabel}>📄 Abstract</Text>
      {detailsLoading ? (
        <ActivityIndicator color="#0066CC" style={{ marginVertical: 8 }} />
      ) : (
        <View>
          <Text
            style={styles.abstractText}
            numberOfLines={abstractExpanded ? undefined : 5}
          >
            {details?.abstract || 'No abstract available.'}
          </Text>
          {details?.abstract && (
            <TouchableOpacity onPress={() => setAbstractExpanded(e => !e)} style={styles.expandBtn}>
              <Text style={styles.expandText}>{abstractExpanded ? 'Show less ↑' : 'Show more ↓'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.divider} />

      {/* AI Summary */}
      <Text style={styles.sectionLabel}>✦ AI Clinical Summary</Text>

      {!aiSummary && !aiLoading && (
        <TouchableOpacity style={styles.aiButton} onPress={handleSummarise}>
          <Text style={styles.aiButtonText}>Generate AI Summary</Text>
        </TouchableOpacity>
      )}

      {aiLoading && (
        <View style={styles.aiLoading}>
          <ActivityIndicator color="#0066CC" />
          <Text style={styles.sub}>Generating clinical summary...</Text>
        </View>
      )}

      {aiError && <Text style={styles.errorText}>{aiError}</Text>}

      {aiSummary && (
        <View>
          {/* Subject */}
          <View style={styles.subjectBox}>
            <Text style={styles.boxLabel}>SUBJECT AREA</Text>
            <Text style={styles.subjectText}>{aiSummary.subject}</Text>
          </View>

          {/* Headline */}
          <View style={styles.headlineBox}>
            <Text style={styles.boxLabel}>ONE SENTENCE SUMMARY</Text>
            <Text style={styles.headlineText}>{aiSummary.headline}</Text>
          </View>

          {/* Categories */}
          {aiSummary.category && aiSummary.category.length > 0 && (
            <View style={styles.catWrap}>
              {aiSummary.category.map((cat, i) => (
                <View key={i} style={styles.catTag}>
                  <Text style={styles.catText}>{cat}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Full summary */}
          <View style={styles.summaryBox}>
            <Text style={styles.boxLabel}>FULL SUMMARY</Text>
            <Text style={styles.summaryText}>{aiSummary.comprehensive}</Text>
          </View>

          <TouchableOpacity onPress={handleSummarise} style={styles.regenerate}>
            <Text style={styles.regenerateText}>↺ Regenerate</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Export */}
          <Text style={styles.sectionLabel}>📊 Save to Google Sheets</Text>

          {!exported && (
            <TouchableOpacity
              style={[styles.exportButton, exporting && styles.buttonDisabled]}
              onPress={handleExport}
              disabled={exporting}
            >
              {exporting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <View style={styles.buttonInner}>
                  <Ionicons name="logo-google" size={18} color="#fff" />
                  <Text style={styles.exportButtonText}>Export to Google Sheets</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {exportError && <Text style={styles.errorText}>{exportError}</Text>}

          {exported && (
            <View style={styles.exportSuccess}>
              <Ionicons name="checkmark-circle" size={20} color="#0F9D58" />
              <Text style={styles.exportSuccessText}>Saved to Google Sheets</Text>
            </View>
          )}
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 48 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 2 },
  backText: { color: '#0066CC', fontSize: 15 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '700', color: '#111', lineHeight: 26 },
  bookmarkBtn: { paddingLeft: 12, paddingTop: 2 },
  journal: { fontSize: 13, color: '#666', fontStyle: 'italic', marginBottom: 8 },
  quartileBadge: {
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: 4,
  },
  quartileText: { fontSize: 12, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#0066CC', marginBottom: 10 },
  referenceBox: {
    backgroundColor: '#fffbf0', borderLeftWidth: 3,
    borderLeftColor: '#f0a500', padding: 14, borderRadius: 8, marginBottom: 8,
  },
  referenceText: { fontSize: 13, color: '#333', lineHeight: 20, fontStyle: 'italic' },
  doi: { fontSize: 11, color: '#888', marginTop: 6 },
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  linkText: { color: '#0066CC', fontSize: 14, textDecorationLine: 'underline' },
  abstractText: { fontSize: 14, color: '#333', lineHeight: 22 },
  expandBtn: { paddingTop: 6 },
  expandText: { color: '#0066CC', fontSize: 13, fontFamily: 'monospace' },
  aiButton: {
    borderWidth: 1.5, borderColor: '#0066CC', borderRadius: 10,
    padding: 14, alignItems: 'center',
  },
  aiButtonText: { color: '#0066CC', fontWeight: '600', fontSize: 15 },
  aiLoading: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  sub: { fontSize: 13, color: '#888' },
  errorText: { fontSize: 13, color: 'red', marginTop: 8 },
  subjectBox: { backgroundColor: '#f3e5f5', borderRadius: 10, padding: 14, marginBottom: 10 },
  headlineBox: { backgroundColor: '#e8f5e9', borderRadius: 10, padding: 14, marginBottom: 10 },
  summaryBox: { backgroundColor: '#e3f2fd', borderRadius: 10, padding: 14, marginBottom: 10 },
  boxLabel: { fontSize: 10, fontWeight: '800', color: '#888', letterSpacing: 1, marginBottom: 6 },
  subjectText: { fontSize: 15, fontWeight: '600', color: '#6a1b9a', lineHeight: 22 },
  headlineText: { fontSize: 14, fontWeight: '600', color: '#1b5e20', lineHeight: 22 },
  summaryText: { fontSize: 13, color: '#0d47a1', lineHeight: 22 },
  catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  catTag: {
    backgroundColor: '#e3f2fd', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#90caf9',
  },
  catText: { fontSize: 11, color: '#0066CC', fontWeight: '500' },
  regenerate: { alignSelf: 'flex-end', paddingVertical: 8 },
  regenerateText: { color: '#0066CC', fontSize: 13 },
  exportButton: {
    backgroundColor: '#0F9D58', borderRadius: 10,
    padding: 14, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exportButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  exportSuccess: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  exportSuccessText: { color: '#0F9D58', fontWeight: '600', fontSize: 14 },
});
