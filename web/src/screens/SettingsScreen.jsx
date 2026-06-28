import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SETTINGS_KEYS, getSetting, setSetting, clearBookmarks } from '../lib/storage';
import { loadBootstrapConfig } from '../lib/sheetsApi';
import { CloudDownIcon, CheckCircleIcon, ChevronRight, TrashIcon } from '../components/Icon';

export default function SettingsScreen() {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [saved, setSaved] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [configNotice, setConfigNotice] = useState(null);

  useEffect(() => {
    setApiKey(getSetting(SETTINGS_KEYS.API_KEY) || '');
    setWebhookUrl(getSetting(SETTINGS_KEYS.WEBHOOK_URL) || '');
    setSpreadsheetId(getSetting(SETTINGS_KEYS.SPREADSHEET_ID) || '');
  }, []);

  const handleSave = () => {
    setSetting(SETTINGS_KEYS.API_KEY, apiKey.trim());
    setSetting(SETTINGS_KEYS.WEBHOOK_URL, webhookUrl.trim());
    setSetting(SETTINGS_KEYS.SPREADSHEET_ID, spreadsheetId.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLoadFromSpreadsheet = async () => {
    setLoadingConfig(true);
    setConfigNotice(null);
    try {
      const data = await loadBootstrapConfig();
      if (data.apiKey) { setApiKey(data.apiKey); setSetting(SETTINGS_KEYS.API_KEY, data.apiKey); }
      if (data.webhookUrl) { setWebhookUrl(data.webhookUrl); setSetting(SETTINGS_KEYS.WEBHOOK_URL, data.webhookUrl); }
      if (data.spreadsheetId) { setSpreadsheetId(data.spreadsheetId); setSetting(SETTINGS_KEYS.SPREADSHEET_ID, data.spreadsheetId); }
      setConfigNotice({ type: 'success', text: 'Settings updated from config spreadsheet.' });
    } catch (e) {
      setConfigNotice({ type: 'error', text: e.message });
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleClearBookmarks = () => {
    if (!confirm('This will permanently delete all saved papers. Are you sure?')) return;
    clearBookmarks();
    alert('All bookmarks cleared.');
  };

  return (
    <div>
      <button type="button" className="btn btn-primary section" onClick={handleLoadFromSpreadsheet} disabled={loadingConfig}>
        {loadingConfig ? <span className="spinner" /> : <CloudDownIcon width={18} height={18} />}
        {loadingConfig ? 'Loading...' : 'Load Config from Spreadsheet'}
      </button>
      {configNotice && (
        <p className={configNotice.type === 'error' ? 'error-text' : 'hint'} style={{ marginBottom: 16 }}>{configNotice.text}</p>
      )}

      <p className="section-title" style={{ color: 'var(--navy)' }}>🔑 Anthropic API Key</p>
      <input
        type="password"
        placeholder="sk-ant-..."
        value={apiKey}
        onChange={e => setApiKey(e.target.value)}
        autoCapitalize="none"
        className="section"
      />

      <p className="section-title" style={{ color: 'var(--navy)' }}>📡 Apps Script Webhook URL</p>
      <input
        type="text"
        placeholder="https://script.google.com/macros/s/..."
        value={webhookUrl}
        onChange={e => setWebhookUrl(e.target.value)}
        autoCapitalize="none"
        className="section"
      />

      <p className="section-title" style={{ color: 'var(--navy)' }}>📊 Google Spreadsheet ID</p>
      <input
        type="text"
        placeholder="1wJZmg..."
        value={spreadsheetId}
        onChange={e => setSpreadsheetId(e.target.value)}
        autoCapitalize="none"
        className="section"
      />

      <button type="button" className="btn btn-primary" onClick={handleSave}>
        {saved ? <CheckCircleIcon width={18} height={18} /> : null}
        {saved ? 'Saved!' : 'Save Settings'}
      </button>

      <div className="divider" />

      <p className="section-title" style={{ color: 'var(--navy)' }}>📈 Journal Impact Factors</p>
      <button
        type="button"
        className="card"
        onClick={() => navigate('/settings/impact-factors')}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ flex: 1, fontWeight: 600, color: 'var(--navy)' }}>Edit Journal Impact Factors</span>
        <ChevronRight width={16} height={16} style={{ color: 'var(--text-muted)' }} />
      </button>

      <div className="divider" />

      <p className="section-title" style={{ color: 'var(--navy)' }}>🗑 Data</p>
      <button type="button" className="btn btn-danger" onClick={handleClearBookmarks}>
        <TrashIcon width={18} height={18} />
        Clear All Bookmarks
      </button>

      <div className="divider" />

      <div className="card" style={{ textAlign: 'center', background: 'var(--bg)' }}>
        <p style={{ fontWeight: 700, margin: '0 0 4px' }}>Tribulator</p>
        <p className="hint">Version 2.0 (Web)</p>
        <p className="hint">Clinical trial search &amp; summarisation</p>
        <p className="hint">for anaesthesia &amp; critical care</p>
        <p className="hint">Kieran Gillick</p>
      </div>
    </div>
  );
}
