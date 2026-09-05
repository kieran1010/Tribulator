// Identifies the running bundle. Without this there is no way to tell a broken
// fix from a service worker still serving yesterday's code.
export const BUILD_ID = import.meta.env?.VITE_BUILD_ID || 'dev';
export const BUILD_TIME = import.meta.env?.VITE_BUILD_TIME || '';

export function buildLabel() {
  if (!BUILD_TIME) return `Build ${BUILD_ID}`;
  const when = new Date(BUILD_TIME);
  if (Number.isNaN(when.getTime())) return `Build ${BUILD_ID}`;
  const date = when.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const time = when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `Build ${BUILD_ID} · ${date}, ${time}`;
}
