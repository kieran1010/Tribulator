import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { importWebSource } from '../lib/aiApi';
import { searchPubmedIdByDoi, pmidsToTrials } from '../lib/pubmedApi';
import { fetchCrossrefByDoi } from '../lib/crossrefApi';
import { crossrefToTrial } from '../lib/lookupApi';
import { buildWebReference } from '../lib/format';
import { canonicaliseUrl } from '../lib/webSource';
import { isAiEnabled } from '../lib/storage';
import { TAGS, WEB_SOURCE_TYPES } from '../lib/constants';
import { addPaper, getAllPapers } from '../lib/db';
import ResultCard from './ResultCard';
import { ExternalLinkIcon, SparklesIcon } from './Icon';

const DETAIL_FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'authors', label: 'Authors (Vancouver style, comma-separated)' },
  { key: 'source', label: 'Published in (newsletter, journal or website)' },
  { key: 'published', label: 'Date published (YYYY-MM-DD, YYYY-MM or YYYY)' },
  { key: 'volume', label: 'Volume' },
  { key: 'issue', label: 'Issue' },
  { key: 'pages', label: 'Pages' },
  { key: 'doi', label: 'DOI' },
];

const fieldLabel = { fontSize: 12, fontWeight: 600, color: 'var(--muted)', margin: '10px 0 4px', display: 'block' };

// Asks the registries whether a DOI printed on the page belongs to an indexed
// paper, whose own record is more reliable than anything read off a web page.
async function findRegisteredRecord(doi) {
  const pmid = await searchPubmedIdByDoi(doi);
  if (pmid) return (await pmidsToTrials([pmid]))[0] || null;
  const cr = await fetchCrossrefByDoi(doi);
  return cr ? crossrefToTrial(cr) : null;
}

// Reads a web page with AI, then shows every detail it drafted as an editable
// form. Nothing is saved until the user has had the chance to check it.
export default function WebImportView({ url: rawUrl }) {
  const navigate = useNavigate();
  const url = canonicaliseUrl(rawUrl);
  const aiEnabled = isAiEnabled();

  const [loading, setLoading] = useState(aiEnabled);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [registered, setRegistered] = useState(null);
  const [existing, setExisting] = useState(null);
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!aiEnabled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const papers = await getAllPapers();
        const match = papers.find(p => p.url && canonicaliseUrl(p.url) === url);
        if (cancelled) return;
        if (match) {
          setExisting(match);
          return;
        }

        const result = await importWebSource(url);
        if (cancelled) return;
        setForm({
          ...result.details,
          authors: result.details.authors.join(', '),
          ...result.summary,
        });
        setWarnings(result.warnings);

        if (result.details.doi) {
          // A failed registry check only loses the hint, never the import.
          const record = await findRegisteredRecord(result.details.doi).catch(() => null);
          if (!cancelled) setRegistered(record);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url, aiEnabled, attempt]);

  if (!aiEnabled) {
    return (
      <div className="empty-state">
        <p>Importing a web page uses AI to read it.</p>
        <p className="hint">
          Turn on AI features and add your Anthropic API key in <Link to="/settings">Settings</Link>.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="empty-state">
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        <p>Reading the page...</p>
        <p className="hint">This can take up to a minute.</p>
      </div>
    );
  }

  if (existing) {
    return (
      <div className="empty-state">
        <p>{saved ? 'Saved to your library.' : 'This page is already in your library.'}</p>
        <ResultCard
          item={{ title: existing.title, journal: existing.journal, pubdate: existing.year }}
          onClick={() => navigate('/detail', { state: { trial: savedTrial(existing) } })}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <p className="error-text">{error}</p>
        <button type="button" className="btn btn-ghost" onClick={() => setAttempt(a => a + 1)}>
          Try again
        </button>
      </div>
    );
  }

  if (!form) return null;

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const toggleTag = tag =>
    set('tags', form.tags.includes(tag) ? form.tags.filter(t => t !== tag) : [...form.tags, tag]);

  const authors = form.authors.split(',').map(a => a.trim()).filter(Boolean);
  const reference = buildWebReference({ ...form, authors, url });

  const handleSave = async () => {
    const year = (/^\d{4}/.exec(form.published) || [''])[0];
    const paper = {
      title: form.title.trim(),
      reference,
      journal: form.source.trim(),
      paperType: form.documentType,
      url,
      year,
      subject: form.subject.trim(),
      abstract: '',
      dateEntered: new Date().toISOString(),
      oneLineSummary: form.oneLineSummary.trim(),
      fullSummary: form.fullSummary.trim(),
      tags: form.tags,
    };
    const id = await addPaper(paper);
    setSaved(true);
    setExisting({ ...paper, id });
  };

  return (
    <div>
      <div style={{ background: 'var(--warning-soft)', borderLeft: '3px solid var(--warning)', padding: 12, borderRadius: 8, marginBottom: 12 }}>
        <p style={{ margin: 0, fontWeight: 600 }}>Drafted by AI from the page — check before saving</p>
        <a href={url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <ExternalLinkIcon width={14} height={14} />
          Open the page to compare
        </a>
        {warnings.map((w, i) => (
          <p key={i} className="hint" style={{ marginTop: 6, color: 'var(--warning)', fontWeight: 600 }}>⚠ {w}</p>
        ))}
      </div>

      {registered && (
        <div className="card section">
          <p className="section-title" style={{ marginBottom: 4 }}>This page's DOI belongs to an indexed paper</p>
          <p className="hint" style={{ marginBottom: 8 }}>Its registry record is more reliable — open it instead, or carry on importing the page.</p>
          <ResultCard item={registered} onClick={() => navigate('/detail', { state: { trial: registered } })} />
        </div>
      )}

      <p className="section-title">📎 Details</p>
      {DETAIL_FIELDS.map(f => (
        <label key={f.key} style={{ display: 'block' }}>
          <span style={fieldLabel}>{f.label}</span>
          {f.key === 'title' ? (
            <textarea rows={3} value={form.title} onChange={e => set('title', e.target.value)} />
          ) : (
            <input type="text" value={form[f.key]} onChange={e => set(f.key, e.target.value)} />
          )}
        </label>
      ))}
      {form.authorsAsWritten && (
        <p className="hint" style={{ marginTop: 4 }}>On the page: {form.authorsAsWritten}</p>
      )}

      <span style={fieldLabel}>Type</span>
      <div className="chips">
        {WEB_SOURCE_TYPES.map(t => (
          <button
            key={t}
            type="button"
            className={'chip' + (form.documentType === t ? ' active' : '')}
            onClick={() => set('documentType', t)}
          >
            {t}
          </button>
        ))}
      </div>

      <span style={fieldLabel}>Reference</span>
      <div style={{ background: 'var(--warning-soft)', borderLeft: '3px solid var(--warning)', padding: 12, borderRadius: 8 }}>
        <p style={{ fontStyle: 'italic', margin: 0, lineHeight: 1.5, wordBreak: 'break-word' }}>{reference}</p>
      </div>

      <div className="divider" />

      <p className="section-title"><SparklesIcon width={16} height={16} /> AI Summary</p>
      <label style={{ display: 'block' }}>
        <span style={fieldLabel}>Subject area</span>
        <input type="text" value={form.subject} onChange={e => set('subject', e.target.value)} />
      </label>
      <label style={{ display: 'block' }}>
        <span style={fieldLabel}>One-sentence summary</span>
        <textarea rows={3} value={form.oneLineSummary} onChange={e => set('oneLineSummary', e.target.value)} />
      </label>
      <label style={{ display: 'block' }}>
        <span style={fieldLabel}>Full summary</span>
        <textarea rows={8} value={form.fullSummary} onChange={e => set('fullSummary', e.target.value)} />
      </label>

      <span style={fieldLabel}>Tags</span>
      <div className="chips">
        {TAGS.map(tag => (
          <button
            key={tag}
            type="button"
            className={'chip' + (form.tags.includes(tag) ? ' active' : '')}
            onClick={() => toggleTag(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="btn btn-primary"
        onClick={handleSave}
        disabled={!form.title.trim()}
        style={{ marginTop: 16 }}
      >
        Save to library
      </button>
    </div>
  );
}

// The shape DetailScreen expects for a saved record, as SavedScreen builds it.
function savedTrial(paper) {
  return {
    id: paper.id,
    savedPaperId: paper.id,
    pubmedId: null,
    title: paper.title,
    journal: paper.journal || '',
    pubdate: paper.year,
    url: paper.url,
    quartile: null,
  };
}
