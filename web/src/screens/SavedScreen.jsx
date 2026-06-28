import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadBookmarks, saveBookmarks } from '../lib/storage';
import { backupBookmarks, restoreBookmarks } from '../lib/sheetsApi';
import { SearchIcon, TrashIcon, CloudUpIcon, CloudDownIcon, BookmarkIcon, XIcon } from '../components/Icon';

export default function SavedScreen() {
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState([]);
  const [query, setQuery] = useState('');
  const [backing, setBacking] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    const sorted = [...loadBookmarks()].sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0));
    setBookmarks(sorted);
  }, []);

  const handleDelete = id => {
    if (!confirm('Remove this paper from saved trials?')) return;
    const updated = bookmarks.filter(b => b.id !== id);
    setBookmarks(updated);
    saveBookmarks(updated);
  };

  const handleBackup = async () => {
    setBacking(true);
    setNotice(null);
    try {
      await backupBookmarks(bookmarks);
      setNotice({ type: 'success', text: `${bookmarks.length} papers backed up to Google Sheets.` });
    } catch (e) {
      setNotice({ type: 'error', text: 'Backup failed: ' + e.message });
    } finally {
      setBacking(false);
    }
  };

  const handleRestore = async () => {
    if (!confirm('This will replace your current saved papers with the backup. Continue?')) return;
    setRestoring(true);
    setNotice(null);
    try {
      const restored = await restoreBookmarks();
      setBookmarks(restored);
      saveBookmarks(restored);
      setNotice({ type: 'success', text: `${restored.length} papers restored.` });
    } catch (e) {
      setNotice({ type: 'error', text: 'Restore failed: ' + e.message });
    } finally {
      setRestoring(false);
    }
  };

  const filtered = query.trim()
    ? bookmarks.filter(b => [b.title, b.journal, b.pubdate, ...(b.keywords || [])].join(' ').toLowerCase().includes(query.toLowerCase()))
    : bookmarks;

  return (
    <div>
      <div className="section" style={{ position: 'relative' }}>
        <SearchIcon width={16} height={16} style={{ position: 'absolute', left: 14, top: 14, color: 'var(--text-muted)' }} />
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
            style={{ position: 'absolute', right: 10, top: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <XIcon width={16} height={16} />
          </button>
        )}
      </div>

      <div className="section" style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-outline" onClick={handleBackup} disabled={backing} style={{ width: 'auto', flex: 1 }}>
          {backing ? <span className="spinner" /> : <CloudUpIcon width={16} height={16} />}
          Backup
        </button>
        <button type="button" className="btn btn-outline" onClick={handleRestore} disabled={restoring} style={{ width: 'auto', flex: 1 }}>
          {restoring ? <span className="spinner" /> : <CloudDownIcon width={16} height={16} />}
          Restore
        </button>
      </div>

      {notice && (
        <p className={notice.type === 'error' ? 'error-text' : 'hint'} style={{ marginBottom: 12 }}>{notice.text}</p>
      )}

      <p className="hint" style={{ marginBottom: 12 }}>
        {filtered.length} of {bookmarks.length} saved paper{bookmarks.length !== 1 ? 's' : ''}
      </p>

      {filtered.length === 0 && (
        <div className="empty-state">
          <BookmarkIcon width={40} height={40} style={{ color: 'var(--border)', marginBottom: 8 }} />
          <p style={{ fontWeight: 600 }}>{query ? 'No results found' : 'No saved papers yet'}</p>
          <p className="hint">{query ? 'Try a different search term' : 'Tap the bookmark icon on any paper to save it here'}</p>
        </div>
      )}

      {filtered.map(item => (
        <div key={item.id} className="card section" style={{ cursor: 'pointer' }} onClick={() => navigate('/detail', { state: { trial: item } })}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="hint">{item.pubdate}</span>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--border)' }}
            >
              <TrashIcon width={16} height={16} />
            </button>
          </div>
          <p style={{ fontWeight: 600, margin: '0 0 4px', lineHeight: 1.4 }}>{item.title}</p>
          <p className="hint" style={{ fontStyle: 'italic', margin: '0 0 6px' }}>{item.journal}</p>
          {item.keywords?.length > 0 && (
            <div className="chips" style={{ marginBottom: 6 }}>
              {item.keywords.slice(0, 3).map((kw, i) => <span key={i} className="keyword">{kw}</span>)}
            </div>
          )}
          {item.dateAdded && <p className="hint">Added {new Date(item.dateAdded).toLocaleDateString()}</p>}
        </div>
      ))}
    </div>
  );
}
