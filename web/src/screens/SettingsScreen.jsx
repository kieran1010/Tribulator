import { useState, useEffect, useRef } from 'react';
import { SETTINGS_KEYS, getSetting, setSetting } from '../lib/storage';
import { exportLibraryToFile, importLibraryFromFile } from '../lib/backup';
import { CloudDownIcon, CloudUpIcon, CheckCircleIcon } from '../components/Icon';

export default function SettingsScreen() {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setAiEnabled(getSetting(SETTINGS_KEYS.AI_ENABLED) === 'true');
    setApiKey(getSetting(SETTINGS_KEYS.API_KEY) || '');
  }, []);

  const handleSave = () => {
    setSetting(SETTINGS_KEYS.AI_ENABLED, aiEnabled ? 'true' : 'false');
    setSetting(SETTINGS_KEYS.API_KEY, apiKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExport = async () => {
    setExporting(true);
    setNotice(null);
    try {
      const count = await exportLibraryToFile();
      setNotice({ type: 'success', text: `Exported ${count} paper${count !== 1 ? 's' : ''}.` });
    } catch (e) {
      setNotice({ type: 'error', text: 'Export failed: ' + e.message });
    } finally {
      setExporting(false);
    }
  };

  const handleImportFile = async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setNotice(null);
    try {
      const { imported, skipped } = await importLibraryFromFile(file);
      setNotice({ type: 'success', text: `Imported ${imported}, skipped ${skipped} duplicate${skipped !== 1 ? 's' : ''}.` });
    } catch (e) {
      setNotice({ type: 'error', text: 'Import failed: ' + e.message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <p className="section-title" style={{ color: 'var(--navy)' }}>🤖 AI Features</p>

      <div className="card section switch-row">
        <div>
          <p className="section-title" style={{ marginBottom: 2 }}>Enable AI features</p>
          <p className="hint">AI summary &amp; tag generation via the Anthropic API</p>
        </div>
        <button
          type="button"
          className={'switch' + (aiEnabled ? ' on' : '')}
          onClick={() => setAiEnabled(v => !v)}
          aria-label="Enable AI features"
        >
          <span className="switch-knob" />
        </button>
      </div>

      {aiEnabled && (
        <div className="section">
          <input
            type="password"
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            autoCapitalize="none"
          />
          <p className="hint">Your Anthropic API key, stored locally on this device.</p>
        </div>
      )}

      <button type="button" className="btn btn-primary" onClick={handleSave}>
        {saved ? <CheckCircleIcon width={18} height={18} /> : null}
        {saved ? 'Saved!' : 'Save Settings'}
      </button>

      <div className="divider" />

      <p className="section-title" style={{ color: 'var(--navy)' }}>📁 Data</p>

      <button type="button" className="btn btn-outline section" onClick={handleExport} disabled={exporting}>
        {exporting ? <span className="spinner" /> : <CloudDownIcon width={18} height={18} />}
        Export Library
      </button>

      <button type="button" className="btn btn-outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
        {importing ? <span className="spinner" /> : <CloudUpIcon width={18} height={18} />}
        Import Library
      </button>
      <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportFile} style={{ display: 'none' }} />

      {notice && (
        <p className={notice.type === 'error' ? 'error-text' : 'hint'} style={{ marginTop: 12 }}>{notice.text}</p>
      )}
    </div>
  );
}
