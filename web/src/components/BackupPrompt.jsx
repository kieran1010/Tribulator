import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { exportLibraryToFile, snoozeBackupReminder, BACKUP_REMINDER_DAYS } from '../lib/backup';
import { CloudDownIcon, CloudUpIcon } from './Icon';

const COPY = {
  setup: {
    body: 'Google Drive sync keeps a copy of your library in your Drive and updates it automatically after every change. Or export a one-off backup file instead.',
    driveLabel: 'Set up Google Drive',
  },
  resync: {
    body: "Your library hasn't synced with Google Drive recently. Open Drive settings to sync now — you may need to sign in to Google again. Or export a backup file instead.",
    driveLabel: 'Open Drive settings',
  },
  file: {
    body: 'Export a backup file and keep it somewhere safe, away from this device.',
    driveLabel: null,
  },
};

// The "not backed up for n days" reminder. Offers Google Drive (via Settings,
// where the sign-in and what Drive access means are explained) when this build
// has it, and a one-off file export either way.
export default function BackupPrompt({ reminder, onClose }) {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);

  const copy = COPY[reminder.offer];
  const days = reminder.daysSince;
  const lead = days === null
    ? 'Your saved papers are only stored on this device, with no backup on record.'
    : `Your library was last backed up ${days} day${days === 1 ? '' : 's'} ago.`;

  const notNow = () => {
    snoozeBackupReminder();
    onClose();
  };

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && !exporting) notNow(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const goToDrive = () => {
    onClose();
    navigate('/settings', { state: { focus: 'drive' } });
  };

  const exportFile = async () => {
    setExporting(true);
    try {
      const count = await exportLibraryToFile();
      setResult({ type: 'success', text: `Exported ${count} paper${count !== 1 ? 's' : ''}.` });
    } catch (e) {
      setResult({ type: 'error', text: 'Backup failed: ' + e.message });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="backup-prompt-title">
        <p id="backup-prompt-title" className="dialog-title">Back up your library</p>

        {result ? (
          <>
            <p className={result.type === 'error' ? 'error-text' : 'dialog-body'}>{result.text}</p>
            <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>Done</button>
          </>
        ) : (
          <>
            <p className="dialog-body">{lead}</p>
            <p className="dialog-body">{copy.body}</p>

            <div className="dialog-actions">
              {copy.driveLabel && (
                <button type="button" className="btn btn-primary" onClick={goToDrive} disabled={exporting} autoFocus>
                  <CloudUpIcon width={18} height={18} />
                  {copy.driveLabel}
                </button>
              )}
              <button
                type="button"
                className={'btn ' + (copy.driveLabel ? 'btn-outline' : 'btn-primary')}
                onClick={exportFile}
                disabled={exporting}
                autoFocus={!copy.driveLabel}
              >
                {exporting ? <span className="spinner" /> : <CloudDownIcon width={18} height={18} />}
                Export backup file
              </button>
              <button type="button" className="btn btn-ghost dialog-dismiss" onClick={notNow} disabled={exporting}>
                Not now
              </button>
            </div>
            <p className="hint dialog-footnote">“Not now” reminds you again in {BACKUP_REMINDER_DAYS} days.</p>
          </>
        )}
      </div>
    </div>
  );
}
