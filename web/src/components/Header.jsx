import { useEffect, useState } from 'react';
import brandMark from '../assets/brand-mark-transparent.png';
import { onSyncStateChange, isSyncing } from '../lib/sync';
import { CloudUpIcon } from './Icon';

export default function Header() {
  const [syncing, setSyncing] = useState(() => isSyncing());
  useEffect(() => onSyncStateChange(setSyncing), []);

  return (
    <header className="app-header">
      <a href="https://hypnos.one" className="brand">
        <img src={brandMark} alt="" className="brand-icon" />
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
