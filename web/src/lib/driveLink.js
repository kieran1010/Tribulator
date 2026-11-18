// Background Drive sync: this device's connection to the Hypnos sign-in server
// (the google-drive-auth Supabase Edge Function, shared with Slate; its source
// is in kieran1010/slate, supabase/functions/google-drive-auth).
//
// WHY: Google only renews Tribulator's one-hour Drive access through a window
// of its own, and browsers only let that window open from a tap — so an
// automatic sync often can't renew it. Once this device is connected, it asks
// the Hypnos server instead, which holds a long-lived Google permission for
// this device and hands out fresh access with no window at all.
//
// CONNECTING (once per device): Tribulator sends the user to Google's consent
// screen (offline access, PKCE). Google sends them back to
// https://tribulator.hypnos.one/?code=…&state=…, and Tribulator passes the code
// to the server with a random device key. The server locks Google's permission
// with that key; the key itself stays only on this device (localStorage), so
// the server's copy is useless without it. No library data reaches the server.
//
// NEVER REVOKE WITH GOOGLE: revoking any one token removes everything granted
// to the whole Google project, on every device and for every Hypnos app.
// Disconnecting only makes the server forget this device.

export const DRIVE_AUTH_URL = 'https://cwgdsiqxydhaqpsicafb.supabase.co/functions/v1/google-drive-auth';
const APP = 'tribulator';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const LINK_KEY = 'tribulator_drive_link';             // { deviceId, deviceKey }
const PENDING_KEY = 'tribulator_drive_link_pending';  // a connection on its way through Google
const PENDING_MAX_AGE_MS = 30 * 60_000;
const SERVER_TIMEOUT_MS = 10_000;

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: background sync just stays off.
  }
}

// ── State, for Settings (useSyncExternalStore) ──────────────────────────────
// connected: this device has a server connection.
// connecting: Google has just sent the user back and the server is being asked.
// outcome: { ok, message, enableSync } of the latest attempt, or null.

const listeners = new Set();

function readLink() {
  const saved = readJson(LINK_KEY);
  return saved && typeof saved.deviceId === 'string' && typeof saved.deviceKey === 'string' ? saved : null;
}

let snapshot = { connected: !!readLink(), connecting: false, outcome: null };

function update(changes) {
  snapshot = { ...snapshot, ...changes };
  listeners.forEach(l => {
    try { l(); } catch { /* a listener must never break the connection */ }
  });
}

export function subscribeDriveLink(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDriveLinkSnapshot() {
  return snapshot;
}

export function getDeviceLink() {
  return snapshot.connected ? readLink() : null;
}

function setDeviceLink(link) {
  writeJson(LINK_KEY, link);
  update({ connected: !!link });
}

/** Clears the latest outcome once Settings has shown it. */
export function clearLinkOutcome() {
  if (snapshot.outcome) update({ outcome: null });
}

// ── Small crypto helpers ────────────────────────────────────────────────────

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomB64url(byteCount) {
  return b64url(crypto.getRandomValues(new Uint8Array(byteCount)));
}

async function pkceChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

// ── Talking to the server ───────────────────────────────────────────────────

async function callServer(body) {
  const res = await fetch(DRIVE_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app: APP, ...body }),
    // An automatic sync mustn't hang on a slow connection.
    signal: AbortSignal.timeout(SERVER_TIMEOUT_MS),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// ── Connecting ──────────────────────────────────────────────────────────────

/**
 * Sends this page to Google's consent screen to connect this device. The app
 * reloads when Google sends the user back (captureDriveReturn, then
 * finishDriveConnection). With enableSync, Drive sync is switched on once
 * connecting has worked.
 */
export async function startDriveConnection(clientId, { enableSync = false } = {}) {
  const pending = {
    state: randomB64url(16),
    codeVerifier: randomB64url(32),
    deviceKey: randomB64url(32),
    redirectUri: `${location.origin}/`,
    at: Date.now(),
    enableSync,
  };
  writeJson(PENDING_KEY, pending);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: pending.redirectUri,
    response_type: 'code',
    scope: DRIVE_SCOPE,
    access_type: 'offline',
    // A fresh long-lived permission for this device, even if another device
    // (or Hypnos app) already has one.
    prompt: 'consent',
    state: pending.state,
    code_challenge: await pkceChallenge(pending.codeVerifier),
    code_challenge_method: 'S256',
  });
  location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

let returned = null;

/**
 * Call before the app first renders. If this page load is Google sending the
 * user back, takes Google's one-time code out of the address bar (it must
 * never linger there or in history) and points the app at Settings, which
 * shows the result once finishDriveConnection has run.
 */
export function captureDriveReturn() {
  const params = new URLSearchParams(location.search);
  const state = params.get('state');
  const code = params.get('code');
  const error = params.get('error');
  if (!state || (!code && !error)) return;
  history.replaceState(null, '', `${location.pathname}#/settings`);
  returned = { state, code, error };
  update({ connecting: true });
}

let finishing = null;

/**
 * Finishes connecting this device if this launch is Google's return (see
 * captureDriveReturn). Resolves to null otherwise, or to
 * { ok, enableSync, accessToken, expiresIn }. Repeat calls share one run.
 */
export function finishDriveConnection() {
  if (!finishing) finishing = finish();
  return finishing;
}

async function finish() {
  if (!returned) return null;
  const { state, code, error } = returned;
  returned = null;
  const pending = readJson(PENDING_KEY);
  writeJson(PENDING_KEY, null);

  let outcome;
  let token = null;
  if (!pending || pending.state !== state) {
    outcome = { ok: false, message: "Sync wasn't set up: the sign-in didn't match. Please try again." };
  } else if (Date.now() - pending.at > PENDING_MAX_AGE_MS) {
    outcome = { ok: false, message: 'That took too long. Please try again.' };
  } else if (error || !code) {
    outcome = {
      ok: false,
      message: error === 'access_denied'
        ? "Google Drive access wasn't allowed, so sync wasn't set up."
        : "Sync wasn't set up. Please try again.",
    };
  } else {
    try {
      const reply = await callServer({
        action: 'link',
        code,
        codeVerifier: pending.codeVerifier,
        redirectUri: pending.redirectUri,
        deviceKey: pending.deviceKey,
      });
      if (reply.ok && typeof reply.data.deviceId === 'string') {
        setDeviceLink({ deviceId: reply.data.deviceId, deviceKey: pending.deviceKey });
        outcome = {
          ok: true,
          message: pending.enableSync
            ? 'Google Drive sync is on.'
            : "Done: this device now syncs without Google's sign-in pop-up.",
        };
        if (typeof reply.data.accessToken === 'string') {
          token = { accessToken: reply.data.accessToken, expiresIn: Number(reply.data.expiresIn) || 3600 };
        }
      } else {
        const why = typeof reply.data.error === 'string' ? reply.data.error : 'Please try again.';
        outcome = { ok: false, message: `Sync wasn't set up. ${why}` };
      }
    } catch {
      outcome = { ok: false, message: "Sync wasn't set up: couldn't reach the Hypnos server. Please try again." };
    }
  }
  const enableSync = !!pending?.enableSync;
  update({ connecting: false, outcome: { ...outcome, enableSync } });
  return { ok: outcome.ok, enableSync, ...(token || {}) };
}

// ── Everyday use ────────────────────────────────────────────────────────────

/**
 * Asks the server for a fresh Drive access token for this device. Resolves to
 * { kind: 'token', accessToken, expiresIn }, { kind: 'relink' } (this device
 * must connect again) or { kind: 'unavailable' } (unreachable, busy, failing).
 */
export async function fetchServerToken() {
  const link = getDeviceLink();
  if (!link) return { kind: 'relink' };
  try {
    const reply = await callServer({ action: 'token', deviceId: link.deviceId, deviceKey: link.deviceKey });
    if (reply.ok && typeof reply.data.accessToken === 'string') {
      return { kind: 'token', accessToken: reply.data.accessToken, expiresIn: Number(reply.data.expiresIn) || 3600 };
    }
    if (reply.data.code === 'RELINK') {
      setDeviceLink(null);
      return { kind: 'relink' };
    }
    return { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  }
}

/** Disconnects this device: the server deletes its locked permission. Nothing is revoked with Google. */
export async function unlinkDevice() {
  const link = getDeviceLink();
  if (!link) return;
  setDeviceLink(null);
  try {
    await callServer({ action: 'unlink', deviceId: link.deviceId, deviceKey: link.deviceKey });
  } catch {
    // Best effort: without this device's key (now deleted) the permission
    // can't be used, it lapses after six months unused, and the server prunes it.
  }
}
