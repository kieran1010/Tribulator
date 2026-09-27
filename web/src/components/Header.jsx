import { useEffect, useState } from 'react';
import { onSyncStateChange, isSyncing } from '../lib/sync';
import { CloudUpIcon } from './Icon';

export default function Header() {
  const [syncing, setSyncing] = useState(() => isSyncing());
  useEffect(() => onSyncStateChange(setSyncing), []);

  return (
    <header className="app-header">
      <a href="https://hypnos.one" className="brand">
        {/* Hypnos Medical moon: two-circle construction from the brand kit */}
        <svg className="brand-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12.2 0A12 12 0 1 0 23.96 13.29A9.14 9.14 0 0 1 12.2 0Z" fill="currentColor" />
        </svg>
        <div className="brand-text">
          <span className="brand-hypnos">Hypnos</span>
          <span className="brand-medical">MEDICAL</span>
        </div>
        <span className="brand-divider" />
        <span className="brand-product">Tribulator</span>
      </a>
      <span className={'sync-indicator' + (syncing ? ' visible' : '')} aria-hidden={!syncing} title="Syncing">
        <CloudUpIcon width={15} height={15} />
      </span>
    </header>
  );
}
