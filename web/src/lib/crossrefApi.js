// CrossRef needs no API key, but including a real contact email routes requests
// to their faster, more reliable "polite pool".
// TODO: replace with a real Hypnos Medical contact address before shipping.
const CROSSREF_CONTACT_EMAIL = 'contact@hypnosmedical.example';

function mapCrossrefWork(item) {
  if (!item) return null;
  const title = Array.isArray(item.title) ? item.title[0] : item.title;
  const journal = Array.isArray(item['container-title']) ? item['container-title'][0] : item['container-title'];
  const year =
    item['published-print']?.['date-parts']?.[0]?.[0] ||
    item['published-online']?.['date-parts']?.[0]?.[0] ||
    item.issued?.['date-parts']?.[0]?.[0] ||
    null;
  const authors = (item.author || []).map(a => [a.given, a.family].filter(Boolean).join(' ')).join(', ');

  return {
    doi: item.DOI || null,
    title: title || '',
    journal: journal || '',
    year,
    authors,
    volume: item.volume || '',
    issue: item.issue || '',
    pages: item.page || '',
    // CrossRef abstracts (when present at all) come wrapped in JATS <jats:p> tags.
    abstract: item.abstract ? item.abstract.replace(/<[^>]+>/g, '').trim() : '',
    score: item.score,
  };
}

export async function fetchCrossrefByDoi(doi) {
  const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}?mailto=${encodeURIComponent(CROSSREF_CONTACT_EMAIL)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return mapCrossrefWork(data.message);
}

export async function searchCrossrefBibliographic(refText) {
  const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(refText)}&rows=5&mailto=${encodeURIComponent(CROSSREF_CONTACT_EMAIL)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.message?.items || []).map(mapCrossrefWork).filter(Boolean);
}
