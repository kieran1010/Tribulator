import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSetting, setSetting, SETTINGS_KEYS } from '../settings';
import { DEFAULT_IMPACT_FACTORS } from '../constants';

export default function ImpactFactorsScreen() {
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const custom = await getSetting(SETTINGS_KEYS.IMPACT_FACTORS);
      if (custom) {
        const parsed = custom.split('\n')
          .map(line => {
            const [name, value] = line.split('=').map(s => s.trim());
            return { name, value: value || '' };
          })
          .filter(j => j.name);
        setJournals(parsed);
      } else {
        const defaults = Object.entries(DEFAULT_IMPACT_FACTORS).map(([name, value]) => ({
          name,
          value: String(value),
        }));
        setJournals(defaults);
      }
      setLoading(false);
    })();
  }, []);

  const handleUpdate = (index, field, value) => {
    const updated = [...journals];
    updated[index] = { ...updated[index], [field]: value };
    setJournals(updated);
  };

  const handleAdd = () => {
    setJournals([...journals, { name: '', value: '' }]);
  };

  const handleDelete = (index) => {
    setJournals(journals.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const text = journals
      .filter(j => j.name.trim())
      .map(j => `${j.name.trim()} = ${j.value.trim()}`)
      .join('\n');
    await setSetting(SETTINGS_KEYS.IMPACT_FACTORS, text);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#0066CC" />
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={journals}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListHeaderComponent={
          <Text style={styles.listHeader}>{journals.length} journals</Text>
        }
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.nameInput]}
              value={item.name}
              onChangeText={v => handleUpdate(index, 'name', v)}
              placeholder="Journal name"
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, styles.ifInput]}
              value={item.value}
              onChangeText={v => handleUpdate(index, 'value', v)}
              placeholder="IF"
              keyboardType="decimal-pad"
            />
            <TouchableOpacity onPress={() => handleDelete(index)} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={18} color="#c62828" />
            </TouchableOpacity>
          </View>
        )}
        ListFooterComponent={
          <View>
            <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
              <Ionicons name="add-circle-outline" size={18} color="#0066CC" />
              <Text style={styles.addButtonText}>Add Journal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Ionicons name={saved ? 'checkmark-circle' : 'save-outline'} size={18} color="#fff" />
              <Text style={styles.saveButtonText}>{saved ? 'Saved!' : 'Save Changes'}</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listHeader: { fontSize: 13, color: '#666', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  input: {
    borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
    padding: 10, fontSize: 13, backgroundColor: '#fff',
  },
  nameInput: { flex: 1 },
  ifInput: { width: 60, textAlign: 'center' },
  deleteBtn: { padding: 6 },
  addButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: 14, justifyContent: 'center',
  },
  addButtonText: { color: '#0066CC', fontSize: 14, fontWeight: '600' },
  saveButton: {
    backgroundColor: '#0F9D58', borderRadius: 10,
    padding: 14, alignItems: 'center', flexDirection: 'row',
    justifyContent: 'center', gap: 8, marginBottom: 16,
  },
  saveButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});