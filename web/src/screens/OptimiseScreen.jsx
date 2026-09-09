import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  planOptimisation,
  applyOptimisation,
  isBlank,
  SELECTABLE_FIELDS,
  AI_FIELDS,
  DEFAULT_SELECTED_FIELDS,
} from '../lib/optimise';
import { exportLibraryToFile } from '../lib/backup';
import { getAllPapers } from '../lib/db';
import { isAiEnabled } from '../lib/storage';
import { ChevronLeftIcon, ChevronDown, SparklesIcon } from '../components/Icon';

const REASON_LABELS = {
  missing: 'was empty',
  empty: 'was punctuation only',
  truncated: 'was cut short',
  entities: 'had raw HTML codes',
  malformed: 'was malformed',
  reformatted: 'reformatted',
};

const CONFIDENCE_NOTE = {
  certain: null,
  high: 'matched by title',
  medium: 'matched by title — check before applying',
  low: 'loosely matched — check carefully before applying',
  'ai-only': 'no PubMed/CrossRef match — content generated from what you already have, unverified',
};

// Default-unticked confidence tiers: anything not resolved with certainty, so
// the user opts in per paper rather than a wrong match silently applying.
const REVIEW_FIRST = new Set(['low', 'medium', 'ai-only']);

function formatValue(value) {
  if (Array.isArray(value)) return value.join(', ');
  return String(value ?? '');
}

function FieldDiff({ change }) {
  return (
    <div style={{ marginTop: 8 }}>
      <p className="hint" style={{ fontWeight: 600, margin: 0 }}>
        {change.field} <span style={{ fontWeight: 400 }}>({REASON_LABELS[change.reason] || change.reason})</span>
      </p>
      {formatValue(change.from).trim() !== '' && (
        <p className="diff-before">{formatValue(change.from).slice(0, 300)}</p>
      )}
      <p className="diff-after">{formatValue(change.to).slice(0, 300)}</p>
    </div>
  );
}

export default function OptimiseScreen() {
  const navigate = useNavigate();
  const aiAvailable = isAiEnabled();

  const [selectedFields, setSelectedFields] = useState(() => new Set(DEFAULT_SELECTED_FIELDS));
  const [papers, setPapers] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [plan, setPlan] = useState(null);
  const [skipped, setSkipped] = useState(() => new Set());
  const [expanded, setExpanded] = useState(() => new Set());
  const [applying, setApplying] = useState(false);
  const [notice, setNotice] = useState(null);
  const stopRef = useRef(false);

  // Loaded once for the "up to N papers" estimate below — cheap, local only,
  // no network. Nothing here calls the AI; it just counts blank fields.
  useEffect(() => { getAllPapers().then(setPapers); }, []);

  const toggle = (set, update, key) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    update(next);
  };

  const toggleField = field => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const aiCandidateCount = useMemo(() => {
    const wantedAiFields = AI_FIELDS.filter(f => selectedFields.has(f));
    if (wantedAiFields.length === 0) return 0;
    return papers.filter(p => wantedAiFields.some(f => isBlank(p[f]))).length;
  }, [papers, selectedFields]);

  const entryKey = entry => entry.paper.uid || entry.paper.id;

  const handleScan = async () => {
    setScanning(true);
    setNotice(null);
    setPlan(null);
    stopRef.current = false;
    try {
      const result = await planOptimisation({
        fields: selectedFields,
        onProgress: setProgress,
        shouldStop: () => stopRef.current,
      });
      setPlan(result);
      // Anything not resolved with certainty starts unticked: the user opts
      // in to those rather than a wrong match applying by default.
      setSkipped(new Set(
        result.entries.filter(e => REVIEW_FIRST.has(e.confidence)).map(entryKey)
      ));
    } catch (e) {
      setNotice({ type: 'error', text: 'Scan failed: ' + e.message });
    } finally {
      setScanning(false);
      setProgress(null);
    }
  };

  const accepted = plan ? plan.entries.filter(e => !skipped.has(entryKey(e))) : [];

  const handleApply = async () => {
    if (accepted.length === 0) return;
    if (!confirm(`Update ${accepted.length} paper${accepted.length === 1 ? '' : 's'}? A backup will be saved first.`)) return;
    setApplying(true);
    setNotice(null);
    try {
      // The library is about to be rewritten in bulk and the result syncs to
      // every device, so a restorable copy is taken first, unprompted.
      await exportLibraryToFile();
      const applied = await applyOptimisation(accepted);
      setNotice({ type: 'success', text: `Updated ${applied} paper${applied === 1 ? '' : 's'}. A backup was downloaded first.` });
      setPlan(null);
    } catch (e) {
      setNotice({ type: 'error', text: 'Could not apply changes: ' + e.message });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div>
      <button type="button" className="btn btn-ghost" onClick={() => navigate('/settings')} style={{ paddingLeft: 0 }}>
        <ChevronLeftIcon width={16} height={16} />
        Back to settings
      </button>

      <p className="section-title" style={{ color: 'var(--navy)' }}>✨ Optimise library</p>
      <p className="hint section">
        Checks every saved paper against PubMed and CrossRef, fills in anything missing, repairs
        what is broken, and rewrites references in full Vancouver style. Nothing is changed until
        you review the list and apply it.
      </p>

      {!plan && !scanning && (
        <>
          <div className="card section">
            <p className="section-title" style={{ marginBottom: 8 }}>Fill in if missing</p>
            {SELECTABLE_FIELDS.map(f => {
              const locked = f.kind === 'ai' && !aiAvailable;
              const checked = selectedFields.has(f.field) && !locked;
              return (
                <div
                  key={f.field}
                  className="checkbox-row"
                  style={locked ? { opacity: 0.5, cursor: 'default' } : undefined}
                  onClick={() => !locked && toggleField(f.field)}
                >
                  <span className={'checkbox-box' + (checked ? ' checked' : '')}>{checked ? '✓' : ''}</span>
                  <span>
                    {f.label}
                    {f.kind === 'ai' && <span className="hint"> — uses your Anthropic API key</span>}
                  </span>
                </div>
              );
            })}
            {!aiAvailable && (
              <p className="hint" style={{ marginTop: 8 }}>
                <Link to="/settings">Enable AI features in Settings</Link> to fill in subject, summaries or tags.
              </p>
            )}
            {aiAvailable && aiCandidateCount > 0 && (
              <p className="hint" style={{ marginTop: 8 }}>
                Up to {aiCandidateCount} paper{aiCandidateCount === 1 ? '' : 's'} may need an AI call — this happens
                during the scan itself, not when you apply, so it uses your API key as soon as you tap Scan.
              </p>
            )}
          </div>

          <button type="button" className="btn btn-primary" onClick={handleScan}>
            <SparklesIcon width={18} height={18} />
            Scan library
          </button>
        </>
      )}

      {scanning && (
        <div className="empty-state">
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <p>
            Checking {progress ? `${progress.done} of ${progress.total}` : 'your library'}...
          </p>
          {progress?.title && <p className="hint">{progress.title.slice(0, 80)}</p>}
          <button type="button" className="btn btn-ghost" onClick={() => { stopRef.current = true; }}>
            Stop
          </button>
        </div>
      )}

      {plan && (
        <>
          <div className="card section">
            <p className="section-title" style={{ marginBottom: 4 }}>
              {plan.entries.length} of {plan.total} paper{plan.total === 1 ? '' : 's'} would change
            </p>
            <p className="hint">
              {plan.unchanged} already correct
              {plan.unresolved.length > 0 && ` · ${plan.unresolved.length} could not be matched`}
              {plan.failed.length > 0 && ` · ${plan.failed.length} failed to check`}
              {plan.aiFailed > 0 && ` · AI generation failed for ${plan.aiFailed}`}
              {plan.stopped && ' · scan stopped early'}
            </p>
          </div>

          {plan.entries.map(entry => {
            const key = entryKey(entry);
            const isOpen = expanded.has(key);
            const isSkipped = skipped.has(key);
            const note = CONFIDENCE_NOTE[entry.confidence];
            return (
              <div key={key} className="card">
                <div className="checkbox-row" onClick={() => toggle(skipped, setSkipped, key)} style={{ marginBottom: 4 }}>
                  <span className={'checkbox-box' + (isSkipped ? '' : ' checked')}>{isSkipped ? '' : '✓'}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.4 }}>{entry.paper.title || '(untitled)'}</span>
                </div>
                {note && <p className="hint" style={{ color: 'var(--warning)' }}>{note}</p>}
                <button type="button" className="btn btn-ghost" onClick={() => toggle(expanded, setExpanded, key)}>
                  {isOpen ? 'Hide' : `${entry.changes.length} change${entry.changes.length === 1 ? '' : 's'}`}
                  <ChevronDown width={14} height={14} style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} />
                </button>
                {isOpen && entry.changes.map(change => <FieldDiff key={change.field} change={change} />)}
              </div>
            );
          })}

          {plan.entries.length === 0 && (
            <div className="empty-state">
              <p>Nothing to change — your library is already in good shape.</p>
            </div>
          )}

          {plan.entries.length > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleApply}
              disabled={applying || accepted.length === 0}
              style={{ marginTop: 16 }}
            >
              {applying ? <span className="spinner" /> : null}
              {applying ? 'Applying...' : `Apply ${accepted.length} change${accepted.length === 1 ? '' : 's'}`}
            </button>
          )}

          <button type="button" className="btn btn-ghost" onClick={handleScan}>Scan again</button>
        </>
      )}

      {notice && (
        <p className={notice.type === 'error' ? 'error-text' : 'hint'} style={{ marginTop: 12 }}>{notice.text}</p>
      )}
    </div>
  );
}
