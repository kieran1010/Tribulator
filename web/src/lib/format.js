import { JOURNAL_QUARTILES, PUBLICATION_TYPE_RULES } from './constants';

export function decodeHtmlEntities(text) {
  if (!text) return text;
  return text
    .replace(/&#xb0;/gi, '°').replace(/&#x2013;/gi, '–').replace(/&#x2014;/gi, '—')
    .replace(/&#xb1;/gi, '±').replace(/&#xd7;/gi, '×').replace(/&#xf7;/gi, '÷')
    .replace(/&#x3c;/gi, '<').replace(/&#x3e;/gi, '>').replace(/&#x2264;/gi, '≤')
    .replace(/&#x2265;/gi, '≥').replace(/&#x3b1;/gi, 'α').replace(/&#x3b2;/gi, 'β')
    .replace(/&#x3bc;/gi, 'μ').replace(/&#x3c3;/gi, 'σ').replace(/&#x2082;/gi, '₂')
    .replace(/&#xae;/gi, '®').replace(/&#xa9;/gi, '©').replace(/&#x26;/gi, '&')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&deg;/gi, '°').replace(/&plusmn;/gi, '±').replace(/&times;/gi, '×')
    .replace(/&le;/gi, '≤').replace(/&ge;/gi, '≥')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// Vancouver lists the first six authors, then "et al".
const MAX_LISTED_AUTHORS = 6;

function formatAuthors(authors) {
  const names = (typeof authors === 'string' ? authors.split(/,\s*/) : authors || [])
    .map(a => (a || '').trim())
    .filter(Boolean);
  if (names.length === 0) return '';
  if (names.length <= MAX_LISTED_AUTHORS) return names.join(', ');
  return `${names.slice(0, MAX_LISTED_AUTHORS).join(', ')}, et al`;
}

// Vancouver elides the repeated leading digits of the closing page:
// 1424-1436 becomes 1424-36, 301-310 becomes 301-10.
function abbreviatePages(pages) {
  const match = /^(\d+)\s*[-–]\s*(\d+)$/.exec((pages || '').trim());
  if (!match) return (pages || '').trim();
  const [, start, end] = match;
  if (end.length !== start.length) return `${start}-${end}`;
  let shared = 0;
  while (shared < start.length - 1 && start[shared] === end[shared]) shared++;
  return `${start}-${end.slice(shared)}`;
}

function stripTrailingPunctuation(text) {
  return (text || '').trim().replace(/[.\s]+$/, '');
}

// A full Vancouver citation: authors, article title, abbreviated journal,
// year, volume, issue and pages. Every part is optional, because a record
// resolved from CrossRef — or one that failed to resolve at all — may be
// missing any of them, and half a citation still beats the ";:" that the
// previous journal-only format produced when nothing could be fetched.
export function buildVancouverReference(trial, details) {
  const authors = formatAuthors(details.authors);
  const title = stripTrailingPunctuation(decodeHtmlEntities(trial?.title || ''));
  // `source` is PubMed's abbreviated journal title, which is what Vancouver
  // wants; fall back to the full name when only that is available.
  const journal = stripTrailingPunctuation(details.journalAbbrev || details.journal || '');
  const year = details.pubdate ? String(details.pubdate).split(' ')[0] : '';
  const volume = details.volume || '';
  const issue = details.issue ? `(${details.issue})` : '';
  const pages = abbreviatePages(details.pages);

  // Journal, year, volume and pages form the locator; assembled separately so
  // the separators only appear when the pieces either side of them exist.
  let locator = journal;
  if (year) locator += `${locator ? '. ' : ''}${year}`;
  if (volume || issue) locator += `${year ? ';' : locator ? '. ' : ''}${volume}${issue}`;
  if (pages) locator += `${volume || issue || year ? ':' : locator ? '. ' : ''}${pages}`;

  const parts = [authors, title, locator].map(p => p.trim()).filter(Boolean);
  return parts.length ? `${parts.join('. ')}.` : '';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-09-04" -> "2026 Sep 4", "2026-09" -> "2026 Sep", "2026" -> "2026".
// Anything else is returned as given rather than guessed at.
export function formatCitationDate(date) {
  const match = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/.exec((date || '').trim());
  if (!match) return (date || '').trim();
  const [, year, month, day] = match;
  const monthName = month ? MONTHS[Number(month) - 1] : '';
  return [year, monthName, monthName && day ? String(Number(day)) : ''].filter(Boolean).join(' ');
}

// A Vancouver (Citing Medicine) reference for something read on the web — a
// newsletter article, guideline or web page — with the "[Internet]", "[cited]"
// and "Available from" parts that format requires. As with journal articles,
// every part is optional and only appears when it exists.
export function buildWebReference(source, citedOn = new Date()) {
  const authors = formatAuthors(source.authors);
  const title = stripTrailingPunctuation(source.title);
  const container = stripTrailingPunctuation(source.source);
  const published = formatCitationDate(source.published || source.year);
  const cited = formatCitationDate(citedOn.toISOString().slice(0, 10));
  const volume = source.volume || '';
  const issue = source.issue ? `(${source.issue})` : '';
  const pages = abbreviatePages(source.pages);

  let locator = container ? `${container} [Internet]` : '';
  const dated = [published, `[cited ${cited}]`].filter(Boolean).join(' ');
  locator += `${locator ? '. ' : ''}${dated}`;
  if (volume || issue) locator += `;${volume}${issue}`;
  if (pages) locator += `${volume || issue ? ':' : ';'}${pages}`;

  const parts = [authors, title, locator].map(p => p.trim()).filter(Boolean);
  let reference = parts.length ? `${parts.join('. ')}.` : '';
  if (source.url) reference += ` Available from: ${source.url}`;
  if (source.doi) reference += ` doi:${source.doi}`;
  return reference.trim();
}

// Collapses PubMed's publication-type list (e.g. ["Journal Article",
// "Randomized Controlled Trial"]) into one category for the Saved screen's
// type filter, via PUBLICATION_TYPE_RULES. Empty/unknown input returns ''
// rather than guessing — only a real "Journal Article" with nothing more
// specific attached counts as "Original Research".
export function classifyPublicationType(pubTypes) {
  const types = (pubTypes || []).filter(Boolean);
  if (types.length === 0) return '';
  for (const rule of PUBLICATION_TYPE_RULES) {
    if (types.some(t => rule.match.includes(t) || (rule.prefix && t.startsWith(rule.prefix)))) {
      return rule.label;
    }
  }
  return 'Original Research';
}

export function getJournalQuartile(journalName) {
  if (!journalName) return null;
  const key = journalName.toLowerCase().trim();
  if (JOURNAL_QUARTILES[key] !== undefined) return JOURNAL_QUARTILES[key];
  for (const [name, q] of Object.entries(JOURNAL_QUARTILES)) {
    if (key.includes(name) || name.includes(key)) return q;
  }
  return null;
}
