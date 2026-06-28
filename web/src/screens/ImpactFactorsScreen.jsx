import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSetting, setSetting, SETTINGS_KEYS } from '../lib/storage';
import { DEFAULT_IMPACT_FACTORS } from '../lib/constants';
import { fetchLatestImpactFactors } from '../lib/aiApi';
import { ArrowLeftIcon, TrashIcon, PlusIcon, CloudDownIcon, CheckCircleIcon } from '../components/Icon';

export default function ImpactFactorsScreen() {
  const navigate = useNavigate();
  const [journals, setJournals] = useState([]);
  const [updating, setUpdating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const custom = getSetting(SETTINGS_KEYS.IMPACT_FACTORS);
    if (custom) {
      const parsed = custom.split('\n')
        .map(line => {
          const [name, value] = line.split('=').map(s => s.trim());
          return { name: name || '', value: value || '' };
        })
        .filter(j => j.name);
      setJournals(parsed);
    } else {
      setJournals(Object.entries(DEFAULT_IMPACT_FACTORS).map(([name, value]) => ({ name, value: String(value) })));
    }
  }, []);

  const handleUpdate = (index, field, value) => {
    setJournals(prev => prev.map((j, i) => (i === index ? { ...j, [field]: value } : j)));
  };

  const handleAdd = () => setJournals(prev => [...prev, { name: '', value: '' }]);
  const handleDelete = index => setJournals(prev => prev.filter((_, i) => i !== index));

  const handleSave = () => {
    const text = journals.filter(j => j.name.trim()).map(j => `${j.name.trim()} = ${j.value.trim()}`).join('\n');
    setSetting(SETTINGS_KEYS.IMPACT_FACTORS, text);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleFetchLatest = async () => {
    if (!confirm('This will use Claude to search for current journal impact factors. Continue?')) return;
    setUpdating(true);
    setError(null);
    try {
      const updated = await fetchLatestImpactFactors(journals.map(j => j.name));
      setJournals(updated);
      alert('Impact factors updated. Press Save to keep the changes.');
    } catch (e) {
      setError(e.message || 'Failed to fetch impact factors.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div>
      <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 8 }}>
        <ArrowLeftIcon width={16} height={16} />
        Back to Settings
      </button>

      <button type="button" className="btn btn-primary section" onClick={handleFetchLatest} disabled={updating}>
        {updating ? <span className="spinner" /> : <CloudDownIcon width={18} height={18} />}
        {updating ? 'Updating...' : 'Fetch Latest via Claude'}
      </button>
      {error && <p className="error-text section">{error}</p>}

      <p className="hint" style={{ marginBottom: 12 }}>{journals.length} journals</p>

      {journals.map((j, index) => (
        <div key={index} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
          <input
            type="text"
            placeholder="Journal name"
            value={j.name}
            onChange={e => handleUpdate(index, 'name', e.target.value)}
            autoCapitalize="none"
            style={{ flex: 1 }}
          />
          <input
            type="text"
            placeholder="IF"
            value={j.value}
            onChange={e => handleUpdate(index, 'value', e.target.value)}
            inputMode="decimal"
            style={{ width: 70, textAlign: 'center' }}
          />
          <button type="button" onClick={() => handleDelete(index)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 8 }}>
            <TrashIcon width={18} height={18} />
          </button>
        </div>
      ))}

      <button type="button" className="btn btn-ghost" onClick={handleAdd} style={{ margin: '8px 0 24px' }}>
        <PlusIcon width={16} height={16} />
        Add Journal
      </button>

      <button type="button" className="btn btn-success" onClick={handleSave}>
        {saved ? <CheckCircleIcon width={18} height={18} /> : null}
        {saved ? 'Saved!' : 'Save Changes'}
      </button>
    </div>
  );
}
