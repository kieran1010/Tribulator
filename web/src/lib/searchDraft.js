import { DATE_FILTERS, DEFAULT_FILTERS, QUARTILE_FILTERS, STUDY_TYPES } from './constants';

// sessionStorage rather than localStorage: coming back from results should find
// the search as you left it, but launching the app fresh should not resurrect
// last week's query.
const KEY = 'tribulator_search_draft';

const STUDY_TYPE_IDS = STUDY_TYPES.map(t => t.id);

// A stored draft is untrusted input — it survives across reloads and app
// versions. Anything unrecognised falls back to the default, so a stale or
// hand-edited draft can never reach fetchPubMed as a malformed filter set.
function safeFilters(raw) {
  if (!raw || typeof raw !== 'object') return DEFAULT_FILTERS;
  const studyTypes = Array.isArray(raw.studyTypes)
    ? raw.studyTypes.filter(id => STUDY_TYPE_IDS.includes(id))
    : DEFAULT_FILTERS.studyTypes;
  return {
    dateRange: DATE_FILTERS.includes(raw.dateRange) ? raw.dateRange : DEFAULT_FILTERS.dateRange,
    minQuartile: QUARTILE_FILTERS.includes(raw.minQuartile) ? raw.minQuartile : DEFAULT_FILTERS.minQuartile,
    medlineOnly: typeof raw.medlineOnly === 'boolean' ? raw.medlineOnly : DEFAULT_FILTERS.medlineOnly,
    // Every study type deselected would silently match nothing, so treat an
    // empty selection as "no study-type filter" instead.
    studyTypes: studyTypes.length > 0 ? studyTypes : DEFAULT_FILTERS.studyTypes,
  };
}

export function loadSearchDraft() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (!raw) return null;
    return {
      query: typeof raw.query === 'string' ? raw.query : '',
      filters: safeFilters(raw.filters),
      showFilters: raw.showFilters === true,
    };
  } catch {
    return null;
  }
}

export function saveSearchDraft(draft) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Private browsing and full quotas both throw here; losing the draft is
    // not worth breaking the search screen over.
  }
}
