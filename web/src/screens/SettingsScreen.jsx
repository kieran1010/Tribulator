import { useState, useEffect, useRef, useReducer, useSyncExternalStore } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SETTINGS_KEYS, getSetting, setSetting } from '../lib/storage';
import { exportLibraryToFile, importLibraryFromFile } from '../lib/backup';
import { syncNow, getLastSync, isSyncConfigured, isSyncEnabled, connectDrive, onSyncStateChange } from '../lib/sync';
import { disconnectDrive } from '../lib/googleDrive';
import { subscribeDriveLink, getDriveLinkSnapshot, clearLinkOutcome } from '../lib/driveLink';

// Remembers "Not now" on the Finish setup prompt (this device only).
const FINISH_SETUP_DISMISSED_KEY = 'tribulator_drive_finish_setup_dismissed';
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
  const location = useLocation();
  const driveSectionRef = useRef(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState(null);
  const fileInputRef = useRef(null);

  // Drive sync is one switch: on means connected and always automatic. It's
  // read straight from storage; refresh() re-renders after changing it.
  const [, refresh] = useReducer(n => n + 1, 0);
  const syncEnabled = isSyncEnabled();
  // This device's connection to the Hypnos sign-in server (lib/driveLink.js),
  // including a connection Google has just returned from.
  const link = useSyncExternalStore(subscribeDriveLink, getDriveLinkSnapshot);
  const [showDriveNotice, setShowDriveNotice] = useState(false);
  const [connectStarting, setConnectStarting] = useState(false);
  const [finishSetupDismissed, setFinishSetupDismissed] = useState(
    () => getSetting(FINISH_SETUP_DISMISSED_KEY) === '1'
  );
  // Switching sync on through the server didn't work: offer Google's pop-up.
  const offerPopup = !!link.outcome && !link.outcome.ok && link.outcome.enableSync;
  const [syncing, setSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState('');
  const [lastSync, setLastSync] = useState(null);
  const [syncNotice, setSyncNotice] = useState(null);

  useEffect(() => {
    setAiEnabled(getSetting(SETTINGS_KEYS.AI_ENABLED) === 'true');
    setApiKey(getSetting(SETTINGS_KEYS.API_KEY) || '');
    setLastSync(getLastSync());
  }, []);

  // Keep "Last synced" current when an automatic sync finishes while Settings
  // is open — e.g. the first sync just after connecting. (A connection's
  // result message stays until the next Drive action here clears it.)
  useEffect(() => onSyncStateChange(active => { if (!active) setLastSync(getLastSync()); }), []);

  // Arriving from the backup reminder: bring the Drive section into view and
  // briefly highlight it, so it's clear where to go next.
  const highlightDrive = location.state?.focus === 'drive';
  useEffect(() => {
    if (highlightDrive) driveSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [highlightDrive]);

  // Also the fallback for switching sync on when connecting through the
  // server didn't work: Google's own pop-up, as before.
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
      // runs against a setup that has not been proven to work.
      setSetting(SETTINGS_KEYS.SYNC_ENABLED, 'true');
      clearLinkOutcome();
      refresh();
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

  // Leaves for Google's consent screen; the app comes back to Settings.
  const handleConnect = async ({ enableSync }) => {
    setConnectStarting(true);
    setSyncNotice(null);
    clearLinkOutcome();
    try {
      await connectDrive({ enableSync });
    } catch (e) {
      setSyncNotice({ type: 'error', text: e.message || "Couldn't connect to Google Drive." });
      setConnectStarting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Switch off Google Drive sync? Your papers stay on this device and in Drive.')) return;
    await disconnectDrive();
    setSetting(SETTINGS_KEYS.SYNC_ENABLED, 'false');
    setSetting(SETTINGS_KEYS.DRIVE_FILE_ID, '');
    clearLinkOutcome();
    refresh();
    setSyncNotice({ type: 'success', text: 'Google Drive sync is off.' });
  };

  const toggleDriveSync = () => {
    setSyncNotice(null);
    if (syncEnabled) { handleDisconnect(); return; }
    if (!isSyncConfigured()) {
      setSyncNotice({ type: 'error', text: "Google Drive sync isn't set up in this version of Tribulator." });
      return;
    }
    setShowDriveNotice(true);
  };

  const dismissFinishSetup = () => {
    setSetting(FINISH_SETUP_DISMISSED_KEY, '1');
    setFinishSetupDismissed(true);
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

      <p
        ref={driveSectionRef}
        className="section-title"
        style={{ color: 'var(--navy)', scrollMarginTop: 'calc(var(--header-h) + 16px)' }}
      >
        ☁️ Google Drive sync
      </p>

      <div className={'card section switch-row' + (highlightDrive ? ' highlight' : '')}>
        <div>
          <p className="section-title" style={{ marginBottom: 2 }}>Enable Google Drive sync</p>
          <p className="hint">Keep your library in step across devices</p>
        </div>
        <button
          type="button"
          className={'switch' + (syncEnabled || link.connecting ? ' on' : '')}
          onClick={toggleDriveSync}
          disabled={link.connecting || connectStarting || syncing}
          aria-label="Enable Google Drive sync"
        >
          <span className="switch-knob" />
        </button>
      </div>

      {link.connecting && <p className="hint section">Connecting to Google Drive…</p>}

      {showDriveNotice && !syncEnabled && !link.connecting && (
        <div className="card section">
          <p className="hint" style={{ marginTop: 0 }}>
            Tribulator keeps a copy of your library in your Google Drive. Google Drive access gives Tribulator
            access only to its own files, never to the rest of your data.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 12 }}
            onClick={() => handleConnect({ enableSync: true })}
            disabled={connectStarting}
          >
            {connectStarting ? <span className="spinner" /> : <CloudUpIcon width={18} height={18} />}
            Continue to Google
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setShowDriveNotice(false)} disabled={connectStarting}>
            Cancel
          </button>
        </div>
      )}

      {link.outcome && (
        <p className={link.outcome.ok ? 'hint section' : 'error-text section'}>{link.outcome.message}</p>
      )}

      {offerPopup && !syncEnabled && (
        <button type="button" className="btn btn-outline section" onClick={handleSyncNow} disabled={syncing}>
          {syncing ? <span className="spinner" /> : null}
          {syncing ? (syncStep || 'Syncing...') : "Use Google's pop-up instead"}
        </button>
      )}

      {syncEnabled && (
        <>
          {!link.connected && !finishSetupDismissed && (
            <div className="card section">
              <p className="section-title" style={{ marginBottom: 2 }}>Sync without Google's pop-up</p>
              <p className="hint">Connect this device once more, and Tribulator won't need Google's sign-in pop-up here again.</p>
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: 12 }}
                onClick={() => handleConnect({ enableSync: false })}
                disabled={connectStarting}
              >
                {connectStarting ? <span className="spinner" /> : null}
                Finish setup
              </button>
              <button type="button" className="btn btn-ghost" onClick={dismissFinishSetup} disabled={connectStarting}>
                Not now
              </button>
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary section"
            onClick={handleSyncNow}
            disabled={syncing}
          >
            {syncing ? <span className="spinner" /> : <CloudUpIcon width={18} height={18} />}
            {syncing ? (syncStep || 'Syncing...') : 'Sync now'}
          </button>

          <p className="hint">Last synced {formatWhen(lastSync)}.</p>
        </>
      )}

      {syncNotice && (
        <p className={syncNotice.type === 'error' ? 'error-text' : 'hint'} style={{ marginTop: 12 }}>
          {syncNotice.text}
        </p>
      )}

      <p className="build-stamp">{buildLabel()}</p>
    </div>
  );
}
