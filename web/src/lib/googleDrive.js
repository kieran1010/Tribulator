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
export async function getAccessToken(clientId, { interactive = true } = {}) {
  if (!clientId) throw new Error('No Google client ID configured');
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

async function driveFetch(token, url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  if (res.status === 401 || res.status === 403) {
    forgetToken();
    throw new Error('Google Drive access expired — reconnect in Settings');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Drive request failed (${res.status})${body ? ': ' + body.slice(0, 200) : ''}`);
  }
  return res;
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
