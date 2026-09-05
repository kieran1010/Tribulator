import { useState, useEffect, useRef } from 'react';
import { SETTINGS_KEYS, getSetting, setSetting } from '../lib/storage';
import { exportLibraryToFile, importLibraryFromFile } from '../lib/backup';
import { syncNow, getLastSync, isSyncConfigured } from '../lib/sync';
import { revokeToken, normaliseClientId, clientIdProblem } from '../lib/googleDrive';
import { CloudDownIcon, CloudUpIcon, CheckCircleIcon } from '../components/Icon';

function formatWhen(iso) {
  if (!iso) return 'never';
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function SettingsScreen() {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState(null);
  const fileInputRef = useRef(null);

  const [clientId, setClientId] = useState('');
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState('');
  const [lastSync, setLastSync] = useState(null);
  const [syncNotice, setSyncNotice] = useState(null);
  const [showSyncHelp, setShowSyncHelp] = useState(false);

  useEffect(() => {
    setAiEnabled(getSetting(SETTINGS_KEYS.AI_ENABLED) === 'true');
    setApiKey(getSetting(SETTINGS_KEYS.API_KEY) || '');
    setClientId(getSetting(SETTINGS_KEYS.GOOGLE_CLIENT_ID) || '');
    setSyncEnabled(getSetting(SETTINGS_KEYS.SYNC_ENABLED) === 'true');
    setLastSync(getLastSync());
  }, []);

  const handleSyncNow = async () => {
    // Check the client ID here so an obvious problem reads as a sentence
    // rather than as Google's "invalid_client" error page.
    const problem = clientIdProblem(clientId);
    if (problem) {
      setSyncNotice({ type: 'error', text: problem });
      return;
    }

    setSyncing(true);
    setSyncNotice(null);
    try {
      const cleaned = normaliseClientId(clientId);
      setClientId(cleaned);
      setSetting(SETTINGS_KEYS.GOOGLE_CLIENT_ID, cleaned);
      const result = await syncNow({ interactive: true, onStep: setSyncStep });
      setLastSync(result.at);
      // Switching sync on only after the first success means auto-sync never
      // runs against a client ID that has not been proven to work.
      setSetting(SETTINGS_KEYS.SYNC_ENABLED, 'true');
      setSyncEnabled(true);
      setSyncNotice({
        type: 'success',
        text: `Synced ${result.total} paper${result.total === 1 ? '' : 's'}` +
          (result.added ? `, ${result.added} new from another device` : '') + '.',
      });
    } catch (e) {
      setSyncNotice({ type: 'error', text: e.message });
    } finally {
      setSyncing(false);
      setSyncStep('');
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Google Drive? Your papers stay on this device and in Drive.')) return;
    await revokeToken();
    setSetting(SETTINGS_KEYS.SYNC_ENABLED, 'false');
    setSetting(SETTINGS_KEYS.DRIVE_FILE_ID, '');
    setSyncEnabled(false);
    setSyncNotice({ type: 'success', text: 'Disconnected.' });
  };

  const toggleSync = () => {
    const next = !syncEnabled;
    setSyncEnabled(next);
    setSetting(SETTINGS_KEYS.SYNC_ENABLED, next ? 'true' : 'false');
  };

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

      <div className="divider" />

      <p className="section-title" style={{ color: 'var(--navy)' }}>☁️ Google Drive sync</p>

      <p className="hint section">
        Keeps your library in step across devices through a single
        <code> tribulator-library.json </code>
        file in your Drive. Tribulator can only see the file it created, never the rest of your Drive.
      </p>

      <div className="section">
        <input
          type="text"
          placeholder="000000000000-xxxx.apps.googleusercontent.com"
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          autoCapitalize="none"
          spellCheck={false}
        />
        <p className="hint">
          Your Google OAuth client ID.{' '}
          <button type="button" className="link-button" onClick={() => setShowSyncHelp(v => !v)}>
            {showSyncHelp ? 'Hide setup steps' : 'How do I get one?'}
          </button>
        </p>
      </div>

      {showSyncHelp && (
        <div className="card section">
          <p className="hint" style={{ marginTop: 0 }}>
            One-off, and free:
          </p>
          <ol className="hint" style={{ paddingLeft: 18, margin: '8px 0 0', lineHeight: 1.7 }}>
            <li>At <strong>console.cloud.google.com</strong>, create a project.</li>
            <li>Enable the <strong>Google Drive API</strong> for it.</li>
            <li>
              Configure the OAuth consent screen as <strong>External</strong>, and add your own
              Google address as a test user.
            </li>
            <li>
              Create an <strong>OAuth client ID</strong> of type <strong>Web application</strong>, with
              <code> https://tribulator.hypnos.one </code> as an authorised JavaScript origin.
            </li>
            <li>Paste the client ID above and tap Sync now.</li>
          </ol>
          <p className="hint" style={{ marginBottom: 0 }}>
            The <code>drive.file</code> scope this uses is non-sensitive, so Google does not require
            the app to go through verification.
          </p>
        </div>
      )}

      <div className="card section switch-row">
        <div>
          <p className="section-title" style={{ marginBottom: 2 }}>Sync automatically</p>
          <p className="hint">On launch, and after each change to your library</p>
        </div>
        <button
          type="button"
          className={'switch' + (syncEnabled ? ' on' : '')}
          onClick={toggleSync}
          disabled={!isSyncConfigured() && !clientId.trim()}
          aria-label="Sync automatically"
        >
          <span className="switch-knob" />
        </button>
      </div>

      <button
        type="button"
        className="btn btn-primary section"
        onClick={handleSyncNow}
        disabled={syncing || !clientId.trim()}
      >
        {syncing ? <span className="spinner" /> : <CloudUpIcon width={18} height={18} />}
        {syncing ? (syncStep || 'Syncing...') : 'Sync now'}
      </button>

      <p className="hint">Last synced {formatWhen(lastSync)}.</p>

      {syncEnabled && (
        <button type="button" className="btn btn-ghost" onClick={handleDisconnect}>
          Disconnect Google Drive
        </button>
      )}

      {syncNotice && (
        <p className={syncNotice.type === 'error' ? 'error-text' : 'hint'} style={{ marginTop: 12 }}>
          {syncNotice.text}
        </p>
      )}
    </div>
  );
}
