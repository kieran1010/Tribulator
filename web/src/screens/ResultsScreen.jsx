import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchPubMed, fetchSpellingSuggestion } from '../lib/pubmedApi';
import { resolveLookup } from '../lib/lookupApi';
import { classifyQuery } from '../lib/queryClassifier';
import { DEFAULT_FILTERS } from '../lib/constants';
import ResultCard from '../components/ResultCard';
import { ChevronDown } from '../components/Icon';

// Above this many results the search clearly worked, so the spell check is
// skipped entirely and costs a well-spelled search nothing.
const SPELL_CHECK_MAX_RESULTS = 5;

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
  // Set when the user has insisted on their own spelling.
  const spellCheck = state?.spellCheck !== false;

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState('');
  const [error, setError] = useState(null);
  const [lookup, setLookup] = useState(null);
  const [results, setResults] = useState([]);
  const [spelling, setSpelling] = useState(null);
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
    setSpelling(null);
    setShowAlternatives(false);

    (async () => {
      try {
        if (mode === 'lookup') {
          const resolved = await resolveLookup(query, s => !cancelled && setStep(s));
          if (!cancelled) setLookup(resolved);
        } else {
          const found = await fetchPubMed(query, filters);
          if (cancelled) return;
          setResults(found);

          // Spelling is only ever second-guessed for topic searches. Correcting
          // a DOI, a PubMed ID or a pasted title would be actively wrong.
          if (!spellCheck || found.length >= SPELL_CHECK_MAX_RESULTS) return;

          // A failed or unavailable spell check must never break the search
          // that already succeeded.
          const corrected = await fetchSpellingSuggestion(query).catch(() => null);
          if (cancelled || !corrected) return;

          if (found.length > 0) {
            // The search worked; just offer the correction rather than
            // overriding what was actually asked for.
            setSpelling({ corrected, status: 'suggested' });
            return;
          }

          setStep('Checking spelling...');
          const retried = await fetchPubMed(corrected, filters);
          if (cancelled) return;
          setResults(retried);
          // 'exhausted' matters: offering a correction that itself found
          // nothing would just send the user round the same loop.
          setSpelling({ corrected, status: retried.length > 0 ? 'applied' : 'exhausted' });
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
  }, [query, mode, spellCheck]);

  if (!query) return null;

  // Re-runs the same input the other way round, replacing history so Back
  // still returns to the search screen rather than the discarded attempt.
  const switchMode = next => {
    navigate('/results', { replace: true, state: { query, filters, mode: next } });
  };

  const searchInstead = (term, { spellCheck: check = true } = {}) => {
    navigate('/results', { replace: true, state: { query: term, filters, mode: 'keywords', spellCheck: check } });
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
      : `${results.length} result${results.length === 1 ? '' : 's'} for "${spelling?.status === 'applied' ? spelling.corrected : query}"`;

  return (
    <div>
      <div className="interpret-bar">
        <p className="interpret-text">{summary}</p>
        <button type="button" className="btn btn-ghost" onClick={() => switchMode(mode === 'lookup' ? 'keywords' : 'lookup')}>
          {mode === 'lookup' ? 'Search as a topic instead' : 'Look up as a specific paper'}
        </button>
      </div>

      {mode === 'keywords' && spelling?.status === 'applied' && (
        <p className="hint" style={{ marginBottom: 12 }}>
          Nothing matched “{query}”, so this is showing <strong>{spelling.corrected}</strong> instead.{' '}
          <button type="button" className="link-button" onClick={() => searchInstead(query, { spellCheck: false })}>
            Search “{query}” anyway
          </button>
        </p>
      )}

      {mode === 'keywords' && spelling?.status === 'suggested' && (
        <p className="hint" style={{ marginBottom: 12 }}>
          Did you mean{' '}
          <button type="button" className="link-button" onClick={() => searchInstead(spelling.corrected)}>
            {spelling.corrected}
          </button>?
        </p>
      )}

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
          {spelling?.status === 'exhausted' && (
            <p className="hint">Nothing matched “{spelling.corrected}” either.</p>
          )}
        </div>
      )}

      {mode === 'keywords' &&
        results.map(item => <ResultCard key={item.id} item={item} onClick={() => openTrial(item)} />)}
    </div>
  );
}
