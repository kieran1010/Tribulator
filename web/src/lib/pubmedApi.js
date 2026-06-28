import { STUDY_TYPES } from './constants';
import { decodeHtmlEntities, getJournalQuartile, getImpactFactor } from './format';

// NCBI caps unauthenticated traffic at ~3 req/sec. A throttled response omits
// the CORS header entirely, which browsers then surface as an opaque "blocked
// by CORS policy" error instead of a rate-limit one. This queue serializes
// every eutils call with a minimum gap so normal use (and even fast clicking
// through search -> detail) never bursts past that limit.
let eutilsQueue = Promise.resolve();
let lastEutilsCall = 0;
const EUTILS_MIN_GAP_MS = 350;

function fetchEutils(url) {
  const result = eutilsQueue.then(async () => {
    const wait = Math.max(0, EUTILS_MIN_GAP_MS - (Date.now() - lastEutilsCall));
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastEutilsCall = Date.now();
    return fetch(url);
  });
  eutilsQueue = result.catch(() => {});
  return result;
}

function getDateFilter(range) {
  const now = new Date();
  if (range === 'Last Month') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return `&datetype=pdat&mindate=${d.toISOString().split('T')[0]}&maxdate=${now.toISOString().split('T')[0]}`;
  }
  if (range === 'Last Year') {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - 1);
    return `&datetype=pdat&mindate=${d.toISOString().split('T')[0]}&maxdate=${now.toISOString().split('T')[0]}`;
  }
  if (range === 'Last 5 Years') {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - 5);
    return `&datetype=pdat&mindate=${d.toISOString().split('T')[0]}&maxdate=${now.toISOString().split('T')[0]}`;
  }
  return '';
}

export function buildPubmedSearchTerm(query, selectedStudyTypes, medlineOnly) {
  const allTypeIds = STUDY_TYPES.map(t => t.id);
  const isAllSelected = selectedStudyTypes.length === allTypeIds.length;

  let term = query + ' AND (anaesthesia OR anesthesia OR "critical care")';

  if (!isAllSelected && selectedStudyTypes.length > 0) {
    const pts = [];
    selectedStudyTypes.forEach(id => {
      const type = STUDY_TYPES.find(t => t.id === id);
      if (type && type.pubmedPt.length > 0) pts.push(...type.pubmedPt);
    });
    if (pts.length > 0) term += ' AND (' + pts.join(' OR ') + ')';
  }

  if (medlineOnly) term += ' AND medline[sb]';

  return term;
}

export async function fetchPubMed(query, filters) {
  const dateFilter = getDateFilter(filters.dateRange);
  const searchTerm = buildPubmedSearchTerm(query, filters.studyTypes, filters.medlineOnly);

  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchTerm)}&retmax=20&retmode=json${dateFilter}`;
  const searchRes = await fetchEutils(searchUrl);
  const searchData = await searchRes.json();
  const ids = searchData.esearchresult?.idlist || [];
  if (ids.length === 0) return [];

  const summaryRes = await fetchEutils(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`);
  const efetchRes = await fetchEutils(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(',')}&retmode=xml&rettype=abstract`);

  const summaryData = await summaryRes.json();
  const xmlText = await efetchRes.text();

  const keywordMap = {};
  const articles = xmlText.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) || [];
  articles.forEach(article => {
    const pmidMatch = article.match(/<PMID[^>]*>(\d+)<\/PMID>/);
    if (!pmidMatch) return;
    const pmid = pmidMatch[1];
    const kwMatches = article.match(/<Keyword[^>]*>([\s\S]*?)<\/Keyword>/g) || [];
    keywordMap[pmid] = kwMatches.map(kw => kw.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
  });

  const resultsRaw = ids.map(id => {
    const art = summaryData.result?.[id];
    if (!art) return null;
    return {
      id: `pubmed-${id}`,
      pubmedId: id,
      title: decodeHtmlEntities(art.title),
      journal: art.fulljournalname,
      pubdate: art.pubdate,
      source: 'PubMed',
      keywords: keywordMap[id] || [],
      quartile: getJournalQuartile(art.fulljournalname),
      mesh: art.meshheadinglist || [],
    };
  }).filter(Boolean);

  let filtered = resultsRaw;
  if (filters.minQuartile && filters.minQuartile !== 'Any') {
    const order = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
    filtered = resultsRaw.filter(r => r.quartile && order[r.quartile] <= order[filters.minQuartile]);
  }

  const results = filtered.map(item => ({ ...item, impactFactor: getImpactFactor(item.journal) }));

  return results.sort((a, b) => {
    if (a.impactFactor === null && b.impactFactor === null) return 0;
    if (a.impactFactor === null) return 1;
    if (b.impactFactor === null) return -1;
    return b.impactFactor - a.impactFactor;
  });
}

export async function fetchFullDetails(pubmedId) {
  const summaryRes = await fetchEutils(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pubmedId}&retmode=json`);
  const abstractRes = await fetchEutils(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pubmedId}&retmode=xml&rettype=abstract`);

  const summaryData = await summaryRes.json();
  const art = summaryData.result?.[pubmedId];

  const xmlText = await abstractRes.text();
  let abstract = '';
  const abstractMatch = xmlText.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g);
  if (abstractMatch) {
    abstract = abstractMatch
      .map(block => {
        const labelMatch = block.match(/Label="([^"]+)"/);
        const textMatch = block.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/);
        const label = labelMatch ? `${labelMatch[1]}: ` : '';
        const text = textMatch ? textMatch[1].replace(/<[^>]+>/g, '') : '';
        return `${label}${text}`;
      })
      .map(decodeHtmlEntities)
      .join('\n\n');
  }

  return {
    authors: art?.authors?.map(a => a.name).join(', '),
    journal: art?.fulljournalname,
    volume: art?.volume,
    issue: art?.issue,
    pages: art?.pages,
    pubdate: art?.pubdate,
    doi: art?.elocationid,
    abstract,
  };
}
