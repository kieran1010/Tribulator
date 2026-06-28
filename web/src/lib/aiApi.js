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
