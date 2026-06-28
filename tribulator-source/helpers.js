import AsyncStorage from '@react-native-async-storage/async-storage';
import { SETTINGS_KEYS, getSetting } from './settings';
import { DEFAULT_IMPACT_FACTORS, BOOKMARKS_KEY, STUDY_TYPES } from './constants';

// ─── Bookmark Helpers ─────────────────────────────────────────
export async function loadBookmarks() {
  try {
    const data = await AsyncStorage.getItem(BOOKMARKS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveBookmarks(bookmarks) {
  try {
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
  } catch {}
}

// ─── Date Filter ──────────────────────────────────────────────
export function getDateFilter(range) {
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

// ─── Impact Factor ────────────────────────────────────────────
export async function getImpactFactorAsync(journalName) {
  if (!journalName) return null;
  const key = journalName.toLowerCase().trim();

  // Check user-defined impact factors first
  const customIF = await getSetting(SETTINGS_KEYS.IMPACT_FACTORS);
  if (customIF) {
    const lines = customIF.split('\n');
    for (const line of lines) {
      const [name, value] = line.split('=').map(s => s.trim().toLowerCase());
      if (name && value && (key.includes(name) || name.includes(key))) {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) return parsed;
      }
    }
  }

  // Fall back to built-in list
  if (DEFAULT_IMPACT_FACTORS[key] !== undefined) return DEFAULT_IMPACT_FACTORS[key];
  for (const [name, if_] of Object.entries(DEFAULT_IMPACT_FACTORS)) {
    if (key.includes(name) || name.includes(key)) return if_;
  }
  return null;
}

// Synchronous version using built-in list only (for quartile badge display)
export function getJournalQuartile(journalName) {
  if (!journalName) return null;
  const key = journalName.toLowerCase().trim();
  const QUARTILE_MAP = {
    'new england journal of medicine': 'Q1', 'lancet': 'Q1', 'jama': 'Q1', 'bmj': 'Q1',
    'intensive care medicine': 'Q1', 'critical care medicine': 'Q1',
    'anesthesiology': 'Q1', 'british journal of anaesthesia': 'Q1',
    'chest': 'Q1', 'annals of surgery': 'Q1', 'circulation': 'Q1',
    'american journal of respiratory and critical care medicine': 'Q1',
    'lancet respiratory medicine': 'Q1', 'nature medicine': 'Q1',
    'anaesthesia': 'Q2', 'critical care': 'Q2',
    'journal of clinical anesthesia': 'Q2', 'regional anesthesia and pain medicine': 'Q2',
    'anesthesia and analgesia': 'Q2', 'annals of intensive care': 'Q2',
    'resuscitation': 'Q2', 'pain': 'Q2',
    'acta anaesthesiologica scandinavica': 'Q3', 'paediatric anaesthesia': 'Q3',
    'journal of critical care': 'Q3', 'anaesthesia and intensive care': 'Q3',
  };
  for (const [name, q] of Object.entries(QUARTILE_MAP)) {
    if (key.includes(name) || name.includes(key)) return q;
  }
  return null;
}

// ─── HTML Entity Decoder ──────────────────────────────────────
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

// ─── Vancouver Reference ──────────────────────────────────────
export function buildVancouverReference(trial, details) {
  const journal = details.journal || '';
  const year = details.pubdate ? details.pubdate.split(' ')[0] : '';
  const volume = details.volume || '';
  const issue = details.issue ? `(${details.issue})` : '';
  const pages = details.pages || '';
  return `${journal} ${year};${volume}${issue}:${pages}`.trim();
}

// ─── Build PubMed Search Term ─────────────────────────────────
export function buildPubmedSearchTerm(query, selectedStudyTypes, medlineOnly) {
  const allTypeIds = STUDY_TYPES.map(t => t.id);
  const isAllSelected = selectedStudyTypes.length === allTypeIds.length;

  let term = query + ' AND (anaesthesia OR anesthesia OR "critical care")';

  if (!isAllSelected && selectedStudyTypes.length > 0) {
    const pts = [];
    selectedStudyTypes.forEach(id => {
      const type = STUDY_TYPES.find(t => t.id === id);
      if (type && type.pubmedPt.length > 0) {
        pts.push(...type.pubmedPt);
      }
    });
    if (pts.length > 0) {
      term += ' AND (' + pts.join(' OR ') + ')';
    }
  }

  if (medlineOnly) {
    term += ' AND medline[sb]';
  }

  return term;
}

// ─── PubMed Search ────────────────────────────────────────────
export async function fetchPubMed(query, filters) {
  const dateFilter = getDateFilter(filters.dateRange);
  const searchTerm = buildPubmedSearchTerm(query, filters.studyTypes, filters.medlineOnly);

  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchTerm)}&retmax=20&retmode=json${dateFilter}`;
  const searchRes = await fetch(searchUrl);
  const searchData = await searchRes.json();
  const ids = searchData.esearchresult?.idlist || [];
  if (ids.length === 0) return [];

  const [fetchRes, efetchRes] = await Promise.all([
    fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`),
    fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(',')}&retmode=xml&rettype=abstract`),
  ]);

  const fetchData = await fetchRes.json();
  const xmlText = await efetchRes.text();

  // Parse keywords from XML
  const keywordMap = {};
  const articles = xmlText.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) || [];
  articles.forEach(article => {
    const pmidMatch = article.match(/<PMID[^>]*>(\d+)<\/PMID>/);
    if (!pmidMatch) return;
    const pmid = pmidMatch[1];
    const kwMatches = article.match(/<Keyword[^>]*>([\s\S]*?)<\/Keyword>/g) || [];
    keywordMap[pmid] = kwMatches
      .map(kw => kw.replace(/<[^>]+>/g, '').trim())
      .filter(Boolean);
  });

  const resultsRaw = ids.map(id => {
    const art = fetchData.result?.[id];
    if (!art) return null;
    const quartile = getJournalQuartile(art.fulljournalname);
    return {
      id: `pubmed-${id}`,
      pubmedId: id,
      title: decodeHtmlEntities(art.title),
      journal: art.fulljournalname,
      pubdate: art.pubdate,
      source: 'PubMed',
      keywords: keywordMap[id] || [],
      quartile,
      mesh: art.meshheadinglist || [],
    };
  }).filter(Boolean);

  // Apply quartile filter
  let filtered = resultsRaw;
  if (filters.minQuartile && filters.minQuartile !== 'Any') {
    const order = { 'Q1': 1, 'Q2': 2, 'Q3': 3, 'Q4': 4 };
    filtered = resultsRaw.filter(r => {
      if (!r.quartile) return false;
      return order[r.quartile] <= order[filters.minQuartile];
    });
  }

  // Get impact factors and sort
  const results = await Promise.all(
    filtered.map(async item => ({
      ...item,
      impactFactor: await getImpactFactorAsync(item.journal),
    }))
  );

  return results.sort((a, b) => {
    if (a.impactFactor === null && b.impactFactor === null) return 0;
    if (a.impactFactor === null) return 1;
    if (b.impactFactor === null) return -1;
    return b.impactFactor - a.impactFactor;
  });
}

// ─── PubMed Full Details + Abstract ──────────────────────────
export async function fetchFullDetails(pubmedId) {
  const [summaryRes, abstractRes] = await Promise.all([
    fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pubmedId}&retmode=json`),
    fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pubmedId}&retmode=xml&rettype=abstract`),
  ]);

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

// ─── Resolve URL to PubMed ID ─────────────────────────────────
export async function resolveURLtoPubmedId(url) {
  const pubmedMatch = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/);
  if (pubmedMatch) return pubmedMatch[1];

  const pmcMatch = url.match(/pmc\.ncbi\.nlm\.nih\.gov\/articles\/PMC(\d+)/);
  if (pmcMatch) {
    const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi?dbfrom=pmc&db=pubmed&id=${pmcMatch[1]}&retmode=json`);
    const data = await res.json();
    const ids = data.linksets?.[0]?.linksetdbs?.[0]?.links;
    if (ids?.length) return String(ids[0]);
    throw new Error('Could not find PubMed record for this PMC article');
  }

  let doi = null;
  const doiOrgMatch = url.match(/doi\.org\/(.+)/);
  if (doiOrgMatch) doi = doiOrgMatch[1];
  const doiPathMatch = url.match(/\/(10\.\d{4,}\/[^\s?#]+)/);
  if (doiPathMatch) doi = doiPathMatch[1];

  if (doi) {
    doi = doi.replace(/[.,;]$/, '').split('?')[0].split('#')[0];
    const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(doi)}[doi]&retmode=json`);
    const data = await res.json();
    if (data.esearchresult?.idlist?.length) return data.esearchresult.idlist[0];
  }

  const piiMatch = url.match(/article\/(S[\w()-]+)\//);
  if (piiMatch) {
    const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(piiMatch[1])}[pii]&retmode=json`);
    const data = await res.json();
    if (data.esearchresult?.idlist?.length) return data.esearchresult.idlist[0];
  }

  throw new Error('Could not find a PubMed record for this URL');
}

// ─── Resolve text/reference to PubMed ID ─────────────────────
export async function resolveFromText(query) {
  // Try journal reference pattern: Journal. Year;Vol:Pages
  const refMatch = query.match(/([A-Za-z\s]+)\.\s*(\d{4});(\d+)(?:\(\d+\))?:(\d+)/);
  if (refMatch) {
    const q = `${refMatch[1].trim()}[ta] AND ${refMatch[2]}[dp] AND ${refMatch[3]}[vi] AND ${refMatch[4]}[pg]`;
    const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(q)}&retmax=5&retmode=json`);
    const data = await res.json();
    if (data.esearchresult?.idlist?.length) return data.esearchresult.idlist[0];
  }

  // Title search fallback
  const cleaned = query.replace(/^\d+\s*/, '').replace(/\bet al\b\.?/gi, '').replace(/\s+/g, ' ').trim();
  const terms = [cleaned + '[ti]', cleaned + '[tiab]'];

  for (const term of terms) {
    const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(term)}&retmax=5&retmode=json`);
    const data = await res.json();
    if (data.esearchresult?.idlist?.length) return data.esearchresult.idlist[0];
  }

  throw new Error('Could not find this paper on PubMed. Try pasting the PubMed URL directly.');
}

// ─── AI Summary ───────────────────────────────────────────────
export async function fetchAISummary(trial, abstract) {
  const apiKey = await getSetting(SETTINGS_KEYS.API_KEY);

  const prompt = `You are a clinical expert in anaesthesia and critical care. Given the following published clinical trial, provide three things for a practising clinician:

1. COMPREHENSIVE: A 5-6 sentence summary covering what was studied, the methodology, key findings, clinical relevance, and any important caveats or limitations.
2. HEADLINE: A single sentence (max 25 words) capturing the most important clinical takeaway.
3. SUBJECT: 2-4 words describing the subject area (e.g. "Airway management", "Sepsis resuscitation", "Regional anaesthesia", "ICU sedation").
4. CATEGORY: Choose all appropriate categories from this list: Airway, Cardiac, Crisis Management, Drugs, Education, ENT, Head + Neck, ICU, Interventional Radiology, Neuroanasesthesia, Obstetrics, Orthopaedics, Paediatrics, Pain, Perioperative, Plastics, Regional Anaesthesia, Resuscitation, Safety, Sedation, Thoracics, Trauma, Vascular. Return as a JSON array.

Respond in this exact JSON format with no other text:
{
  "comprehensive": "...",
  "headline": "...",
  "subject": "...",
  "category": ["..."]
}

Title: ${trial.title}
Journal: ${trial.journal}
Published: ${trial.pubdate}
Abstract: ${abstract || 'Not available'}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const text = data.content?.[0]?.text || '{}';
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ─── Export to Google Sheets ──────────────────────────────────
export async function exportToSheets(trial, details, aiSummary, retries = 5) {
  const webhookUrl = await getSetting(SETTINGS_KEYS.WEBHOOK_URL);
  const spreadsheetId = await getSetting(SETTINGS_KEYS.SPREADSHEET_ID);
  const reference = buildVancouverReference(trial, details);

  const CATEGORIES = [
    'Airway', 'Cardiac', 'Crisis Management', 'Drugs', 'Education',
    'ENT', 'Head + Neck', 'ICU', 'Interventional Radiology', 'Neuroanasesthesia',
    'Obstetrics', 'Orthopaedics', 'Paediatrics', 'Pain', 'Perioperative',
    'Plastics', 'Regional Anaesthesia', 'Resuscitation', 'Safety', 'Sedation',
    'Thoracics', 'Trauma', 'Vascular',
  ];

  const categoryFlags = {};
  CATEGORIES.forEach(cat => {
    categoryFlags[cat] = aiSummary.category?.includes(cat) ? 'TRUE' : 'FALSE';
  });

  const payload = {
    spreadsheetId,
    subject: aiSummary.subject || '',
    oss: aiSummary.headline || '',
    fullSummary: aiSummary.comprehensive || '',
    year: trial.pubdate ? trial.pubdate.split(' ')[0] : '',
    title: trial.title,
    reference,
    url: `https://pubmed.ncbi.nlm.nih.gov/${trial.pubmedId}/`,
    date: new Date().toLocaleDateString(),
    categoryFlags,
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) return;
      throw new Error(data.error || 'Export failed');
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
}

// ─── Backup bookmarks to Google Sheets ───────────────────────
export async function backupBookmarks(bookmarks) {
  const webhookUrl = await getSetting(SETTINGS_KEYS.WEBHOOK_URL);
  const spreadsheetId = await getSetting(SETTINGS_KEYS.SPREADSHEET_ID);

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'backup',
      spreadsheetId,
      bookmarks: JSON.stringify(bookmarks),
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Backup failed');
}

// ─── Restore bookmarks from Google Sheets ────────────────────
export async function restoreBookmarks() {
  const webhookUrl = await getSetting(SETTINGS_KEYS.WEBHOOK_URL);
  const spreadsheetId = await getSetting(SETTINGS_KEYS.SPREADSHEET_ID);

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'restore',
      spreadsheetId,
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Restore failed');
  return JSON.parse(data.bookmarks);
}
