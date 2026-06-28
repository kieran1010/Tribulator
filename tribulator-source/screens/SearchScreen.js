import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Switch } from 'react-native';
import { DATE_FILTERS, QUARTILE_FILTERS, STUDY_TYPES } from '../constants';

export default function SearchScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [dateRange, setDateRange] = useState('All Time');
  const [minQuartile, setMinQuartile] = useState('Any');
  const [medlineOnly, setMedlineOnly] = useState(true);
  const [studyTypes, setStudyTypes] = useState(STUDY_TYPES.map(t => t.id));

  const toggleStudyType = (id) => {
    setStudyTypes(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleSearch = () => {
    if (!query.trim()) return;
    navigation.navigate('Results', {
      query,
      filters: { dateRange, minQuartile, medlineOnly, studyTypes },
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="e.g. propofol, sepsis, airway..."
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        onSubmitEditing={handleSearch}
        autoCapitalize="none"
      />

      {/* Publication date */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📅 Publication date</Text>
        <View style={styles.chips}>
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
      </View>

      {/* Minimum quartile */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏆 Minimum journal quartile</Text>
        <View style={styles.chips}>
          {QUARTILE_FILTERS.map(q => (
            <TouchableOpacity
              key={q}
              style={[styles.chip, minQuartile === q && styles.chipActive]}
              onPress={() => setMinQuartile(q)}
            >
              <Text style={[styles.chipText, minQuartile === q && styles.chipTextActive]}>{q}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* MEDLINE indexed */}
      <View style={[styles.section, styles.row]}>
        <View style={styles.flex1}>
          <Text style={styles.sectionTitle}>✅ MEDLINE indexed only</Text>
          <Text style={styles.hint}>Journals meeting strict editorial standards</Text>
        </View>
        <Switch
          value={medlineOnly}
          onValueChange={setMedlineOnly}
          trackColor={{ true: '#0066CC' }}
        />
      </View>

      {/* Study type */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔬 Study type</Text>
        {STUDY_TYPES.map(type => (
          <TouchableOpacity
            key={type.id}
            style={styles.checkRow}
            onPress={() => toggleStudyType(type.id)}
          >
            <View style={[styles.checkbox, studyTypes.includes(type.id) && styles.checkboxActive]}>
              {studyTypes.includes(type.id) && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>{type.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={handleSearch}>
        <Text style={styles.buttonText}>Search Trials</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Version 2.0    Kieran Gillick</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 12,
    padding: 14, fontSize: 16, marginBottom: 20, backgroundColor: '#fff',
  },
  section: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04,
    shadowRadius: 4, elevation: 1,
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#111', marginBottom: 12 },
  hint: { fontSize: 12, color: '#888', marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#0066CC',
  },
  chipActive: { backgroundColor: '#0066CC' },
  chipText: { color: '#0066CC', fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex1: { flex: 1 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  checkbox: {
    width: 22, height: 22, borderRadius: 4, borderWidth: 2,
    borderColor: '#0066CC', alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: '#0066CC' },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkLabel: { fontSize: 14, color: '#333', flex: 1 },
  button: {
    backgroundColor: '#0066CC', padding: 16,
    borderRadius: 12, alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  version: { textAlign: 'center', color: '#aaa', fontSize: 12, marginTop: 24 },
});
