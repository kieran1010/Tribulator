import { useState, useEffect } from 'react';
import { getAllPapers, deletePaper } from '../lib/db';
import { SearchIcon, TrashIcon, BookmarkIcon, XIcon, ChevronDown, ExternalLinkIcon } from '../components/Icon';

export default function SavedScreen() {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    (async () => {
      const all = await getAllPapers();
      all.sort((a, b) => new Date(b.dateEntered || 0) - new Date(a.dateEntered || 0));
      setPapers(all);
      setLoading(false);
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
        const expanded = expandedId === item.id;
        return (
          <div key={item.id} className="card section" style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expanded ? null : item.id)}>
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
            {item.oneLineSummary && <p style={{ margin: '0 0 6px', fontWeight: 500 }}>{item.oneLineSummary}</p>}
            {item.tags?.length > 0 && (
              <div className="chips" style={{ marginBottom: 6 }}>
                {item.tags.map((tag, i) => (
                  <span key={i} className="badge" style={{ color: 'var(--accent)', borderColor: 'var(--accent)', background: 'var(--accent-soft)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {expanded && (
              <div onClick={e => e.stopPropagation()}>
                <div className="divider" />
                {item.fullSummary && <p style={{ margin: '0 0 10px', lineHeight: 1.6 }}>{item.fullSummary}</p>}
                {item.abstract && <p className="hint" style={{ lineHeight: 1.6, margin: '0 0 10px' }}>{item.abstract}</p>}
                {item.url && (
                  <a href={item.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <ExternalLinkIcon width={14} height={14} />
                    View on PubMed
                  </a>
                )}
              </div>
            )}

            <div style={{ textAlign: 'right', marginTop: 4 }}>
              <ChevronDown width={14} height={14} style={{ transform: expanded ? 'rotate(180deg)' : 'none', color: 'var(--text-muted)' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
