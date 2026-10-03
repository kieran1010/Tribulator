import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SETTINGS_KEYS, getSetting, setSetting } from '../lib/storage';
import { exportLibraryToFile, importLibraryFromFile } from '../lib/backup';
import { syncNow, getLastSync, isSyncConfigured } from '../lib/sync';
import { revokeToken } from '../lib/googleDrive';
import { buildLabel } from '../lib/build';
import { CloudDownIcon, CloudUpIcon, CheckCircleIcon, SparklesIcon } from '../components/Icon';

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
  const navigate = useNavigate();
  const [aiEnabled, setAiEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState(null);
  const fileInputRef = useRef(null);

  const [syncEnabled, setSyncEnabled] = useState(false);
  // Whether the sync configuration is expanded. Purely a display state, kept
  // separate from syncEnabled (the real on/off flag) — it just decides
  // whether the sync controls are shown, the same way the
  // AI section stays collapsed until "Enable AI features" is switched on.
  const [syncSectionOpen, setSyncSectionOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState('');
  const [lastSync, setLastSync] = useState(null);
  const [syncNotice, setSyncNotice] = useState(null);

  useEffect(() => {
    setAiEnabled(getSetting(SETTINGS_KEYS.AI_ENABLED) === 'true');
    setApiKey(getSetting(SETTINGS_KEYS.API_KEY) || '');
    const savedSyncEnabled = getSetting(SETTINGS_KEYS.SYNC_ENABLED) === 'true';
    setSyncEnabled(savedSyncEnabled);
    // Already set up on this device — open expanded rather than hiding a
    // working configuration behind a switch that reads as off. A linked Drive
    // file counts even if auto-sync was switched off inside the panel.
    setSyncSectionOpen(savedSyncEnabled || !!getSetting(SETTINGS_KEYS.DRIVE_FILE_ID));
    setLastSync(getLastSync());
  }, []);

  const handleSyncNow = async () => {
    if (!isSyncConfigured()) {
      setSyncNotice({ type: 'error', text: "Google Drive sync isn't set up in this version of Tribulator." });
      return;
    }

    setSyncing(true);
    setSyncNotice(null);
    try {
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
    if (!confirm('Disconnect Google Drive? Your papers stay on this device and in Drive.')) return false;
    await revokeToken();
    setSetting(SETTINGS_KEYS.SYNC_ENABLED, 'false');
    setSetting(SETTINGS_KEYS.DRIVE_FILE_ID, '');
    setSyncEnabled(false);
    setSyncNotice({ type: 'success', text: 'Disconnected.' });
    return true;
  };

  const toggleSync = () => {
    const next = !syncEnabled;
    setSyncEnabled(next);
    setSetting(SETTINGS_KEYS.SYNC_ENABLED, next ? 'true' : 'false');
  };

  // Collapsing the section while a real connection is live would hide it
  // while it keeps syncing in the background, which reads as "off" when it
  // isn't — so that case goes through the same disconnect flow as the
  // explicit button instead of just hiding the panel.
  const toggleSyncSection = async () => {
    if (syncSectionOpen) {
      // Still connected (auto-sync on, or a Drive file linked with auto-sync
      // switched off) — closing must disconnect, or the panel would reopen
      // next visit.
      if (syncEnabled || getSetting(SETTINGS_KEYS.DRIVE_FILE_ID)) {
        const disconnected = await handleDisconnect();
        if (disconnected) setSyncSectionOpen(false);
        return;
      }
      setSyncSectionOpen(false);
      return;
    }
    // Persist straight away: this switch is what the user sees as "on", so it
    // must survive leaving Settings even if they never reach a successful sync.
    // Auto-sync is silent and fails quietly, so an unproven setup does no harm.
    setSetting(SETTINGS_KEYS.SYNC_ENABLED, 'true');
    setSyncEnabled(true);
    setSyncSectionOpen(true);
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

      <button type="button" className="btn btn-outline section" style={{ marginTop: 12 }} onClick={() => navigate('/optimise')}>
        <SparklesIcon width={18} height={18} />
        Optimise Library
      </button>

      {notice && (
        <p className={notice.type === 'error' ? 'error-text' : 'hint'} style={{ marginTop: 12 }}>{notice.text}</p>
      )}

      <div className="divider" />

      <p className="section-title" style={{ color: 'var(--navy)' }}>☁️ Google Drive sync</p>

      <div className="card section switch-row">
        <div>
          <p className="section-title" style={{ marginBottom: 2 }}>Enable Google Drive sync</p>
          <p className="hint">Keep your library in step across devices</p>
        </div>
        <button
          type="button"
          className={'switch' + (syncSectionOpen ? ' on' : '')}
          onClick={toggleSyncSection}
          aria-label="Enable Google Drive sync"
        >
          <span className="switch-knob" />
        </button>
      </div>

      {syncSectionOpen && (
        <>
          <p className="hint section">
            Keeps your library in step across devices through a single
            <code> tribulator-library.json </code>
            file in your Drive. Tribulator can only see the file it created, never the rest of your Drive.
          </p>

          {!isSyncConfigured() && (
            <p className="hint section">Google Drive sync isn't set up in this version of Tribulator.</p>
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
              disabled={!isSyncConfigured()}

              aria-label="Sync automatically"
            >
              <span className="switch-knob" />
            </button>
          </div>

          <button
            type="button"
            className="btn btn-primary section"
            onClick={handleSyncNow}
            disabled={syncing || !isSyncConfigured()}
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
        </>
      )}

      <p className="build-stamp">{buildLabel()}</p>
    </div>
  );
}
