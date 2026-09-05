import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DATE_FILTERS, DEFAULT_FILTERS, QUARTILE_FILTERS, STUDY_TYPES } from '../lib/constants';
import { classifyQuery } from '../lib/queryClassifier';
import { loadSearchDraft, saveSearchDraft } from '../lib/searchDraft';
import { SearchIcon, ChevronDown, XIcon } from '../components/Icon';

// How many filters differ from the defaults — shown as a badge so a collapsed
// panel never hides a filter that's silently narrowing the results.
function countActiveFilters(filters) {
  let count = 0;
  if (filters.dateRange !== DEFAULT_FILTERS.dateRange) count++;
  if (filters.minQuartile !== DEFAULT_FILTERS.minQuartile) count++;
  if (filters.medlineOnly !== DEFAULT_FILTERS.medlineOnly) count++;
  if (filters.studyTypes.length !== DEFAULT_FILTERS.studyTypes.length) count++;
  return count;
}

export default function SearchScreen() {
  const navigate = useNavigate();
  // The screen unmounts on navigation, so coming back from results would
  // otherwise land on an empty box with the filters reset.
  const [restored] = useState(() => loadSearchDraft());
  const [query, setQuery] = useState(restored?.query ?? '');
  const [filters, setFilters] = useState(restored?.filters ?? DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = useState(restored?.showFilters ?? false);

  useEffect(() => {
    saveSearchDraft({ query, filters, showFilters });
  }, [query, filters, showFilters]);

  const classification = useMemo(() => classifyQuery(query), [query]);
  const isLookup = classification.mode === 'lookup';
  const activeFilters = countActiveFilters(filters);

  const setFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

  const toggleStudyType = id => {
    setFilters(prev => ({
      ...prev,
      studyTypes: prev.studyTypes.includes(id)
        ? prev.studyTypes.filter(t => t !== id)
        : [...prev.studyTypes, id],
    }));
  };

  const handleSearch = () => {
    if (!query.trim()) return;
    // `mode: 'auto'` hands the classification to the results screen, which is
    // also where an override can re-run the same query the other way.
    navigate('/results', { state: { query: query.trim(), filters, mode: 'auto' } });
  };

  return (
    <div>
      <div className="section" style={{ position: 'relative' }}>
        <SearchIcon
          width={18}
          height={18}
          style={{ position: 'absolute', left: 14, top: 14, color: 'var(--muted)' }}
        />
        <input
          type="text"
          placeholder="Topic, DOI, PubMed ID, title, or full reference..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          autoCapitalize="none"
          style={{ paddingLeft: 40, paddingRight: query ? 40 : 14 }}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            style={{
              position: 'absolute', right: 12, top: 12, background: 'none',
              border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0,
            }}
          >
            <XIcon width={16} height={16} />
          </button>
        )}
        <p className="hint" style={{ marginTop: 8, minHeight: 16 }}>
          {classification.hint || 'Paste anything — the search works out what it is.'}
        </p>
      </div>

      <button
        type="button"
        className="collapse-head"
        onClick={() => setShowFilters(v => !v)}
        aria-expanded={showFilters}
      >
        <span className="collapse-head-label">
          Filters
          {activeFilters > 0 && <span className="count-badge">{activeFilters}</span>}
        </span>
        <ChevronDown
          width={16}
          height={16}
          style={{ transform: showFilters ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        />
      </button>

      {showFilters && (
        <div className="section">
          {isLookup && (
            <div className="card">
              <p className="hint">
                Filters narrow topic searches. This input looks like one specific paper, so they
                won't be applied.
              </p>
            </div>
          )}

          <div className="card">
            <p className="section-title">📅 Publication date</p>
            <div className="chips">
              {DATE_FILTERS.map(f => (
                <button
                  key={f}
                  type="button"
                  className={'chip' + (filters.dateRange === f ? ' active' : '')}
                  onClick={() => setFilter('dateRange', f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <p className="section-title">🏆 Minimum journal quartile</p>
            <div className="chips">
              {QUARTILE_FILTERS.map(q => (
                <button
                  key={q}
                  type="button"
                  className={'chip' + (filters.minQuartile === q ? ' active' : '')}
                  onClick={() => setFilter('minQuartile', q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="card switch-row">
            <div>
              <p className="section-title" style={{ marginBottom: 2 }}>✅ MEDLINE indexed only</p>
              <p className="hint">Journals meeting strict editorial standards</p>
            </div>
            <button
              type="button"
              className={'switch' + (filters.medlineOnly ? ' on' : '')}
              onClick={() => setFilter('medlineOnly', !filters.medlineOnly)}
              aria-label="MEDLINE indexed only"
            >
              <span className="switch-knob" />
            </button>
          </div>

          <div className="card">
            <p className="section-title">🔬 Study type</p>
            {STUDY_TYPES.map(type => (
              <div key={type.id} className="checkbox-row" onClick={() => toggleStudyType(type.id)}>
                <span className={'checkbox-box' + (filters.studyTypes.includes(type.id) ? ' checked' : '')}>
                  {filters.studyTypes.includes(type.id) && '✓'}
                </span>
                <span>{type.label}</span>
              </div>
            ))}
          </div>

          {activeFilters > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Reset filters
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary"
        onClick={handleSearch}
        disabled={!query.trim()}
        style={{ marginTop: 16 }}
      >
        {isLookup ? 'Find this paper' : 'Search trials'}
      </button>
    </div>
  );
}
