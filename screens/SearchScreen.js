import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Switch } from 'react-native';

const DATE_FILTERS = ['Last Month', 'Last Year', 'Last 5 Years', 'All Time'];
const QUARTILE_FILTERS = ['Any', 'Q4', 'Q3', 'Q2', 'Q1'];
const STUDY_TYPES_COUNT = 5;
const STUDY_TYPES = [
  {
    label: 'Systematic Review / Meta-analysis',
    pubmedTag: '(Systematic Review[pt] OR Meta-Analysis[pt] OR "systematic review"[tiab] OR "meta-analysis"[tiab])',
  },
  {
    label: 'Randomised Controlled Trial',
    pubmedTag: '(Randomized Controlled Trial[pt] OR "randomised controlled trial"[tiab] OR "randomized controlled trial"[tiab])',
  },
  {
    label: 'Other Clinical Trial',
    pubmedTag: '(Clinical Trial[pt] OR Controlled Clinical Trial[pt] OR Pragmatic Clinical Trial[pt] OR "clinical trial"[tiab] OR "controlled trial"[tiab]) NOT (Systematic Review[pt] OR Meta-Analysis[pt] OR "systematic review"[tiab] OR "meta-analysis"[tiab] OR Randomized Controlled Trial[pt] OR "randomised controlled trial"[tiab] OR "randomized controlled trial"[tiab])',
  },
  {
    label: 'Case Report',
    pubmedTag: '(Case Reports[pt] OR "case report"[tiab] OR "case series"[tiab]) NOT (Systematic Review[pt] OR Meta-Analysis[pt] OR "systematic review"[tiab] OR "meta-analysis"[tiab] OR Randomized Controlled Trial[pt] OR "randomised controlled trial"[tiab] OR "randomized controlled trial"[tiab] OR Clinical Trial[pt] OR "clinical trial"[tiab])',
  },
  {
    label: 'Other',
    pubmedTag: 'NOT (Systematic Review[pt] OR Meta-Analysis[pt] OR "systematic review"[tiab] OR "meta-analysis"[tiab] OR Randomized Controlled Trial[pt] OR "randomised controlled trial"[tiab] OR "randomized controlled trial"[tiab] OR Clinical Trial[pt] OR "clinical trial"[tiab] OR Case Reports[pt] OR "case report"[tiab] OR "case series"[tiab])',
  },
];

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [dateRange, setDateRange] = useState('All Time');
  const [quartile, setQuartile] = useState('Any');
  const [medlineOnly, setMedlineOnly] = useState(true);
  const [studyTypes, setStudyTypes] = useState(STUDY_TYPES.map(st => st.pubmedTag));

  const toggleStudyType = (tag) => {
    setStudyTypes(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

const handleSearch = () => {
    if (!query.trim()) return;
    navigation.navigate('Results', { query, dateRange, quartile, medlineOnly, studyTypes, totalStudyTypes: STUDY_TYPES.length });
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

      <View style={styles.header}>
        <Text style={styles.logo}>📚</Text>
        <Text style={styles.appName}>Tribulator</Text>
        <Text style={styles.tagline}>Clinical trial search for anaesthesia & critical care</Text>
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. propofol, sepsis, airway..."
          placeholderTextColor="#aaa"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.filterCard}>

        <Text style={styles.filterLabel}>📅 Publication date</Text>
        <View style={styles.filters}>
          {DATE_FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, dateRange === f && styles.chipActive]}
              onPress={() => setDateRange(f)}
            >
              <Text style={[styles.chipText, dateRange === f && styles.chipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.filterLabel}>🏆 Minimum journal quartile</Text>
        <View style={styles.filters}>
          {QUARTILE_FILTERS.map(q => (
            <TouchableOpacity
              key={q}
              style={[styles.chip, quartile === q && styles.chipActive]}
              onPress={() => setQuartile(q)}
            >
              <Text style={[styles.chipText, quartile === q && styles.chipTextActive]}>{q}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.divider} />

        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.filterLabel}>✅ MEDLINE indexed only</Text>
            <Text style={styles.toggleHint}>Journals meeting strict editorial standards</Text>
          </View>
          <Switch
            value={medlineOnly}
            onValueChange={setMedlineOnly}
            trackColor={{ false: '#ccc', true: '#0066CC' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.divider} />

        <Text style={styles.filterLabel}>🔬 Study type</Text>
        <View style={styles.checkboxGroup}>
          {STUDY_TYPES.map(st => (
            <TouchableOpacity
              key={st.pubmedTag}
              style={styles.checkboxRow}
              onPress={() => toggleStudyType(st.pubmedTag)}
            >
              <View style={[styles.checkbox, studyTypes.includes(st.pubmedTag) && styles.checkboxActive]}>
                {studyTypes.includes(st.pubmedTag) && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </View>
              <Text style={styles.checkboxLabel}>{st.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </View>

      <TouchableOpacity style={styles.button} onPress={handleSearch}>
        <Text style={styles.buttonText}>Search Trials</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>Version 2.0      Kieran Gillick</Text>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 48, paddingBottom: 40, backgroundColor: '#f0f4f8', flexGrow: 1 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 64, marginBottom: 8 },
  appName: { fontSize: 32, fontWeight: '800', color: '#0066CC', letterSpacing: 1, marginBottom: 6 },
  tagline: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 18 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, paddingHorizontal: 20, paddingVertical: 4,
    marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  searchIcon: { fontSize: 18, marginRight: 8 },
  input: { flex: 1, fontSize: 16, paddingVertical: 12, paddingLeft: 8, color: '#111' },
  filterCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  filterLabel: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 10, marginTop: 4 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#0066CC', backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#0066CC', borderColor: '#0066CC' },
  chipText: { color: '#0066CC', fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 12 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  toggleHint: { fontSize: 11, color: '#aaa', marginTop: 2 },
  checkboxGroup: { gap: 10, marginBottom: 4 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 22, height: 22, borderRadius: 5, borderWidth: 1.5,
    borderColor: '#0066CC', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  checkboxActive: { backgroundColor: '#0066CC' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkboxLabel: { fontSize: 12, color: '#333' },
  button: {
    backgroundColor: '#0066CC', padding: 16, borderRadius: 14, alignItems: 'center',
    shadowColor: '#0066CC', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },
  footer: { textAlign: 'center', color: '#bbb', fontSize: 12, marginTop: 24 },
});