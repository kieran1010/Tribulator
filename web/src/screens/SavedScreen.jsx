import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllPapers, deletePaper, pubmedIdFromUrl } from '../lib/db';
import { exportLibraryToFile } from '../lib/backup';
import { SETTINGS_KEYS, getSetting } from '../lib/storage';
import { SearchIcon, TrashIcon, BookmarkIcon, XIcon } from '../components/Icon';

let hasPromptedBackupThisSession = false;

export default function SavedScreen() {
  const navigate = useNavigate();
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      const all = await getAllPapers();
      all.sort((a, b) => new Date(b.dateEntered || 0) - new Date(a.dateEntered || 0));
      setPapers(all);
      setLoading(false);

      if (!hasPromptedBackupThisSession && all.length > 0) {
        const lastBackup = getSetting(SETTINGS_KEYS.LAST_BACKUP);
        const daysSince = lastBackup
          ? (Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24)
          : Infinity;
        if (daysSince > 5) {
          hasPromptedBackupThisSession = true;
          const msg = lastBackup
            ? `Your last backup was ${Math.floor(daysSince)} days ago. Back up your library now?`
            : 'You have no backup on record. Back up your saved papers now?';
          if (confirm(msg)) {
            try {
              const count = await exportLibraryToFile();
              alert(`Exported ${count} paper${count !== 1 ? 's' : ''}.`);
            } catch (e) {
              alert('Backup failed: ' + e.message);
            }
          }
        }
      }
    })();
  }, []);

  const handleDelete = async id => {
    if (!confirm('Remove this paper from your library?')) return;
    await deletePaper(id);
    setPapers(prev => prev.filter(p => p.id !== id));
  };

  const filtered = query.trim()
    ? papers.filter(p => [p.title, p.reference, p.subject, ...(p.tags || [])].join(' ').toLowerCase().includes(query.toLowerCase()))
    : papers;

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner" style={{ margin: '0 auto' }} />
      </div>
    );
  }

  return (
    <div>
      <div className="section" style={{ position: 'relative' }}>
        <SearchIcon width={16} height={16} style={{ position: 'absolute', left: 14, top: 14, color: 'var(--muted)' }} />
        <input
          type="text"
          placeholder="Search saved papers..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ paddingLeft: 38, paddingRight: query ? 38 : 14 }}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            style={{ position: 'absolute', right: 10, top: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}
          >
            <XIcon width={16} height={16} />
          </button>
        )}
      </div>

      <p className="hint" style={{ marginBottom: 12 }}>
        {filtered.length} of {papers.length} saved paper{papers.length !== 1 ? 's' : ''}
      </p>

      {filtered.length === 0 && (
        <div className="empty-state">
          <BookmarkIcon width={40} height={40} style={{ color: 'var(--border)', marginBottom: 8 }} />
          <p style={{ fontWeight: 600 }}>{query ? 'No results found' : 'No saved papers yet'}</p>
          <p className="hint">{query ? 'Try a different search term' : 'Tap the bookmark icon on any paper to save it here'}</p>
        </div>
      )}

      {filtered.map(item => {
        const trial = {
          id: item.id,
          pubmedId: pubmedIdFromUrl(item.url),
          title: item.title,
          journal: '',
          pubdate: item.year,
          url: item.url,
          quartile: null,
        };
        return (
          <div
            key={item.id}
            className="card"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/detail', { state: { trial } })}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="hint">{item.year}</span>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border)' }}
              >
                <TrashIcon width={16} height={16} />
              </button>
            </div>
            <p style={{ fontWeight: 600, margin: '0 0 4px', lineHeight: 1.4 }}>{item.title}</p>
            <p className="hint" style={{ fontStyle: 'italic', margin: '0 0 6px' }}>{item.reference}</p>
            {item.oneLineSummary && <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 500 }}>{item.oneLineSummary}</p>}
            {item.tags?.length > 0 && (
              <div className="chips" style={{ marginBottom: 6 }}>
                {item.tags.map((tag, i) => (
                  <span key={i} className="badge" style={{ color: 'var(--teal)', borderColor: 'var(--teal)', background: 'var(--pale)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
