import { getAllRecords, applyMergedRecords, purgeExpiredTombstones, onMutation } from './db';
import { mergeLibraries, toSyncDocument, papersFromSyncDocument } from './merge';
import { SETTINGS_KEYS, getSetting, setSetting } from './storage';
import {
  normaliseClientId,
  getAccessToken,
  hasLiveToken,
  findLibraryFile,
  getFileMetadata,
  readFile,
  createFile,
  updateFile,
} from './googleDrive';

// A sync that starts while another is mid-flight would merge against a stale
// read, so callers share the one in-flight promise instead.
let inFlight = null;

// A non-interactive token refresh still involves a brief pop to Google's own
// domain and back — Google's identity library has no fully silent path, even
// with no UI requested — so anything that runs during an automatic sync
// (launch, after an edit, on reconnect) can surface unexplained. Screens
// subscribe here to show a small "syncing" cue instead, so that flash reads
// as part of something the app is doing rather than an unexplained jump.
const syncStateListeners = new Set();
let syncing = false;

export function onSyncStateChange(listener) {
  syncStateListeners.add(listener);
  return () => syncStateListeners.delete(listener);
}

export function isSyncing() {
  return syncing;
}

function setSyncing(value) {
  if (syncing === value) return;
  syncing = value;
  syncStateListeners.forEach(l => {
    try { l(value); } catch { /* a listener must never break a sync */ }
  });
}

// A client ID baked in at build time (a GitHub Actions variable). A Google
// client ID is public by design, so shipping it in the bundle is safe and saves
// pasting a 70-character string onto every device.
const BUILD_CLIENT_ID = normaliseClientId(import.meta.env?.VITE_GOOGLE_CLIENT_ID || '');

export function hasBuiltInClientId() {
  return !!BUILD_CLIENT_ID;
}

// Anything pasted on this device overrides the built-in one.
export function getClientId() {
  return getSetting(SETTINGS_KEYS.GOOGLE_CLIENT_ID) || BUILD_CLIENT_ID;
}

export function isSyncConfigured() {
  return !!getClientId();
}

export function isSyncEnabled() {
  return isSyncConfigured() && getSetting(SETTINGS_KEYS.SYNC_ENABLED) === 'true';
}

export function getLastSync() {
  return getSetting(SETTINGS_KEYS.LAST_SYNC);
}

async function resolveLibraryFile(token) {
  const knownId = getSetting(SETTINGS_KEYS.DRIVE_FILE_ID);
  if (knownId) {
    try {
      return await getFileMetadata(token, knownId);
    } catch {
      // Deleted from Drive, or belongs to a different account now — fall
      // through and look it up again rather than failing the whole sync.
      setSetting(SETTINGS_KEYS.DRIVE_FILE_ID, '');
    }
  }
  return findLibraryFile(token);
}

async function runSync({ interactive, onStep }) {
  const clientId = getClientId();
  if (!clientId) throw new Error('Add your Google client ID in Settings first');

  onStep?.('Connecting to Google Drive...');
  const token = await getAccessToken(clientId, { interactive });

  onStep?.('Finding your library...');
  let file = await resolveLibraryFile(token);

  onStep?.('Reading the cloud copy...');
  let remotePapers = [];
  if (file) {
    try {
      remotePapers = papersFromSyncDocument(await readFile(token, file.id));
    } catch (e) {
      // An unreadable cloud file must not overwrite good local data.
      throw new Error('Could not read the library in Drive: ' + e.message);
    }
  }

  onStep?.('Merging...');
  const local = await getAllRecords();
  let { records, stats } = mergeLibraries(local, remotePapers);

  // If another device wrote while we were merging, the version will have moved
  // on. Re-read and merge once more so that device's changes aren't discarded.
  if (file) {
    const current = await getFileMetadata(token, file.id);
    if (current.version !== file.version) {
      onStep?.('Another device synced — merging again...');
      const fresh = papersFromSyncDocument(await readFile(token, current.id));
      ({ records, stats } = mergeLibraries(records, fresh));
      file = current;
    }
  }

  onStep?.('Saving...');
  await applyMergedRecords(records);

  const document = toSyncDocument(records);
  file = file ? await updateFile(token, file.id, document) : await createFile(token, document);
  setSetting(SETTINGS_KEYS.DRIVE_FILE_ID, file.id);

  const now = new Date().toISOString();
  setSetting(SETTINGS_KEYS.LAST_SYNC, now);
  // A successful sync means every device has had the chance to see old
  // deletions, so the tombstones holding them can go.
  await purgeExpiredTombstones();

  return { ...stats, total: records.filter(r => !r.deletedAt).length, at: now };
}

// Merges this device's library with the copy in Drive and writes the result to
// both. Safe to call repeatedly — concurrent callers share one run.
export function syncNow({ interactive = true, onStep } = {}) {
  if (inFlight) return inFlight;
  setSyncing(true);
  inFlight = runSync({ interactive, onStep }).finally(() => {
    inFlight = null;
    setSyncing(false);
  });
  return inFlight;
}

let debounceTimer = null;
const AUTO_SYNC_DELAY_MS = 8000;

// Automatic syncs stay silent: they never prompt for sign-in, and a failure
// (offline, expired grant) leaves the local library untouched and waits for the
// next attempt rather than interrupting the user.
function scheduleAutoSync() {
  if (!isSyncEnabled()) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (!isSyncEnabled() || !navigator.onLine) return;
    syncNow({ interactive: false }).catch(() => {});
  }, AUTO_SYNC_DELAY_MS);
}

let started = false;

// A launch sync competing with the app's own first paint is the most jarring
// moment for the Google flash to land in — the user hasn't seen the app yet,
// so it reads as the screen opening to the wrong thing. Waiting a couple of
// seconds means it lands once there is already something on screen to read
// it against, without meaningfully delaying when the sync itself happens.
const LAUNCH_SYNC_DELAY_MS = 2500;

// Called once at start-up: syncs on launch, after any change to the library,
// and when the device comes back online.
export function startAutoSync() {
  if (started) return;
  started = true;

  onMutation(scheduleAutoSync);
  globalThis.addEventListener?.('online', scheduleAutoSync);

  if (isSyncEnabled() && navigator.onLine) {
    // Only if Google can issue a token without UI — an expired grant should
    // surface in Settings, not as a popup on launch.
    setTimeout(() => {
      if (isSyncEnabled() && navigator.onLine) syncNow({ interactive: false }).catch(() => {});
    }, LAUNCH_SYNC_DELAY_MS);
  }
}

export function hasActiveConnection() {
  return hasLiveToken();
}
