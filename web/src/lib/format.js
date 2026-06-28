import { JOURNAL_QUARTILES } from './constants';

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

export function buildVancouverReference(trial, details) {
  const journal = details.journal || '';
  const year = details.pubdate ? details.pubdate.split(' ')[0] : '';
  const volume = details.volume || '';
  const issue = details.issue ? `(${details.issue})` : '';
  const pages = details.pages || '';
  return `${journal} ${year};${volume}${issue}:${pages}`.trim();
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
