import { PAPER_FIELDS } from './constants';
import { getAllPapers, putPaper, pubmedIdFromUrl } from './db';
import { fetchFullDetails, parseDoi, extractDoi } from './pubmedApi';
import { resolveLookup } from './lookupApi';
import { buildVancouverReference, decodeHtmlEntities } from './format';

// Fields the scan will ever propose changing. `reference` is rebuilt for every
// paper because the citation format itself changed; the rest are only filled
// when blank or repaired when demonstrably broken.
export const OPTIMISABLE_FIELDS = ['title', 'reference', 'url', 'year', 'abstract'];

const REBUILT_ALWAYS = new Set(['reference']);

// A reference the old journal-only format produced when no metadata could be
// fetched: punctuation and nothing else, e.g. ";:" or "Anaesthesia 2020;:".
const EMPTY_REFERENCE = /^[\s;:().,-]*$/;
const TRAILING_EMPTY_LOCATOR = /[;:]\s*[;:]?\s*$/;
const HTML_ENTITY = /&(?:#\d+|#x[0-9a-f]+|amp|lt|gt|quot|deg|plusmn|times|le|ge);/i;

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

// "Broken" has to be something we can point at, not merely something we would
// have written differently — anything the user may have corrected by hand must
// survive the scan untouched.
export function fieldProblem(paper, field) {
  const value = paper[field];
  if (isBlank(value)) return 'missing';
  const text = String(value);
  switch (field) {
    case 'reference':
      if (EMPTY_REFERENCE.test(text)) return 'empty';
      if (TRAILING_EMPTY_LOCATOR.test(text)) return 'truncated';
      return null;
    case 'title':
      return HTML_ENTITY.test(text) ? 'entities' : null;
    case 'year':
      return /^\d{4}$/.test(text.trim()) ? null : 'malformed';
    case 'url':
      return /^https?:\/\//i.test(text.trim()) ? null : 'malformed';
    default:
      return null;
  }
}

// The text most likely to resolve to the right record, best identifier first.
function lookupKey(paper) {
  const pmid = pubmedIdFromUrl(paper.url);
  if (pmid) return { kind: 'pmid', value: pmid };
  const doi = parseDoi(paper.url) || extractDoi(paper.url) || extractDoi(paper.reference);
  if (doi) return { kind: 'doi', value: doi };
  if (!isBlank(paper.title)) return { kind: 'title', value: decodeHtmlEntities(paper.title).trim() };
  if (!isBlank(paper.reference)) return { kind: 'reference', value: String(paper.reference).trim() };
  return null;
}

// Resolves one paper to an authoritative record. A stored PubMed ID is treated
// as certain — it names the record outright. Anything reached by matching text
// carries the cascade's own confidence, and only its best tier is trusted
// without asking, because a wrong match rewrites a paper into a different one.
async function resolvePaper(paper) {
  const key = lookupKey(paper);
  if (!key) return { status: 'unresolvable' };

  if (key.kind === 'pmid') {
    const details = await fetchFullDetails(key.value);
    if (!details || (!details.journal && !details.pubdate)) return { status: 'unresolvable' };
    return {
      status: 'resolved',
      confidence: 'certain',
      pubmedId: key.value,
      trial: { title: paper.title, pubmedId: key.value },
      details,
    };
  }

  const resolved = await resolveLookup(key.value);
  if (!resolved?.trial) return { status: 'unresolvable' };

  const trial = resolved.trial;
  const pubmedId = trial.pubmedId || null;
  const details = pubmedId
    ? await fetchFullDetails(pubmedId)
    : trial.crossrefDetails || {};

  return {
    status: 'resolved',
    // Only a DOI names a record outright; everything else was matched on text.
    confidence: key.kind === 'doi' && resolved.confidence === 'high' ? 'certain' : (resolved.confidence || 'low'),
    pubmedId,
    trial: { ...trial, title: trial.title || paper.title },
    details,
  };
}

// What the record would become. Blank proposals are dropped: replacing a value
// with nothing is never an improvement.
function proposeChanges(paper, resolution) {
  const { trial, details, pubmedId } = resolution;
  const proposed = {
    title: decodeHtmlEntities(trial.title || paper.title || '').trim(),
    reference: buildVancouverReference(trial, details || {}),
    url: pubmedId ? `https://pubmed.ncbi.nlm.nih.gov/${pubmedId}/` : (trial.url || paper.url || ''),
    year: details?.pubdate ? String(details.pubdate).split(' ')[0] : (paper.year || ''),
    abstract: details?.abstract || paper.abstract || '',
  };

  const changes = [];
  for (const field of OPTIMISABLE_FIELDS) {
    const next = proposed[field];
    if (isBlank(next)) continue;
    const current = paper[field] ?? '';
    if (String(current).trim() === String(next).trim()) continue;

    const problem = fieldProblem(paper, field);
    // Everything except the reference is only touched when it is missing or
    // demonstrably broken — a value that merely differs is left as the user
    // has it.
    if (!REBUILT_ALWAYS.has(field) && !problem) continue;

    changes.push({ field, from: current, to: next, reason: problem || 'reformatted' });
  }
  return changes;
}

// Scans the library and returns what it would change, without writing anything.
// `onProgress({ done, total, title })` is called as each paper is examined.
export async function planOptimisation({ onProgress, shouldStop } = {}) {
  const papers = await getAllPapers();
  const plan = { total: papers.length, entries: [], unresolved: [], unchanged: 0, failed: [] };

  for (let i = 0; i < papers.length; i++) {
    if (shouldStop?.()) {
      plan.stopped = true;
      break;
    }
    const paper = papers[i];
    onProgress?.({ done: i, total: papers.length, title: paper.title });

    let resolution;
    try {
      resolution = await resolvePaper(paper);
    } catch (e) {
      plan.failed.push({ paper, message: e.message });
      continue;
    }

    if (resolution.status !== 'resolved') {
      plan.unresolved.push(paper);
      continue;
    }

    const changes = proposeChanges(paper, resolution);
    if (changes.length === 0) plan.unchanged++;
    else plan.entries.push({ paper, changes, confidence: resolution.confidence });
  }

  onProgress?.({ done: papers.length, total: papers.length, title: '' });
  return plan;
}

// Writes the accepted entries. Every write goes through putPaper, so sync
// bookkeeping and per-field edit times are stamped exactly as a manual edit
// would be.
export async function applyOptimisation(entries) {
  let applied = 0;
  for (const entry of entries) {
    const updated = { ...entry.paper };
    for (const change of entry.changes) {
      if (PAPER_FIELDS.includes(change.field)) updated[change.field] = change.to;
    }
    await putPaper(updated);
    applied++;
  }
  return applied;
}
