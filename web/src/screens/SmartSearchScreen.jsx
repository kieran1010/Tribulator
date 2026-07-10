import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { resolveSmartSearch } from '../lib/smartSearchApi';
import ResultCard from '../components/ResultCard';
import { SearchIcon, ChevronDown, ChevronLeftIcon } from '../components/Icon';

const MATCH_LABELS = {
  'doi-pubmed': 'Matched via DOI',
  'doi-crossref': 'Matched via DOI — not indexed in PubMed (from CrossRef)',
  title: 'Matched by title',
  'reference-crossref-pubmed': 'Resolved from reference via CrossRef',
  'reference-crossref': 'Resolved from reference via CrossRef — not indexed in PubMed',
  fallback: 'No exact match — closest PubMed result',
};

export default function SmartSearchScreen() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [showAlternatives, setShowAlternatives] = useState(false);

  const handleResolve = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setShowAlternatives(false);
    try {
      const resolved = await resolveSmartSearch(input, setStep);
      if (!resolved.trial) {
        setError('No matching paper found. Try pasting the full title, or a DOI.');
      } else {
        setResult(resolved);
      }
    } catch (e) {
      setError('Failed to resolve: ' + e.message);
    } finally {
      setLoading(false);
      setStep('');
    }
  };

  return (
    <div>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => navigate('/search')}
        style={{ marginBottom: 8, paddingLeft: 0 }}
      >
        <ChevronLeftIcon width={16} height={16} />
        Back to filtered search
      </button>

      <div className="section" style={{ position: 'relative' }}>
        <SearchIcon
          width={18}
          height={18}
          style={{ position: 'absolute', left: 14, top: 14, color: 'var(--muted)' }}
        />
        <input
          type="text"
          placeholder="Paste a DOI, paper title, or reference..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleResolve()}
          autoCapitalize="none"
          style={{ paddingLeft: 40 }}
        />
      </div>

      <button type="button" className="btn btn-primary" onClick={handleResolve} disabled={!input.trim() || loading}>
        Resolve
      </button>

      {loading && (
        <div className="empty-state">
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <p>{step || 'Resolving...'}</p>
        </div>
      )}

      {error && !loading && (
        <div className="empty-state">
          <p className="error-text">{error}</p>
        </div>
      )}

      {result?.trial && !loading && (
        <div className="section">
          <p className="hint" style={{ fontWeight: 600, marginBottom: 8 }}>
            {MATCH_LABELS[result.matchedVia] || 'Match found'}
          </p>

          <ResultCard item={result.trial} onClick={() => navigate('/detail', { state: { trial: result.trial } })} />

          {result.trial.notInPubmed && !result.trial.crossrefDetails?.abstract && (
            <p className="hint" style={{ marginTop: 4 }}>
              CrossRef has no abstract for this record — AI summarisation may be limited until it's opened.
            </p>
          )}

          {result.alternatives.length > 0 && (
            <div className="section">
              <button type="button" className="btn btn-ghost" onClick={() => setShowAlternatives(v => !v)}>
                {showAlternatives
                  ? 'Hide alternatives'
                  : `Show ${result.alternatives.length} alternative match${result.alternatives.length > 1 ? 'es' : ''}`}
                <ChevronDown
                  width={14}
                  height={14}
                  style={{ transform: showAlternatives ? 'rotate(180deg)' : 'none' }}
                />
              </button>
              {showAlternatives &&
                result.alternatives.map(alt => (
                  <ResultCard key={alt.id} item={alt} onClick={() => navigate('/detail', { state: { trial: alt } })} />
                ))}
            </div>
          )}
        </div>
      )}

      {!result && !loading && !error && (
        <p className="hint">
          Have a full reference list to search through one at a time, or just a DOI or title? Paste it above.{' '}
          <Link to="/search">Use the filtered keyword search</Link> instead for broader topic searches.
        </p>
      )}
    </div>
  );
}
