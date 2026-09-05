// Google Drive access for a static, backend-less app: the browser talks to
// Drive directly using a Google Identity Services token, and the app is scoped
// to `drive.file` — it can only ever see files it created itself, never the
// rest of the user's Drive. That scope is also classified non-sensitive, so the
// OAuth client needs no Google verification review.
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FILES_API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

export const LIBRARY_FILENAME = 'tribulator-library.json';

// e.g. 296555094518-ek78l30etraoao6fu8536e2vasgds9ap.apps.googleusercontent.com
const CLIENT_ID_PATTERN = /^\d+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i;

// Pasting on a phone routinely picks up spaces or a line break, and the field
// is too narrow to see a truncated tail — so strip whitespace anywhere in the
// string, not just at the ends.
export function normaliseClientId(value) {
  return (value || '').replace(/\s+/g, '');
}

// Returns a description of what's wrong with a client ID, or null if it looks
// usable. Catching this locally avoids Google's opaque "invalid_client" page.
export function clientIdProblem(value) {
  const id = normaliseClientId(value);
  if (!id) return 'Paste your Google OAuth client ID first.';
  if (/^GOCSPX-/.test(id)) {
    return 'That is the client secret, not the client ID. Copy the Client ID instead — it ends in .apps.googleusercontent.com';
  }
  if (!CLIENT_ID_PATTERN.test(id)) {
    return 'That does not look like a Google client ID. It should end in .apps.googleusercontent.com — check nothing was cut off when pasting.';
  }
  return null;
}

let gisPromise = null;

function loadGis() {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (globalThis.google?.accounts?.oauth2) return resolve(globalThis.google);
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () =>
      globalThis.google?.accounts?.oauth2
        ? resolve(globalThis.google)
        : reject(new Error('Google sign-in loaded but is unavailable'));
    script.onerror = () => {
      gisPromise = null; // let a later attempt retry after the network returns
      reject(new Error('Could not reach Google sign-in'));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}

// Access tokens last about an hour and are deliberately kept in memory only:
// writing one to localStorage would leave a live Drive credential on disk.
let cachedToken = null;
let cachedExpiry = 0;

export function forgetToken() {
  cachedToken = null;
  cachedExpiry = 0;
}

export function hasLiveToken() {
  return !!cachedToken && Date.now() < cachedExpiry;
}

// `interactive: false` asks Google for a token without showing UI, which works
// when the user has already granted access in this browser. Automatic syncs use
// it so they can fail quietly instead of throwing a popup at the user.
export async function getAccessToken(rawClientId, { interactive = true } = {}) {
  const problem = clientIdProblem(rawClientId);
  if (problem) throw new Error(problem);
  const clientId = normaliseClientId(rawClientId);
  if (hasLiveToken()) return cachedToken;

  const google = await loadGis();
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      prompt: interactive ? '' : 'none',
      callback: response => {
        if (!response?.access_token) {
          return reject(new Error(response?.error_description || response?.error || 'Authorisation failed'));
        }
        cachedToken = response.access_token;
        // Expire a minute early so a sync never starts on a token about to die.
        cachedExpiry = Date.now() + (Number(response.expires_in) || 3600) * 1000 - 60_000;
        resolve(cachedToken);
      },
      error_callback: error => reject(new Error(error?.type === 'popup_closed'
        ? 'Sign-in was cancelled'
        : error?.message || 'Authorisation failed')),
    });
    client.requestAccessToken();
  });
}

export async function revokeToken() {
  const token = cachedToken;
  forgetToken();
  if (!token) return;
  try {
    const google = await loadGis();
    await new Promise(resolve => google.accounts.oauth2.revoke(token, resolve));
  } catch {
    // Revocation is best effort; the token expires within the hour regardless.
  }
}

// Drive answers a refusal with a structured body, and the reason inside it is
// the difference between problems that need completely different fixes —
// signing in again, enabling the API, or re-granting the permission. Reporting
// them all as "access expired" sends the user to fix the wrong thing.
async function readDriveError(res) {
  const body = await res.json().catch(() => null);
  const error = body?.error;
  return {
    reason: [error?.status, ...(error?.errors || []).map(e => e.reason)].filter(Boolean).join(' '),
    message: error?.message || '',
  };
}

async function driveFetch(token, url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  if (res.ok) return res;

  const { reason, message } = await readDriveError(res);
  const signal = `${reason} ${message}`;

  if (res.status === 401) {
    forgetToken();
    throw new Error('Google sign-in expired — tap Sync now to reconnect');
  }

  if (res.status === 403) {
    // The project never had the Drive API switched on. The token is perfectly
    // good, so don't throw it away — the fix is in the Google Cloud console.
    if (/accessNotConfigured|SERVICE_DISABLED|has not been used in project/i.test(signal)) {
      throw new Error(
        'The Google Drive API is not enabled for this project. Enable it in the Google Cloud console, wait a minute, then sync again.'
      );
    }
    // Consent went through but the file permission was left unticked.
    if (/insufficientPermissions|ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficient authentication scopes/i.test(signal)) {
      forgetToken();
      throw new Error(
        'Drive file access was not granted. Tap Disconnect Google Drive, then Sync now, and allow access when Google asks.'
      );
    }
    forgetToken();
    throw new Error('Google Drive refused the request' + (message ? `: ${message}` : ''));
  }

  throw new Error(`Drive request failed (${res.status})${message ? `: ${message}` : ''}`);
}

// `version` increments on every change to a file, which is what lets a sync
// notice that another device wrote while it was merging.
const FILE_FIELDS = 'id,name,version,modifiedTime';

export async function findLibraryFile(token) {
  const query = encodeURIComponent(`name='${LIBRARY_FILENAME}' and trashed=false`);
  const url = `${FILES_API}?q=${query}&spaces=drive&fields=files(${FILE_FIELDS})&pageSize=10`;
  const res = await driveFetch(token, url);
  const data = await res.json();
  // Should only ever be one. If a duplicate does appear, ordering by id keeps
  // every device picking the same file instead of splitting the library.
  const files = (data.files || []).sort((a, b) => (a.id > b.id ? 1 : -1));
  return files[0] || null;
}

export async function getFileMetadata(token, fileId) {
  const res = await driveFetch(token, `${FILES_API}/${fileId}?fields=${FILE_FIELDS}`);
  return res.json();
}

export async function readFile(token, fileId) {
  const res = await driveFetch(token, `${FILES_API}/${fileId}?alt=media`);
  return res.json();
}

export async function createFile(token, content) {
  const metadata = { name: LIBRARY_FILENAME, mimeType: 'application/json' };
  const boundary = `tribulator-${Math.random().toString(36).slice(2)}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(content)}\r\n` +
    `--${boundary}--`;

  const res = await driveFetch(token, `${UPLOAD_API}?uploadType=multipart&fields=${FILE_FIELDS}`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return res.json();
}

export async function updateFile(token, fileId, content) {
  const res = await driveFetch(token, `${UPLOAD_API}/${fileId}?uploadType=media&fields=${FILE_FIELDS}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(content),
  });
  return res.json();
}
