import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_IMPACT_FACTORS, JOURNAL_QUARTILES } from './constants';
import { SETTINGS_KEYS, getSetting } from './settings';

export const BOOKMARKS_KEY = 'tribulator_bookmarks';

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

  const customIF = await getSetting(SETTINGS_KEYS.IMPACT_FACTORS);
  if (customIF) {
    const lines = customIF.split('\n');
    for (const line of lines) {
      const [name, value] = line.split('=').map(s => s.trim());
      if (name && value && key === name.toLowerCase()) {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) return parsed;
      }
    }
  }

  for (const [name, if_] of Object.entries(DEFAULT_IMPACT_FACTORS)) {
    if (key === name.toLowerCase()) return if_;
  }

  for (const [name, if_] of Object.entries(DEFAULT_IMPACT_FACTORS)) {
    const lowerName = name.toLowerCase();
    const lengthDiff = Math.abs(key.length - lowerName.length);
    if (lengthDiff <= 10 && (key.includes(lowerName) || lowerName.includes(key))) {
      return if_;
    }
  }
  return null;
}

// ─── Journal Quartile ─────────────────────────────────────────
export function getJournalQuartile(journalName) {
  if (!journalName) return null;
  const key = journalName.toLowerCase().trim();

  for (const [name, quartile] of Object.entries(JOURNAL_QUARTILES)) {
    if (key === name.toLowerCase()) return quartile;
  }

  for (const [name, quartile] of Object.entries(JOURNAL_QUARTILES)) {
    const lowerName = name.toLowerCase();
    const lengthDiff = Math.abs(key.length - lowerName.length);
    if (lengthDiff <= 10 && (key.includes(lowerName) || lowerName.includes(key))) {
      return quartile;
    }
  }
  return null;
}

// ─── HTML Entity Decoder ──────────────────────────────────────
export function decodeHtmlEntities(text) {
  if (!text) return text;
  return text
    .replace(/&#xb0;/gi, '°')
    .replace(/&#x2013;/gi, '–')
    .replace(/&#x2014;/gi, '—')
    .replace(/&#xb1;/gi, '±')
    .replace(/&#xd7;/gi, '×')
    .replace(/&#xf7;/gi, '÷')
    .replace(/&#x3c;/gi, '<')
    .replace(/&#x3e;/gi, '>')
    .replace(/&#x2264;/gi, '≤')
    .replace(/&#x2265;/gi, '≥')
    .replace(/&#x3b1;/gi, 'α')
    .replace(/&#x3b2;/gi, 'β')
    .replace(/&#x3b3;/gi, 'γ')
    .replace(/&#x3bc;/gi, 'μ')
    .replace(/&#x3c3;/gi, 'σ')
    .replace(/&#x3c7;/gi, 'χ')
    .replace(/&#x2082;/gi, '₂')
    .replace(/&#x2081;/gi, '₁')
    .replace(/&#xae;/gi, '®')
    .replace(/&#xa9;/gi, '©')
    .replace(/&#x26;/gi, '&')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&deg;/gi, '°')
    .replace(/&plusmn;/gi, '±')
    .replace(/&times;/gi, '×')
    .replace(/&divide;/gi, '÷')
    .replace(/&le;/gi, '≤')
    .replace(/&ge;/gi, '≥')
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

// ─── PubMed Search ────────────────────────────────────────────
export async function fetchPubMed(query, dateRange, page = 0, medlineOnly = false, studyTypes = [], totalStudyTypes = 5) {
  const dateFilter = getDateFilter(dateRange);
  const retstart = page * 20;
  const medlineFilter = medlineOnly ? ' AND medline[sb]' : '';
  const studyTypeFilter = studyTypes.length > 0 && studyTypes.length < totalStudyTypes
    ? ` AND (${studyTypes.join(' OR ')})`
    : '';

  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query + medlineFilter + studyTypeFilter)}&retmax=20&retstart=${retstart}&retmode=json${dateFilter}`;

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

  const keywordMap = {};
  const meshMap = {};
  const articles = xmlText.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) || [];
  articles.forEach(article => {
    const pmidMatch = article.match(/<PMID[^>]*>(\d+)<\/PMID>/);
    if (!pmidMatch) return;
    const pmid = pmidMatch[1];

    const kwMatches = article.match(/<Keyword[^>]*>([\s\S]*?)<\/Keyword>/g) || [];
    keywordMap[pmid] = kwMatches
      .map(kw => kw.replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' '))
      .map(decodeHtmlEntities)
      .filter(Boolean);

    const meshMatches = article.match(/<DescriptorName[^>]*>([\s\S]*?)<\/DescriptorName>/g) || [];
    meshMap[pmid] = meshMatches
      .map(m => m.replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' '))
      .map(decodeHtmlEntities)
      .filter(Boolean);
  });

  const resultsRaw = ids.map(id => {
    const art = fetchData.result?.[id];
    if (!art) return null;
    return {
      id: `pubmed-${id}`,
      pubmedId: id,
      title: art.title,
      status: 'Published',
      journal: art.fulljournalname,
      pubdate: art.pubdate,
      source: 'PubMed',
      keywords: keywordMap[id] || [],
      mesh: meshMap[id] || [],
      quartile: getJournalQuartile(art.fulljournalname),
    };
  }).filter(Boolean);

  const results = await Promise.all(
    resultsRaw.map(async item => ({
      ...item,
      impactFactor: await getImpactFactorAsync(item.journal),
    }))
  );

  return results.sort((a, b) => {
    const dateA = new Date(a.pubdate);
    const dateB = new Date(b.pubdate);
    return dateB - dateA;
  });
}

// ─── PubMed Full Details + Abstract ──────────────────────────
export async function fetchFullDetails(pubmedId, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
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

      // If no abstract found and we have retries left, wait and try again
      if (!abstract && attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
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
    } catch (e) {
      if (attempt === retries) throw e;
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

// ─── AI Summary ───────────────────────────────────────────────
export async function fetchAISummary(trial, abstract) {
  const apiKey = await getSetting(SETTINGS_KEYS.API_KEY);

  const categories = [
    'Airway', 'Cardiac', 'Crisis Management', 'Drugs', 'Education',
    'ENT', 'Head + Neck', 'ICU', 'Interventional Radiology', 'Neuroanasesthesia',
    'Obstetrics', 'Orthopaedics', 'Paediatrics', 'Pain', 'Perioperative',
    'Plastics', 'Regional Anaesthesia', 'Resuscitation', 'Safety', 'Sedation',
    'Thoracics', 'Trauma', 'Vascular'
  ];

  const prompt = `You are a clinical expert in anaesthesia and critical care. Given the following published clinical trial, provide four things for a practising clinician:

1. COMPREHENSIVE: A 5-6 sentence summary covering what was studied, the methodology, key findings, clinical relevance, and any important caveats or limitations.
2. HEADLINE: A single sentence (max 25 words) capturing the most important clinical takeaway.
3. SUBJECT: 2-4 words describing the subject area (e.g. "Airway management", "Sepsis resuscitation", "Regional anaesthesia", "ICU sedation").
4. CATEGORY: Choose all appropriate categories from this list: ${categories.join(', ')}. Return as a JSON array of strings. Choose as many as are relevant but avoid over-categorising.

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
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const text = data.content?.[0]?.text || '{}';
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ─── Export to Sheets ─────────────────────────────────────────
export async function exportToSheets(trial, details, aiSummary, retries = 5) {
  const webhookUrl = await getSetting(SETTINGS_KEYS.WEBHOOK_URL);
  const spreadsheetId = await getSetting(SETTINGS_KEYS.SPREADSHEET_ID);
  const reference = buildVancouverReference(trial, details);

  const categories = [
    'Airway', 'Cardiac', 'Crisis Management', 'Drugs', 'Education',
    'ENT', 'Head + Neck', 'ICU', 'Interventional Radiology', 'Neuroanasesthesia',
    'Obstetrics', 'Orthopaedics', 'Paediatrics', 'Pain', 'Perioperative',
    'Plastics', 'Regional Anaesthesia', 'Resuscitation', 'Safety', 'Sedation',
    'Thoracics', 'Trauma', 'Vascular'
  ];

const selectedCategories = aiSummary && Array.isArray(aiSummary.category)
    ? aiSummary.category
    : aiSummary && aiSummary.category
    ? [aiSummary.category]
    : [];

  const categoryFlags = categories.reduce((acc, cat) => {
    acc[cat] = selectedCategories.includes(cat) ? 'TRUE' : 'FALSE';
    return acc;
  }, {});

  const payload = {
    spreadsheetId,
    subject: aiSummary.subject,
    oss: aiSummary.headline,
    fullSummary: aiSummary.comprehensive,
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