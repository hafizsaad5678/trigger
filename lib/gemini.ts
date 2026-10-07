export class GeminiError extends Error {
  code: string;
  status?: number;

  constructor(message: string, code: string = 'error', status?: number) {
    super(message);
    this.name = 'GeminiError';
    this.code = code;
    this.status = status;
  }
}

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

export const GEMINI_MODELS = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', badge: 'FAST & FREE', recommended: true },
];

function extractText(json: any): string {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((p: any) => typeof p?.text === 'string' && !p?.thought)
    .map((p: any) => p.text)
    .join('')
    .trim();
}

export async function testGeminiKey(apiKey: string, model = DEFAULT_GEMINI_MODEL): Promise<void> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Reply with the single word: ok' }] }],
      generationConfig: { maxOutputTokens: 512 },
    }),
  });

  if (!res.ok) {
    let errorMsg = 'Gemini API key verification failed.';
    try {
      const errJson = await res.json();
      if (errJson?.error?.message) {
        errorMsg = errJson.error.message;
      }
    } catch {}
    throw new GeminiError(errorMsg, 'invalid_key', res.status);
  }

  const json = await res.json();
  // Thinking models can spend the token budget before emitting text; a 200 with a
  // candidate (even without text) still proves the key is valid.
  if (!extractText(json) && !json?.candidates?.length) {
    const reason = json?.promptFeedback?.blockReason || 'no candidates returned';
    throw new GeminiError(`Received empty response from Gemini (${reason}).`, 'bad_response');
  }
}

export interface GeminiWordRequest {
  category: string;
  difficulty: string;
  count?: number;
  exclude?: string[];
  model?: string;
}

export interface GeminiWordResponse {
  words: string[];
  error?: string;
}

const WORD_REGEX = /^[a-z][a-z' -]{1,29}$/i;

export async function generateWordsGemini(
  apiKey: string,
  request: GeminiWordRequest
): Promise<GeminiWordResponse> {
  const { category, difficulty, count = 20, exclude = [], model = DEFAULT_GEMINI_MODEL } = request;
  const excludeLine =
    exclude.length > 0
      ? `Do not use any of these words: ${exclude.slice(0, 80).join(', ')}.`
      : '';

  const prompt = [
    `You create word lists for IELTS Listening spelling practice.`,
    `Give exactly ${count} different English words or short terms for the category "${category}".`,
    `Difficulty: ${difficulty}.`,
    `Each item must be a single word (letters, apostrophe or hyphen only, 2-30 characters) that an IELTS candidate could hear and write down.`,
    excludeLine,
    `Respond in valid JSON format: {"words": ["word1", "word2"]}`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.8,
          maxOutputTokens: 4000,
        },
      }),
    });

    if (!res.ok) {
      let msg = `Gemini API returned status ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson?.error?.message) msg = errJson.error.message;
      } catch {}
      return { words: [], error: msg };
    }

    const data = await res.json();
    const rawText = extractText(data);
    if (!rawText) {
      return { words: [], error: 'Empty response from Gemini' };
    }

    const parsed = JSON.parse(rawText);
    const list = Array.isArray(parsed) ? parsed : parsed?.words;
    if (!Array.isArray(list)) {
      return { words: [], error: 'Invalid JSON shape returned' };
    }

    const excluded = new Set(exclude.map((w) => w.toLowerCase()));
    const seen = new Set<string>();
    const words: string[] = [];

    for (const raw of list) {
      if (typeof raw !== 'string') continue;
      const word = raw.trim().toLowerCase();
      if (!WORD_REGEX.test(word) || excluded.has(word) || seen.has(word)) continue;
      seen.add(word);
      words.push(word);
    }

    return { words: words.slice(0, count) };
  } catch (e: any) {
    console.warn('Gemini word generation error:', e);
    return { words: [], error: e?.message || 'Failed to generate words from Gemini' };
  }
}
