import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, ActivityIndicator, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getSetting, setSetting, SETTINGS_KEYS } from '../settings';
import { DEFAULT_IMPACT_FACTORS } from '../constants';

export default function ImpactFactorsScreen() {
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const custom = await getSetting(SETTINGS_KEYS.IMPACT_FACTORS);
      if (custom) {
        const parsed = custom.split('\n')
          .map(line => {
            const [name, value] = line.split('=').map(s => s.trim());
            return { name: name || '', value: value || '' };
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

  const handleFetchLatest = async () => {
    Alert.alert(
      'Update Impact Factors',
      'This will use Claude to search for current journal impact factors. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            setUpdating(true);
            try {
              const apiKey = await getSetting(SETTINGS_KEYS.API_KEY);
              if (!apiKey) throw new Error('No API key set in settings');

              const journalNames = journals.map(j => j.name).join('\n');

              const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-api-key': apiKey,
                  'anthropic-version': '2023-06-01',
                  'anthropic-dangerous-direct-browser-access': 'true',
                },
                body: JSON.stringify({
                  model: 'claude-sonnet-4-20250514',
                  max_tokens: 4096,
                  tools: [{ type: 'web_search_20250305', name: 'web_search' }],
                  messages: [{
                    role: 'user',
                    content: `Search the web for the most recent journal impact factors (JIF) for these journals. Return ONLY a JSON array with no other text:\n[{"name": "journal name lowercase", "value": "impact factor as number"}]\n\nJournals:\n${journalNames}`,
                  }],
                }),
              });

              const data = await res.json();
              if (data.error) throw new Error(data.error.message);

              const textBlock = data.content?.find(b => b.type === 'text');
              if (!textBlock) throw new Error('No response from Claude');

              const clean = textBlock.text.replace(/```json|```/g, '').trim();
              const parsed = JSON.parse(clean);

              if (!Array.isArray(parsed)) throw new Error('Invalid response format');

              setJournals(parsed.map(j => ({ name: j.name, value: String(j.value) })));
              Alert.alert('Done', 'Impact factors updated. Press Save to keep the changes.');
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to fetch impact factors.');
            } finally {
              setUpdating(false);
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
      <TouchableOpacity
        style={[styles.updateButton, updating && styles.buttonDisabled]}
        onPress={handleFetchLatest}
        disabled={updating}
      >
        {updating ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <View style={styles.buttonInner}>
            <Ionicons name="cloud-download-outline" size={18} color="#fff" />
            <Text style={styles.updateButtonText}>Fetch Latest via Claude</Text>
          </View>
        )}
      </TouchableOpacity>

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
          <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
            <Ionicons name="add-circle-outline" size={18} color="#0066CC" />
            <Text style={styles.addButtonText}>Add Journal</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.saveContainer}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Ionicons name={saved ? 'checkmark-circle' : 'save-outline'} size={18} color="#fff" />
          <Text style={styles.saveButtonText}>{saved ? 'Saved!' : 'Save Changes'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  updateButton: {
    backgroundColor: '#0066CC', margin: 16, borderRadius: 10,
    padding: 14, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  updateButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  listHeader: { fontSize: 12, color: '#888', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 10, fontSize: 13, backgroundColor: '#fff',
  },
  nameInput: { flex: 1 },
  ifInput: { width: 64, textAlign: 'center' },
  deleteBtn: { padding: 6 },
  addButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    padding: 14, justifyContent: 'center',
  },
  addButtonText: { color: '#0066CC', fontSize: 14, fontWeight: '600' },
  saveContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, backgroundColor: '#f8f9fa',
    borderTopWidth: 1, borderTopColor: '#eee',
  },
  saveButton: {
    backgroundColor: '#0F9D58', borderRadius: 10,
    padding: 14, alignItems: 'center', flexDirection: 'row',
    justifyContent: 'center', gap: 8,
  },
  saveButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
