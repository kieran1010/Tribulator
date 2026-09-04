import { parseDoi, parsePmid, extractDoi } from './pubmedApi';

// A paper title is nearly always longer than a keyword query. Below this the
// input is treated as a topic search unless it carries a citation marker. The
// boundary is deliberately generous towards topic searches: a title sent to a
// keyword search still turns up in the list, whereas a topic sent to a lookup
// produces one confidently wrong card.
const TITLE_MIN_WORDS = 8;

// Openings and shapes that read as a paper title rather than a topic, which
// lower the word count needed to call it one.
const TITLE_MIN_WORDS_SHAPED = 6;
const TITLE_SHAPES = [
  /^(?:the\s+)?(?:effects?|efficacy|impact|association|comparison|safety|role|use|incidence|prevalence|outcomes?|predictors|accuracy|feasibility)\s+of\b/i,
  /^association\s+between\b/i,
  /^(?:an?\s+)?(?:randomi[sz]ed|systematic\s+review|meta-analys|prospective|retrospective|multicent|double-blind)/i,
  /\S\s*:\s+\S+\s+\S/, // "Something: a subtitle of its own"
  /\b(?:randomi[sz]ed(?:\s+controlled)?\s+trial|systematic\s+review|meta-analysis)\b/i,
];

// Explicit PubMed syntax (uppercase booleans, [field] tags, truncation) means
// the user has written a query, not pasted a reference — never look that up.
const QUERY_SYNTAX = /\b(?:AND|OR|NOT)\b|\[[A-Za-z]{2,6}\]|\*/;

// Signals that the input is a citation rather than a topic. Two or more of
// these is treated as certain; one is enough on its own for a phrase long
// enough to be a reference.
const CITATION_MARKERS = [
  /\bet\s+al\b/i, // "Smith et al"
  /\(\s*(?:19|20)\d{2}[a-z]?\s*\)/, // "(2019)"
  /\bdoi\s*:/i, // a DOI trailing a full reference
  /\b(?:19|20)\d{2}\s*;\s*\d+/, // "2019;121"
  /\b\d+\s*\(\s*\d+[^)]*\)\s*:\s*\d+/, // "121(3):456"
  /\b[A-Z][a-z]+\s+[A-Z]{1,3}\b\s*[,;]/, // "Smith AB," author-with-initials
  /\bpp?\.\s*\d+/i, // "pp. 45"
  /\bvol\.?\s*\d+/i, // "vol. 121"
];

const HINTS = {
  doi: 'Detected a DOI — will look up that exact paper.',
  pmid: 'Detected a PubMed ID — will open that record.',
  citation: 'Looks like a reference — will search for that paper.',
  title: 'Looks like a paper title — will search for that paper.',
  query: 'PubMed search syntax — will run a topic search.',
  keywords: 'Topic search — filters apply.',
};

// Decides, from the input alone, whether the user is after one specific paper
// ('lookup') or a topic ('keywords'). Pure and cheap, so the search box can
// call it on every keystroke to show what it will do.
export function classifyQuery(rawInput) {
  const input = (rawInput || '').trim();
  if (!input) return { mode: null, kind: 'empty', confidence: 'high', value: null, hint: '' };

  const doi = parseDoi(input);
  if (doi) return { mode: 'lookup', kind: 'doi', confidence: 'high', value: doi, hint: HINTS.doi };

  const pmid = parsePmid(input);
  if (pmid) return { mode: 'lookup', kind: 'pmid', confidence: 'high', value: pmid, hint: HINTS.pmid };

  // A DOI buried in a pasted reference is still the most precise handle there is.
  const embeddedDoi = extractDoi(input);
  if (embeddedDoi) {
    return { mode: 'lookup', kind: 'doi', confidence: 'high', value: embeddedDoi, hint: HINTS.doi };
  }

  if (QUERY_SYNTAX.test(input)) {
    return { mode: 'keywords', kind: 'query', confidence: 'high', value: input, hint: HINTS.query };
  }

  const words = input.split(/\s+/).filter(Boolean);
  const markers = CITATION_MARKERS.filter(re => re.test(input)).length;

  if (markers > 0 && words.length >= 4) {
    return {
      mode: 'lookup',
      kind: 'citation',
      confidence: markers > 1 ? 'high' : 'medium',
      value: input,
      hint: HINTS.citation,
    };
  }

  const titleShaped = TITLE_SHAPES.some(re => re.test(input));
  const titleThreshold = titleShaped ? TITLE_MIN_WORDS_SHAPED : TITLE_MIN_WORDS;
  if (words.length >= titleThreshold) {
    return { mode: 'lookup', kind: 'title', confidence: 'medium', value: input, hint: HINTS.title };
  }

  return { mode: 'keywords', kind: 'keywords', confidence: 'high', value: input, hint: HINTS.keywords };
}
