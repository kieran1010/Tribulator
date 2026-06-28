import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchFullDetails } from '../lib/pubmedApi';
import { fetchAISummary } from '../lib/aiApi';
import { buildVancouverReference } from '../lib/format';
import { isAiEnabled } from '../lib/storage';
import { getAllPapers, addPaper, putPaper, deletePaper, findMatchingPaper } from '../lib/db';
import { BookmarkIcon, ExternalLinkIcon, SparklesIcon, ChevronDown } from '../components/Icon';

const QUARTILE_VAR = { Q1: 'var(--q1)', Q2: 'var(--q2)', Q3: 'var(--q3)', Q4: 'var(--q4)' };

export default function DetailScreen() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const trial = state?.trial;

  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [savedPaper, setSavedPaper] = useState(null);
  const [abstractExpanded, setAbstractExpanded] = useState(false);

  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  useEffect(() => {
    if (!trial) {
      navigate('/search', { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      let fetchedDetails = {};
      try {
        fetchedDetails = await fetchFullDetails(trial.pubmedId);
      } catch {
        fetchedDetails = {};
      }
      if (cancelled) return;
      setDetails(fetchedDetails);
      setDetailsLoading(false);

      const url = `https://pubmed.ncbi.nlm.nih.gov/${trial.pubmedId}/`;
      const papers = await getAllPapers();
      if (cancelled) return;
      const match = findMatchingPaper(papers, { url });
      if (match) {
        setSavedPaper(match);
        if (match.oneLineSummary || match.fullSummary || match.subject) {
          setAiSummary({
            subject: match.subject,
            oneLineSummary: match.oneLineSummary,
            fullSummary: match.fullSummary,
            tags: match.tags || [],
          });
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trial?.id]);

  if (!trial) return null;

  const toggleSave = async () => {
    if (savedPaper) {
      await deletePaper(savedPaper.id);
      setSavedPaper(null);
      return;
    }
    const paper = {
      title: trial.title,
      reference: buildVancouverReference(trial, details || {}),
      url: `https://pubmed.ncbi.nlm.nih.gov/${trial.pubmedId}/`,
      year: trial.pubdate ? trial.pubdate.split(' ')[0] : '',
      subject: aiSummary?.subject || '',
      abstract: details?.abstract || '',
      dateEntered: new Date().toISOString(),
      oneLineSummary: aiSummary?.oneLineSummary || '',
      fullSummary: aiSummary?.fullSummary || '',
      tags: aiSummary?.tags || [],
    };
    const id = await addPaper(paper);
    setSavedPaper({ ...paper, id });
  };

  const handleSummarise = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const summary = await fetchAISummary(trial, details?.abstract);
      setAiSummary(summary);
      if (savedPaper) {
        const updated = { ...savedPaper, ...summary };
        await putPaper(updated);
        setSavedPaper(updated);
      }
    } catch (e) {
      setAiError('Failed to generate summary: ' + e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const reference = details ? buildVancouverReference(trial, details) : null;
  const studyLink = `https://pubmed.ncbi.nlm.nih.gov/${trial.pubmedId}/`;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
        <h1 style={{ flex: 1, fontSize: 19, fontWeight: 700, lineHeight: 1.4, margin: 0 }}>{trial.title}</h1>
        <button type="button" onClick={toggleSave} aria-label="Save to library" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <BookmarkIcon filled={!!savedPaper} width={26} height={26} style={{ color: savedPaper ? 'var(--navy)' : 'var(--text-muted)' }} />
        </button>
      </div>

      <p className="hint" style={{ fontStyle: 'italic', marginBottom: 8 }}>{trial.journal} · {trial.pubdate}</p>
      {trial.quartile && (
        <span
          className="badge"
          style={{ color: QUARTILE_VAR[trial.quartile], borderColor: QUARTILE_VAR[trial.quartile], marginBottom: 4 }}
        >
          {trial.quartile} Journal
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

      {!aiSummary && !aiLoading && isAiEnabled() && (
        <button type="button" className="btn btn-outline" onClick={handleSummarise}>
          Generate AI Summary
        </button>
      )}

      {!aiSummary && !aiLoading && !isAiEnabled() && (
        <p className="hint">Enable AI features in Settings to generate a summary for this paper.</p>
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
            <p style={{ margin: 0, fontWeight: 600, color: '#176b4d' }}>{aiSummary.oneLineSummary}</p>
          </div>

          {aiSummary.tags?.length > 0 && (
            <div className="chips section">
              {aiSummary.tags.map((tag, i) => (
                <span key={i} className="badge" style={{ color: 'var(--accent)', borderColor: 'var(--accent)', background: 'var(--accent-soft)' }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="card section" style={{ background: 'var(--accent-soft)' }}>
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: 'var(--text-muted)', margin: '0 0 6px' }}>FULL SUMMARY</p>
            <p style={{ margin: 0, lineHeight: 1.6, color: '#1c4564' }}>{aiSummary.fullSummary}</p>
          </div>

          {isAiEnabled() && (
            <div style={{ textAlign: 'right' }}>
              <button type="button" className="btn btn-ghost" onClick={handleSummarise}>↺ Regenerate</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
