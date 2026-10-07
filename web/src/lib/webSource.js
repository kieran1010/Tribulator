// Helpers for importing sources that aren't indexed papers (newsletter
// articles, guidelines, web pages): spotting a web address in the search box,
// and normalising it so the same page saved twice is recognised as one.

// A whole input that is a single web address. Anything with spaces around it
// is a pasted reference or a topic, not a link to import.
const WEB_URL_PATTERN = /^(?:https?:\/\/|www\.)[^\s]+\.[^\s]+$/i;

export function isWebUrl(input) {
  return WEB_URL_PATTERN.test((input || '').trim());
}

// Query parameters that only record how the link was shared (newsletter
// campaigns, social media), never which page it is.
const TRACKING_PARAM = /^(?:utm_[a-z_]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|_hsenc|_hsmi|mkt_tok)$/i;

// Strips tracking parameters and the #fragment, and adds a missing scheme.
// Returns the input unchanged if it can't be parsed as a URL.
export function canonicaliseUrl(input) {
  let raw = (input || '').trim();
  if (/^www\./i.test(raw)) raw = `https://${raw}`;
  try {
    const url = new URL(raw);
    [...url.searchParams.keys()].forEach(key => {
      if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
    });
    url.hash = '';
    return url.toString();
  } catch {
    return raw;
  }
}

// A saved record whose link is an ordinary web page rather than a PubMed or
// DOI link — the only kind whose details came from reading the page itself.
export function isWebSourceUrl(url) {
  return isWebUrl(url) && !/pubmed\.ncbi\.nlm\.nih\.gov|(?:^|\/\/|\.)doi\.org\//i.test(url);
}
