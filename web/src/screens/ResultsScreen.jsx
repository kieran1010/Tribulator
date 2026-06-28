import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchPubMed } from '../lib/pubmedApi';

const QUARTILE_VAR = { Q1: 'var(--q1)', Q2: 'var(--q2)', Q3: 'var(--q3)', Q4: 'var(--q4)' };

export default function ResultsScreen() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const query = state?.query;
  const filters = state?.filters;

  useEffect(() => {
    if (!query) {
      navigate('/search', { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const pubmed = await fetchPubMed(query, filters);
        if (!cancelled) setResults(pubmed);
      } catch (e) {
        if (!cancelled) setError('Failed to fetch results: ' + e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  if (!query) return null;

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        <p>Searching PubMed...</p>
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

  return (
    <div>
      <p className="hint" style={{ marginBottom: 12 }}>{results.length} results for "{query}"</p>

      {results.length === 0 && (
        <div className="empty-state">
          <p>No results found. Try different search terms or filters.</p>
        </div>
      )}

      {results.map(item => (
        <div
          key={item.id}
          className="card"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/detail', { state: { trial: item } })}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span className="hint">{item.pubdate}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {item.quartile && (
                <span
                  className="badge"
                  style={{ color: QUARTILE_VAR[item.quartile], borderColor: QUARTILE_VAR[item.quartile] }}
                >
                  {item.quartile}
                </span>
              )}
            </div>
          </div>
          <p style={{ fontWeight: 600, margin: '0 0 4px', lineHeight: 1.4 }}>{item.title}</p>
          <p className="hint" style={{ fontStyle: 'italic', margin: '0 0 8px' }}>{item.journal}</p>
          {item.keywords.length > 0 && (
            <div className="chips">
              {item.keywords.slice(0, 4).map((kw, i) => (
                <span key={i} className="keyword">{kw}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
