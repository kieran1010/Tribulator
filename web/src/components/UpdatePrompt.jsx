import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

// How often to ask the server whether a new build exists. Without this, a
// long-lived home-screen app only notices an update when it is cold-started.
const UPDATE_CHECK_MS = 60 * 60 * 1000;

export default function UpdatePrompt() {
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [applyUpdate, setApplyUpdate] = useState(null);

  useEffect(() => {
    const update = registerSW({
      onNeedRefresh() { setNeedsRefresh(true); },
      onRegisteredSW(_url, registration) {
        if (!registration) return;
        setInterval(() => registration.update().catch(() => {}), UPDATE_CHECK_MS);
      },
    });
    // Stored as a thunk: setState would otherwise call the function it is given.
    setApplyUpdate(() => update);
  }, []);

  const reload = async () => {
    setReloading(true);
    try {
      await applyUpdate?.(true);
    } catch {
      // Fall through: the plain reload below still gets the new build.
    }
    // applyUpdate reloads once the new worker takes control, but there may be
    // no worker waiting to take control — a service worker does not control
    // the page that first registered it. Reload regardless: the user asked
    // for it, and a button that silently does nothing is worse than none.
    setTimeout(() => globalThis.location.reload(), 800);
  };

  if (!needsRefresh) return null;

  return (
    <div className="update-bar" role="status">
      <span>A new version of Tribulator is ready.</span>
      <button type="button" onClick={reload} disabled={reloading}>
        {reloading ? 'Reloading...' : 'Reload'}
      </button>
    </div>
  );
}
