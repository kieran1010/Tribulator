import { TAGS } from './constants';
import { SETTINGS_KEYS, getSetting } from './storage';

const CLAUDE_MODEL = 'claude-sonnet-4-5';

function requireApiKey() {
  const apiKey = getSetting(SETTINGS_KEYS.API_KEY);
  if (!apiKey) throw new Error('No Anthropic API key set in Settings');
  return apiKey;
}

function parseJsonReply(text) {
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

export async function fetchAISummary(trial, abstract) {
  const apiKey = requireApiKey();

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

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const text = data.content?.[0]?.text || '{}';
  const parsed = parseJsonReply(text);
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
  const apiKey = requireApiKey();

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

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const text = data.content?.[0]?.text || '{}';
  const parsed = parseJsonReply(text);
  const matches = Array.isArray(parsed.matches) ? parsed.matches : [];

  // A hallucinated or malformed id must not silently corrupt the results list.
  const byId = new Map(papers.map(p => [String(p.id), p]));
  return matches
    .map(m => ({ paper: byId.get(String(m.id)), reason: typeof m.reason === 'string' ? m.reason : '' }))
    .filter(m => !!m.paper);
}
