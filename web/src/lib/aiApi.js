import { TAGS, WEB_SOURCE_TYPES } from './constants';
import { SETTINGS_KEYS, getSetting } from './storage';

const CLAUDE_MODEL = 'claude-opus-5-5';
const API_URL = 'https://api.anthropic.com/v1/messages';

// Opus 5.5 always thinks, and its thinking counts towards max_tokens, so the
// limit has to leave room for that as well as the JSON reply.
const MAX_TOKENS = 16000;

// If a safety classifier declines a request (rare for clinical material, but
// possible), the API re-runs it on Anthropic's recommended fallback model
// instead of returning nothing.
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

// Server tools (web fetch) run a loop on Anthropic's side that can pause and
// ask to be resumed; this bounds how many times that's honoured.
const MAX_CONTINUATIONS = 3;

function requireApiKey() {
  const apiKey = getSetting(SETTINGS_KEYS.API_KEY);
  if (!apiKey) throw new Error('No Anthropic API key set in Settings');
  return apiKey;
}

// Takes the outermost {...} so stray prose or code fences around the JSON
// don't break parsing.
function parseJsonReply(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('The AI reply did not contain the expected details.');
  return JSON.parse(text.slice(start, end + 1));
}

async function postMessages(apiKey, body, withFallback) {
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  if (withFallback) headers['anthropic-beta'] = FALLBACK_BETA;
  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(withFallback ? { ...body, fallbacks: 'default' } : body),
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`The Anthropic API returned an unreadable response (HTTP ${res.status}).`);
  }
  return data;
}

// Sends one prompt (a string, or content blocks such as a PDF followed by the
// instructions) and returns every content block of the reply (across any
// pause/resume rounds) plus the reply's final text.
async function callClaude({ prompt, tools, effort = 'medium' }) {
  const apiKey = requireApiKey();
  const messages = [{ role: 'user', content: prompt }];
  const blocks = [];
  let withFallback = true;
  let data;

  for (let round = 0; round <= MAX_CONTINUATIONS; round++) {
    const body = {
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      output_config: { effort },
      messages,
      ...(tools ? { tools } : {}),
    };
    data = await postMessages(apiKey, body, withFallback);
    // The fallback option is a beta; if an account can't use it, carry on
    // without it rather than failing every AI feature.
    if (withFallback && data.error && /fallback/i.test(data.error.message || '')) {
      withFallback = false;
      data = await postMessages(apiKey, body, false);
    }
    if (data.error) throw new Error(data.error.message);

    blocks.push(...(data.content || []));
    if (data.stop_reason !== 'pause_turn') break;
    // Resuming means sending the paused turn back as it was; the API picks
    // up from its trailing tool call.
    messages.push({ role: 'assistant', content: data.content });
  }

  if (data.stop_reason === 'refusal') {
    throw new Error('Claude declined to process this request.');
  }
  if (data.stop_reason === 'max_tokens') {
    throw new Error('The AI reply was cut off before it finished — please try again.');
  }
  if (data.stop_reason === 'pause_turn') {
    throw new Error('The AI took too long reading the source — please try again.');
  }

  // Opus 5.5 returns thinking blocks before its answer, so the answer is
  // found by type, not position.
  const text = blocks.filter(b => b.type === 'text').map(b => b.text).join('');
  return { text, blocks };
}

export async function fetchAISummary(trial, abstract) {
  const prompt = `You are a clinical expert in anaesthesia and critical care. Given the following published clinical trial, provide four things for a practising clinician:

1. FULL SUMMARY: A 5-6 sentence summary covering what was studied, the methodology, key findings, clinical relevance, and any important caveats or limitations.
2. ONE-SENTENCE SUMMARY: A single sentence (max 25 words) capturing the most important clinical takeaway.
3. SUBJECT: 2-4 words describing the subject area (e.g. "Airway management", "Sepsis resuscitation", "Regional anaesthesia", "ICU sedation").
4. TAGS: Choose all appropriate tags from this list, and ONLY this list: ${TAGS.join(', ')}. Return as a JSON array. Do not add or infer any tags outside this list.

Respond in this exact JSON format with no other text:
{
  "fullSummary": "...",
  "oneLineSummary": "...",
  "subject": "...",
  "tags": ["..."]
}

Title: ${trial.title}
Journal: ${trial.journal}
Published: ${trial.pubdate}
Abstract: ${abstract || 'Not available'}`;

  const { text } = await callClaude({ prompt });
  const parsed = parseJsonReply(text || '{}');
  return {
    subject: parsed.subject || '',
    oneLineSummary: parsed.oneLineSummary || '',
    fullSummary: parsed.fullSummary || '',
    tags: Array.isArray(parsed.tags) ? parsed.tags.filter(t => TAGS.includes(t)) : [],
  };
}

// Natural-language search over a user's own saved library. Sends only the
// compact fields (not the full abstract) to keep the prompt a reasonable size
// even for a large library, and asks for relevance rather than exact text
// matches - "difficult airway in obstetrics" should find a paper whose
// summary is about a failed intubation in a pregnant patient even if none of
// those words appear verbatim.
export async function searchLibraryWithAI(queryText, papers) {
  const compact = papers.map(p => ({
    id: p.id,
    title: p.title,
    subject: p.subject || '',
    tags: p.tags || [],
    summary: p.oneLineSummary || (p.abstract || '').slice(0, 220),
  }));

  const prompt = `You are helping a clinician search their own saved library of anaesthesia/critical-care papers using a natural-language question.

Given the question and the JSON list of saved papers below, decide which papers are genuinely relevant to the question - not just loosely related by a shared word. Return their ids, ordered from most to least relevant. If nothing is relevant, return an empty array.

Question: "${queryText}"

Papers (JSON array of {id, title, subject, tags, summary}):
${JSON.stringify(compact)}

Respond in this exact JSON format with no other text:
{
  "matches": [
    { "id": <paper id, exactly as given>, "reason": "one short phrase (max 12 words) explaining why this matches" }
  ]
}`;

  const { text } = await callClaude({ prompt });
  const parsed = parseJsonReply(text || '{}');
  const matches = Array.isArray(parsed.matches) ? parsed.matches : [];

  // A hallucinated or malformed id must not silently corrupt the results list.
  const byId = new Map(papers.map(p => [String(p.id), p]));
  return matches
    .map(m => ({ paper: byId.get(String(m.id)), reason: typeof m.reason === 'string' ? m.reason : '' }))
    .filter(m => !!m.paper);
}

// Why a page couldn't be read, by the web fetch tool's error code.
const FETCH_ERRORS = {
  url_not_allowed: "This site doesn't allow automated reading. Try a PDF version of the article, or another link to it.",
  url_not_accessible: 'The page could not be loaded — it may be paywalled, need a login, or no longer exist.',
  unsupported_content_type: 'That link is not a web page or PDF, so it cannot be read.',
  too_many_requests: 'Too many pages have been read in a short time — please wait a minute and try again.',
  url_too_long: 'That link is too long to read.',
};

function fetchErrorMessage(code) {
  return FETCH_ERRORS[code] || `The page could not be read (${code || 'unknown error'}).`;
}

const normaliseText = text => (text || '').toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ');

// The surname part of a Vancouver-style name ("Lin DM" -> "lin",
// "van der Berg AB" -> "van der berg").
function surnameOf(name) {
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length > 1 && /^[A-Z]{1,4}$/.test(parts[parts.length - 1])) parts.pop();
  return parts.join(' ').toLowerCase();
}

// The instructions shared by every kind of import. `source` says where the
// document is and `noun` how to refer to it ("the fetched page", "the
// attached file").
function importPrompt(source, noun, unreadable) {
  return `You are a clinical expert in anaesthesia and critical care, helping a clinician add a source that is not an indexed journal paper (for example a newsletter article, guideline, report or web page) to their library. It may also be a journal paper they have as a file.

${source}

Rules:
- Base everything ONLY on the text of ${noun}. Do not use prior knowledge about the article, its authors or its publisher.
- If ${unreadable}, reply with {"readable": false, "reason": "..."} and nothing else.
- For each citation detail, copy it from ${noun}. If it is not stated, use an empty string (or an empty array). Never guess or construct a DOI, volume, issue, page range or date.

Return these details:
1. title: the document's title as shown.
2. authors: each author in Vancouver style, surname then initials with no full stops (e.g. "Lin DM"). Leave out degrees and post-nominals.
3. authorsAsWritten: the author line exactly as shown.
4. source: the name of the newsletter, journal, website or organisation it appears in (e.g. "APSF Newsletter").
5. published: the publication date in the form YYYY-MM-DD, YYYY-MM or YYYY, as precise as stated and no more.
6. volume, issue, pages: only if stated.
7. doi: only if a DOI is printed.
8. documentType: exactly one of ${WEB_SOURCE_TYPES.map(t => `"${t}"`).join(', ')}.
9. fullSummary: a 5-6 sentence summary for a practising clinician. Say what kind of piece it is (e.g. opinion piece, narrative review, guideline, report of an original study), then its main arguments, findings or recommendations, the practical implications, and any important caveats. Only mention methods or results if the text describes them; if it is opinion, say so.
10. oneLineSummary: one sentence (max 25 words) with the most important clinical takeaway.
11. subject: 2-4 words describing the subject area (e.g. "Airway management", "Perioperative safety").
12. tags: all appropriate tags from this list, and ONLY this list: ${TAGS.join(', ')}.

Respond in this exact JSON format with no other text:
{
  "readable": true,
  "title": "...",
  "authors": ["..."],
  "authorsAsWritten": "...",
  "source": "...",
  "published": "...",
  "volume": "",
  "issue": "",
  "pages": "",
  "doi": "",
  "documentType": "...",
  "fullSummary": "...",
  "oneLineSummary": "...",
  "subject": "...",
  "tags": ["..."]
}`;
}

// Turns the AI's reply into a draft, checking what can be checked
// mechanically against the source's own text: a DOI that isn't in it is
// removed, and authors or a title that aren't are flagged. `noCheckReason`
// explains why there was no text to check against.
function finaliseImport(text, { pageText, fallbackTitle, noCheckReason, what }) {
  const parsed = parseJsonReply(text || '{}');
  if (parsed.readable === false) {
    throw new Error(`Nothing to import from that ${what}${parsed.reason ? `: ${parsed.reason}` : '.'}`);
  }

  const str = v => (typeof v === 'string' ? v.trim() : '');
  const details = {
    title: str(parsed.title) || str(fallbackTitle),
    authors: Array.isArray(parsed.authors) ? parsed.authors.map(str).filter(Boolean) : [],
    authorsAsWritten: str(parsed.authorsAsWritten),
    source: str(parsed.source),
    published: str(parsed.published),
    volume: str(parsed.volume),
    issue: str(parsed.issue),
    pages: str(parsed.pages),
    doi: str(parsed.doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, ''),
    documentType: WEB_SOURCE_TYPES.includes(parsed.documentType) ? parsed.documentType : 'Web Article',
  };

  const warnings = [];
  const checkText = pageText ? normaliseText(pageText) : null;
  if (checkText) {
    if (details.doi && !checkText.includes(details.doi.toLowerCase())) {
      warnings.push(`The AI suggested a DOI (${details.doi}) that isn't in the ${what}, so it has been removed.`);
      details.doi = '';
    }
    const unmatched = details.authors.filter(a => !checkText.includes(surnameOf(a)));
    if (unmatched.length > 0) {
      warnings.push(`Couldn't find ${unmatched.join(', ')} in the ${what} — check the author list.`);
    }
    if (details.title && !checkText.includes(normaliseText(details.title))) {
      warnings.push(`The title doesn't appear word-for-word in the ${what} — check it.`);
    }
  } else {
    warnings.push(noCheckReason);
  }

  return {
    details,
    summary: {
      subject: str(parsed.subject),
      oneLineSummary: str(parsed.oneLineSummary),
      fullSummary: str(parsed.fullSummary),
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter(t => TAGS.includes(t)) : [],
    },
    warnings,
  };
}

// Reads a web page (or PDF link) with Claude and drafts its citation details
// and summaries, for the user to check before saving.
export async function importWebSource(url) {
  const prompt = importPrompt(
    `Use the web_fetch tool to read this page exactly once: ${url}`,
    'the fetched page',
    'the page cannot be fetched, or it does not contain an article or document (for example a login wall, a search page or a list of links)',
  );

  const { text, blocks } = await callClaude({
    prompt,
    tools: [{ type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 2, max_content_tokens: 60000 }],
  });

  // Only trust a reply that is backed by a page the tool actually fetched,
  // so nothing can be summarised from the model's memory of the article.
  const results = blocks.filter(b => b.type === 'web_fetch_tool_result');
  const fetched = results.map(b => b.content).filter(c => c?.type === 'web_fetch_result');
  if (fetched.length === 0) {
    const error = results.map(b => b.content).find(c => c?.error_code);
    throw new Error(error ? fetchErrorMessage(error.error_code) : 'The page could not be read.');
  }

  const document = fetched[fetched.length - 1].content;
  // A PDF comes back as binary, which can't be cross-checked here.
  return finaliseImport(text, {
    pageText: document?.source?.type === 'text' ? document.source.data : null,
    fallbackTitle: document?.title,
    noCheckReason: "This source was a PDF, so the details couldn't be cross-checked automatically — check them against it.",
    what: 'page',
  });
}

// Reads a file the user picked (see fileSource.js: one PDF, or images of a
// document's pages) and drafts its details and summaries the same way.
export async function importFileSource(file) {
  const blocks = file.parts.map(part =>
    part.type === 'document'
      ? { type: 'document', source: { type: 'base64', media_type: part.mediaType, data: part.base64 } }
      : { type: 'image', source: { type: 'base64', media_type: part.mediaType, data: part.base64 } },
  );
  const described = file.kind === 'pdf'
    ? 'The attached PDF is the document to import.'
    : `The attached ${file.parts.length === 1 ? 'image is a photo or screenshot' : `${file.parts.length} images are photos or screenshots, in order,`} of the document to import.`;
  const prompt = importPrompt(
    described,
    'the attached file',
    'the file cannot be read, or it does not contain an article or document',
  );

  // The file goes before the instructions, which Claude handles best.
  const { text } = await callClaude({ prompt: [...blocks, { type: 'text', text: prompt }] });

  return finaliseImport(text, {
    pageText: file.pageText,
    fallbackTitle: '',
    noCheckReason: file.kind === 'pdf'
      ? "This PDF has no text layer (it looks scanned), so the details couldn't be cross-checked automatically — check them against it."
      : "Details read from images can't be cross-checked automatically — check them against the document.",
    what: file.kind === 'pdf' ? 'PDF' : 'document',
  });
}
