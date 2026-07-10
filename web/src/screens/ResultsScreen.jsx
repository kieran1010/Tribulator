import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchPubMed } from '../lib/pubmedApi';
import ResultCard from '../components/ResultCard';

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
        <ResultCard key={item.id} item={item} onClick={() => navigate('/detail', { state: { trial: item } })} />
      ))}
    </div>
  );
}
