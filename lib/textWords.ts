const WORD_REGEX = /^[a-z][a-z'-]{1,29}$/i;

/** Splits free text into unique, speakable words (letters, apostrophe, hyphen), in order of appearance. */
export function extractWordsFromText(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[^A-Za-z'’-]+/)) {
    const word = raw.replace(/’/g, "'").replace(/^[-']+|[-']+$/g, '');
    const key = word.toLowerCase();
    if (!WORD_REGEX.test(word) || seen.has(key)) continue;
    seen.add(key);
    out.push(word);
  }
  return out;
}
