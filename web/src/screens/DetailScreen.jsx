import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchFullDetails } from '../lib/pubmedApi';
import { fetchAISummary } from '../lib/aiApi';
import { exportToSheets } from '../lib/sheetsApi';
import { buildVancouverReference } from '../lib/format';
import { loadBookmarks, saveBookmarks } from '../lib/storage';
import { BookmarkIcon, ExternalLinkIcon, SparklesIcon, CheckCircleIcon, ChevronDown } from '../components/Icon';

const QUARTILE_VAR = { Q1: 'var(--q1)', Q2: 'var(--q2)', Q3: 'var(--q3)', Q4: 'var(--q4)' };

export default function DetailScreen() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const trial = state?.trial;

  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [abstractExpanded, setAbstractExpanded] = useState(false);

  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [exportError, setExportError] = useState(null);

  useEffect(() => {
    if (!trial) {
      navigate('/search', { replace: true });
      return;
    }
    (async () => {
      try {
        setDetails(await fetchFullDetails(trial.pubmedId));
      } catch {
        setDetails({});
      } finally {
        setDetailsLoading(false);
      }
      setBookmarked(loadBookmarks().some(b => b.id === trial.id));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trial?.id]);

  if (!trial) return null;

  const toggleBookmark = () => {
    const bookmarks = loadBookmarks();
    const updated = bookmarked
      ? bookmarks.filter(b => b.id !== trial.id)
      : [...bookmarks, { ...trial, dateAdded: new Date().toISOString() }];
    saveBookmarks(updated);
    setBookmarked(!bookmarked);
  };

  const handleSummarise = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      setAiSummary(await fetchAISummary(trial, details?.abstract));
    } catch (e) {
      setAiError('Failed to generate summary: ' + e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleExport = async () => {
    if (exporting || !aiSummary) return;
    setExporting(true);
    setExportError(null);
    try {
      await exportToSheets(trial, details, aiSummary);
      setExported(true);
    } catch (e) {
      setExportError('Export failed: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  const reference = details ? buildVancouverReference(trial, details) : null;
  const studyLink = `https://pubmed.ncbi.nlm.nih.gov/${trial.pubmedId}/`;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
        <h1 style={{ flex: 1, fontSize: 19, fontWeight: 700, lineHeight: 1.4, margin: 0 }}>{trial.title}</h1>
        <button type="button" onClick={toggleBookmark} aria-label="Bookmark" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <BookmarkIcon filled={bookmarked} width={26} height={26} style={{ color: bookmarked ? 'var(--navy)' : 'var(--text-muted)' }} />
        </button>
      </div>

      <p className="hint" style={{ fontStyle: 'italic', marginBottom: 8 }}>{trial.journal} · {trial.pubdate}</p>
      {trial.quartile && (
        <span
          className="badge"
          style={{ color: QUARTILE_VAR[trial.quartile], borderColor: QUARTILE_VAR[trial.quartile], marginBottom: 4 }}
        >
          {trial.quartile} Journal{trial.impactFactor ? ` · IF ${trial.impactFactor.toFixed(1)}` : ''}
        </span>
      )}

      <div className="divider" />

      <p className="section-title">📎 Reference</p>
      {detailsLoading ? (
        <div className="spinner" />
      ) : (
        <div style={{ background: 'var(--warning-soft)', borderLeft: '3px solid var(--warning)', padding: 14, borderRadius: 8, marginBottom: 8 }}>
          <p style={{ fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>{reference}</p>
          {details?.doi && <p className="hint" style={{ marginTop: 6 }}>{details.doi}</p>}
        </div>
      )}
      <a href={studyLink} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 0' }}>
        <ExternalLinkIcon width={16} height={16} />
        View on PubMed
      </a>

      <div className="divider" />

      <p className="section-title">📄 Abstract</p>
      {detailsLoading ? (
        <div className="spinner" />
      ) : (
        <div>
          <p
            style={{
              margin: 0,
              lineHeight: 1.6,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: abstractExpanded ? 'unset' : 5,
            }}
          >
            {details?.abstract || 'No abstract available.'}
          </p>
          {details?.abstract && (
            <button type="button" className="btn btn-ghost" onClick={() => setAbstractExpanded(e => !e)}>
              {abstractExpanded ? 'Show less' : 'Show more'}
              <ChevronDown width={14} height={14} style={{ transform: abstractExpanded ? 'rotate(180deg)' : 'none' }} />
            </button>
          )}
        </div>
      )}

      <div className="divider" />

      <p className="section-title"><SparklesIcon width={16} height={16} /> AI Clinical Summary</p>

      {!aiSummary && !aiLoading && (
        <button type="button" className="btn btn-outline" onClick={handleSummarise}>
          Generate AI Summary
        </button>
      )}

      {aiLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
          <div className="spinner" />
          <span className="hint">Generating clinical summary...</span>
        </div>
      )}

      {aiError && <p className="error-text" style={{ marginTop: 8 }}>{aiError}</p>}

      {aiSummary && (
        <div>
          <div className="card section" style={{ background: '#f3eefb' }}>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: 'var(--text-muted)', margin: '0 0 6px' }}>SUBJECT AREA</p>
            <p style={{ margin: 0, fontWeight: 600, color: '#6a3fa0' }}>{aiSummary.subject}</p>
          </div>

          <div className="card section" style={{ background: 'var(--success-soft)' }}>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: 'var(--text-muted)', margin: '0 0 6px' }}>ONE SENTENCE SUMMARY</p>
            <p style={{ margin: 0, fontWeight: 600, color: '#176b4d' }}>{aiSummary.headline}</p>
          </div>

          {aiSummary.category?.length > 0 && (
            <div className="chips section">
              {aiSummary.category.map((cat, i) => (
                <span key={i} className="badge" style={{ color: 'var(--accent)', borderColor: 'var(--accent)', background: 'var(--accent-soft)' }}>
                  {cat}
                </span>
              ))}
            </div>
          )}

          <div className="card section" style={{ background: 'var(--accent-soft)' }}>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: 'var(--text-muted)', margin: '0 0 6px' }}>FULL SUMMARY</p>
            <p style={{ margin: 0, lineHeight: 1.6, color: '#1c4564' }}>{aiSummary.comprehensive}</p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <button type="button" className="btn btn-ghost" onClick={handleSummarise}>↺ Regenerate</button>
          </div>

          <div className="divider" />

          <p className="section-title">📊 Save to Google Sheets</p>

          {!exported && (
            <button type="button" className="btn btn-success" onClick={handleExport} disabled={exporting}>
              {exporting ? <span className="spinner" /> : 'Export to Google Sheets'}
            </button>
          )}

          {exportError && <p className="error-text" style={{ marginTop: 8 }}>{exportError}</p>}

          {exported && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', color: 'var(--success)' }}>
              <CheckCircleIcon width={20} height={20} />
              <span style={{ fontWeight: 600 }}>Saved to Google Sheets</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
