import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchPubMed } from '../lib/pubmedApi';
import { resolveLookup } from '../lib/lookupApi';
import { classifyQuery } from '../lib/queryClassifier';
import { DEFAULT_FILTERS } from '../lib/constants';
import ResultCard from '../components/ResultCard';
import { ChevronDown } from '../components/Icon';

const MATCH_LABELS = {
  pmid: 'Matched via PubMed ID',
  'doi-pubmed': 'Matched via DOI',
  'doi-crossref': 'Matched via DOI — not indexed in PubMed (from CrossRef)',
  title: 'Matched by title',
  'reference-crossref-pubmed': 'Resolved from reference via CrossRef',
  'reference-crossref': 'Resolved from reference via CrossRef — not indexed in PubMed',
  fallback: 'No exact match — closest PubMed result',
};

export default function ResultsScreen() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const query = state?.query;
  const filters = state?.filters || DEFAULT_FILTERS;
  // 'auto' lets the input decide; an explicit mode comes from the override.
  const requestedMode = state?.mode || 'auto';
  const mode = requestedMode === 'auto' ? classifyQuery(query).mode || 'keywords' : requestedMode;

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState('');
  const [error, setError] = useState(null);
  const [lookup, setLookup] = useState(null);
  const [results, setResults] = useState([]);
  const [showAlternatives, setShowAlternatives] = useState(false);

  useEffect(() => {
    if (!query) {
      navigate('/search', { replace: true });
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setLookup(null);
    setResults([]);
    setShowAlternatives(false);

    (async () => {
      try {
        if (mode === 'lookup') {
          const resolved = await resolveLookup(query, s => !cancelled && setStep(s));
          if (!cancelled) setLookup(resolved);
        } else {
          const found = await fetchPubMed(query, filters);
          if (!cancelled) setResults(found);
        }
      } catch (e) {
        if (!cancelled) setError('Failed to fetch results: ' + e.message);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setStep('');
        }
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, mode]);

  if (!query) return null;

  // Re-runs the same input the other way round, replacing history so Back
  // still returns to the search screen rather than the discarded attempt.
  const switchMode = next => {
    navigate('/results', { replace: true, state: { query, filters, mode: next } });
  };

  const openTrial = trial => navigate('/detail', { state: { trial } });

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        <p>{step || (mode === 'lookup' ? 'Looking up that paper...' : 'Searching PubMed...')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  const summary =
    mode === 'lookup'
      ? lookup?.trial
        ? MATCH_LABELS[lookup.matchedVia] || 'Match found'
        : 'No matching paper found'
      : `${results.length} result${results.length === 1 ? '' : 's'} for "${query}"`;

  return (
    <div>
      <div className="interpret-bar">
        <p className="interpret-text">{summary}</p>
        <button type="button" className="btn btn-ghost" onClick={() => switchMode(mode === 'lookup' ? 'keywords' : 'lookup')}>
          {mode === 'lookup' ? 'Search as a topic instead' : 'Look up as a specific paper'}
        </button>
      </div>

      {mode === 'lookup' && !lookup?.trial && (
        <div className="empty-state">
          <p>Nothing matched that DOI, title or reference.</p>
          <p className="hint">Try the full title, or search it as a topic instead.</p>
        </div>
      )}

      {mode === 'lookup' && lookup?.trial && (
        <>
          <ResultCard item={lookup.trial} onClick={() => openTrial(lookup.trial)} />

          {lookup.trial.notInPubmed && !lookup.trial.crossrefDetails?.abstract && (
            <p className="hint" style={{ marginTop: 4 }}>
              CrossRef has no abstract for this record — AI summarisation may be limited until it's opened.
            </p>
          )}

          {lookup.alternatives.length > 0 && (
            <div className="section">
              <button type="button" className="btn btn-ghost" onClick={() => setShowAlternatives(v => !v)}>
                {showAlternatives
                  ? 'Hide alternatives'
                  : `Show ${lookup.alternatives.length} alternative match${lookup.alternatives.length > 1 ? 'es' : ''}`}
                <ChevronDown
                  width={14}
                  height={14}
                  style={{ transform: showAlternatives ? 'rotate(180deg)' : 'none' }}
                />
              </button>
              {showAlternatives &&
                lookup.alternatives.map(alt => (
                  <ResultCard key={alt.id} item={alt} onClick={() => openTrial(alt)} />
                ))}
            </div>
          )}
        </>
      )}

      {mode === 'keywords' && results.length === 0 && (
        <div className="empty-state">
          <p>No results found. Try different search terms or filters.</p>
        </div>
      )}

      {mode === 'keywords' &&
        results.map(item => <ResultCard key={item.id} item={item} onClick={() => openTrial(item)} />)}
    </div>
  );
}
