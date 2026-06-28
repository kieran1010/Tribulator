import { SETTINGS_KEYS, getSetting } from './storage';

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

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
      model: CLAUDE_MODEL,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const text = data.content?.[0]?.text || '{}';
  return parseJsonReply(text);
}

export async function fetchLatestImpactFactors(journalNames) {
  const apiKey = requireApiKey();

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
      max_tokens: 4096,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `Search the web for the most recent journal impact factors (JIF) for these journals. Return ONLY a JSON array with no other text:\n[{"name": "journal name lowercase", "value": "impact factor as number"}]\n\nJournals:\n${journalNames.join('\n')}`,
      }],
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  const textBlock = data.content?.find(b => b.type === 'text');
  if (!textBlock) throw new Error('No response from Claude');

  const parsed = parseJsonReply(textBlock.text);
  if (!Array.isArray(parsed)) throw new Error('Invalid response format');
  return parsed.map(j => ({ name: j.name, value: String(j.value) }));
}
