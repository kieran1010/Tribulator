import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllPapers, deletePaper, pubmedIdFromUrl } from '../lib/db';
import { exportLibraryToFile } from '../lib/backup';
import { getLastSync, isSyncEnabled } from '../lib/sync';
import { SETTINGS_KEYS, getSetting, isAiEnabled } from '../lib/storage';
import { searchLibraryWithAI } from '../lib/aiApi';
import { TAGS } from '../lib/constants';
import { SearchIcon, TrashIcon, BookmarkIcon, XIcon, SparklesIcon, ChevronDown } from '../components/Icon';

let hasPromptedBackupThisSession = false;

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest saved' },
  { id: 'oldest', label: 'Oldest saved' },
  { id: 'title', label: 'Title A–Z' },
  { id: 'year', label: 'Year' },
];

function sortPapers(list, mode) {
  const arr = [...list];
  if (mode === 'oldest') return arr.sort((a, b) => new Date(a.dateEntered || 0) - new Date(b.dateEntered || 0));
  if (mode === 'title') return arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  if (mode === 'year') return arr.sort((a, b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0));
  return arr.sort((a, b) => new Date(b.dateEntered || 0) - new Date(a.dateEntered || 0));
}

export default function SavedScreen() {
  const navigate = useNavigate();
  const aiAvailable = isAiEnabled();

  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState(() => new Set());
  const [sortMode, setSortMode] = useState('newest');

  const [aiMode, setAiMode] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiSearching, setAiSearching] = useState(false);
  const [aiResults, setAiResults] = useState(null);
  const [aiError, setAiError] = useState(null);

  useEffect(() => {
    (async () => {
      const all = await getAllPapers();
      setPapers(all);
      setLoading(false);

      if (!hasPromptedBackupThisSession && all.length > 0) {
        // A recent Drive sync is a backup, so don't also nag for a file one.
        const lastSync = isSyncEnabled() ? getLastSync() : null;
        const lastBackup = [getSetting(SETTINGS_KEYS.LAST_BACKUP), lastSync]
          .filter(Boolean)
          .sort()
          .pop() || null;
        const daysSince = lastBackup
          ? (Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24)
          : Infinity;
        if (daysSince > 5) {
          hasPromptedBackupThisSession = true;
          const msg = lastBackup
            ? `Your library was last backed up ${Math.floor(daysSince)} days ago. Back up now?`
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

  // Only tags actually in use, so the chip row scales with the library
  // instead of always showing all 23 curated subspecialties.
  const availableTags = useMemo(() => {
    const inUse = new Set();
    papers.forEach(p => (p.tags || []).forEach(t => inUse.add(t)));
    return TAGS.filter(t => inUse.has(t));
  }, [papers]);

  const toggleTag = tag => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const textFiltered = query.trim()
    ? papers.filter(p =>
        [p.title, p.reference, p.subject, p.abstract, p.oneLineSummary, p.fullSummary, p.year, ...(p.tags || [])]
          .join(' ')
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      )
    : papers;

  const tagFiltered = selectedTags.size > 0
    ? textFiltered.filter(p => (p.tags || []).some(t => selectedTags.has(t)))
    : textFiltered;

  const filtered = sortPapers(tagFiltered, sortMode);

  const handleAiSearch = async () => {
    if (!aiQuery.trim()) return;
    setAiSearching(true);
    setAiError(null);
    try {
      const results = await searchLibraryWithAI(aiQuery.trim(), papers);
      setAiResults(results);
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiSearching(false);
    }
  };

  const clearAiSearch = () => {
    setAiResults(null);
    setAiError(null);
  };

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner" style={{ margin: '0 auto' }} />
      </div>
    );
  }

  const renderCard = (item, reason) => {
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
        {reason && (
          <p className="hint" style={{ margin: '0 0 6px', color: 'var(--teal)', fontWeight: 500 }}>
            <SparklesIcon width={12} height={12} style={{ verticalAlign: '-1px', marginRight: 4 }} />
            {reason}
          </p>
        )}
        {!reason && item.oneLineSummary && (
          <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 500 }}>{item.oneLineSummary}</p>
        )}
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
  };

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

      {aiAvailable && papers.length > 0 && (
        <div className="section">
          <button type="button" className="btn btn-ghost" style={{ paddingLeft: 0 }} onClick={() => setAiMode(v => !v)}>
            <SparklesIcon width={16} height={16} />
            Ask AI a question instead
            <ChevronDown width={14} height={14} style={{ transform: aiMode ? 'rotate(180deg)' : 'none' }} />
          </button>
          {aiMode && (
            <div className="card" style={{ marginTop: 4 }}>
              <input
                type="text"
                placeholder="e.g. difficult airway papers in obstetric patients"
                value={aiQuery}
                onChange={e => setAiQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAiSearch(); }}
              />
              <button
                type="button"
                className="btn btn-primary section"
                onClick={handleAiSearch}
                disabled={aiSearching || !aiQuery.trim()}
              >
                {aiSearching ? <span className="spinner" /> : <SparklesIcon width={16} height={16} />}
                {aiSearching ? 'Searching...' : 'Search with AI'}
              </button>
              <p className="hint">Ranks your saved papers by relevance to the question, using your Anthropic API key.</p>
              {aiError && <p className="error-text">{aiError}</p>}
            </div>
          )}
        </div>
      )}

      {aiResults !== null ? (
        <>
          <div className="section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="hint" style={{ margin: 0 }}>
              {aiResults.length} AI result{aiResults.length === 1 ? '' : 's'} for &ldquo;{aiQuery.trim()}&rdquo;
            </p>
            <button type="button" className="btn btn-ghost" onClick={clearAiSearch}>Back to browsing</button>
          </div>

          {aiResults.length === 0 && (
            <div className="empty-state">
              <p style={{ fontWeight: 600 }}>Nothing relevant found</p>
              <p className="hint">Try rephrasing the question, or browse your library instead</p>
            </div>
          )}

          {aiResults.map(({ paper, reason }) => renderCard(paper, reason))}
        </>
      ) : (
        <>
          {availableTags.length > 0 && (
            <div className="chips section">
              {availableTags.map(tag => (
                <button
                  key={tag}
                  type="button"
                  className={'chip' + (selectedTags.has(tag) ? ' active' : '')}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          <div className="section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <p className="hint" style={{ margin: 0 }}>
              {filtered.length} of {papers.length} saved paper{papers.length !== 1 ? 's' : ''}
            </p>
            <div className="chips">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  className={'chip' + (sortMode === opt.id ? ' active' : '')}
                  onClick={() => setSortMode(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 && (
            <div className="empty-state">
              <BookmarkIcon width={40} height={40} style={{ color: 'var(--border)', marginBottom: 8 }} />
              <p style={{ fontWeight: 600 }}>{query || selectedTags.size > 0 ? 'No results found' : 'No saved papers yet'}</p>
              <p className="hint">
                {query || selectedTags.size > 0 ? 'Try a different search term or tag' : 'Tap the bookmark icon on any paper to save it here'}
              </p>
            </div>
          )}

          {filtered.map(item => renderCard(item, null))}
        </>
      )}
    </div>
  );
}
