import {
  parseDoi,
  searchPubmedIdByDoi,
  searchPubmedByTitle,
  searchPubmedGeneral,
  pmidsToTrials,
} from './pubmedApi';
import { fetchCrossrefByDoi, searchCrossrefBibliographic } from './crossrefApi';
import { getJournalQuartile } from './format';

// Wraps a CrossRef-only record (no PubMed record found) into the same "trial"
// shape ResultsScreen/DetailScreen already know how to render and save.
// `notInPubmed` and `crossrefDetails` are the two fields DetailScreen checks
// for that aren't present on ordinary PubMed trials.
function crossrefToTrial(cr) {
  const pubdate = cr.year ? String(cr.year) : '';
  return {
    id: `crossref-${cr.doi || cr.title}`,
    pubmedId: null,
    title: cr.title,
    journal: cr.journal,
    pubdate,
    source: 'CrossRef',
    keywords: [],
    quartile: getJournalQuartile(cr.journal),
    mesh: [],
    url: cr.doi ? `https://doi.org/${cr.doi}` : '',
    notInPubmed: true,
    crossrefDetails: {
      authors: cr.authors,
      journal: cr.journal,
      volume: cr.volume,
      issue: cr.issue,
      pages: cr.pages,
      pubdate,
      doi: cr.doi,
      abstract: cr.abstract,
    },
  };
}

// A CrossRef bibliographic-search top hit is treated as confident when it's
// well clear of the runner-up score, rather than by a fixed absolute threshold
// (CrossRef relevance scores aren't normalized/comparable across queries).
function isConfidentTop(candidates) {
  if (candidates.length <= 1) return true;
  const [best, second] = candidates;
  if (!best.score || !second.score) return false;
  return (best.score - second.score) / best.score > 0.25;
}

// Resolves free-form input (DOI / title / pasted reference) to a PubMed (or,
// failing that, CrossRef) record via a DOI -> title -> CrossRef -> general
// cascade. `onStep(message)` is called before each network step so the UI can
// show which stage of the cascade is running.
export async function resolveSmartSearch(rawInput, onStep) {
  const input = (rawInput || '').trim();
  if (!input) return { matchedVia: null, trial: null, alternatives: [] };

  const doi = parseDoi(input);
  if (doi) {
    onStep?.('Searching PubMed by DOI...');
    const pmid = await searchPubmedIdByDoi(doi);
    if (pmid) {
      const [trial] = await pmidsToTrials([pmid]);
      return { matchedVia: 'doi-pubmed', trial, alternatives: [], confidence: 'high' };
    }
    onStep?.('Not indexed in PubMed - trying CrossRef...');
    const cr = await fetchCrossrefByDoi(doi);
    if (cr) {
      return { matchedVia: 'doi-crossref', trial: crossrefToTrial(cr), alternatives: [], confidence: 'high' };
    }
    return { matchedVia: null, trial: null, alternatives: [], notFound: true };
  }

  onStep?.('Searching PubMed by title...');
  const titleIds = await searchPubmedByTitle(input);
  if (titleIds.length >= 1 && titleIds.length <= 3) {
    const trials = await pmidsToTrials(titleIds);
    return {
      matchedVia: 'title',
      trial: trials[0],
      alternatives: trials.slice(1),
      confidence: titleIds.length === 1 ? 'high' : 'medium',
    };
  }

  onStep?.('Trying CrossRef reference lookup...');
  const candidates = await searchCrossrefBibliographic(input);
  if (candidates.length > 0) {
    const best = candidates[0];
    const confident = isConfidentTop(candidates);

    onStep?.('Confirming match in PubMed...');
    const pmid = best.doi ? await searchPubmedIdByDoi(best.doi) : null;
    const trial = pmid ? (await pmidsToTrials([pmid]))[0] : crossrefToTrial(best);
    const alternatives = candidates.slice(1, 4).map(crossrefToTrial);

    return {
      matchedVia: pmid ? 'reference-crossref-pubmed' : 'reference-crossref',
      trial,
      alternatives,
      confidence: confident ? 'high' : 'low',
    };
  }

  onStep?.('Trying a general PubMed search...');
  const fallbackIds = await searchPubmedGeneral(input);
  if (fallbackIds.length > 0) {
    const trials = await pmidsToTrials(fallbackIds);
    return { matchedVia: 'fallback', trial: trials[0], alternatives: trials.slice(1), confidence: 'low' };
  }

  return { matchedVia: null, trial: null, alternatives: [], notFound: true };
}
