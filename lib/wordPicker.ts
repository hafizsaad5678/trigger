import { CONCRETE_CATEGORIES } from './constants';
import { generateWordsGemini } from './gemini';
import { SEED_WORDS } from './seedWords';
import { extractWordsFromText } from './textWords';
import { getSetting } from '../db/queries/settings';
import {
  getCategoryUsage,
  getMasteredOrCompletedWords,
  getPracticedWords,
  getWordsMarkedAsAgain,
} from '../db/queries/sessions';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Look-back window for "least practised category". */
const USAGE_WINDOW_MS = 30 * DAY_MS;

const MIXED_DIFFICULTY = 'a mix of Easy (about 30%), Medium (about 40%) and Hard (about 30%) words';

export interface SessionTargets {
  /** Category name used for the AI prompt and the built-in bank. */
  category: string;
  /** Label stored on the session, e.g. "Adaptive → Transport". */
  label: string;
  /** Difficulty wording for the AI prompt. */
  difficultyPrompt: string;
  /** Difficulty used to filter the built-in bank; null = any. */
  seedDifficulty: string | null;
  /** Category or difficulty is Adaptive: mix in older practised words. */
  adaptive: boolean;
  /** Words taken from the user's own pasted/uploaded text ("My Text"); no AI or built-in bank. */
  sourceWords?: string[];
}

/**
 * Resolves the user's choices into concrete targets.
 * Adaptive category = the category practised least in the last 30 days.
 * Adaptive difficulty = a mix of all levels.
 */
export async function resolveTargets(
  category: string,
  difficulty: string,
  customCategoryText?: string
): Promise<SessionTargets> {
  let target = category;
  let label = category;

  let sourceWords: string[] | undefined;

  if (category === 'My Text') {
    sourceWords = extractWordsFromText((await getSetting('customText')) ?? '');
    target = 'My Text';
    label = 'My Text';
  } else if (category === 'Custom') {
    target = customCategoryText?.trim() || 'General English';
    label = target;
  } else if (category === 'Adaptive') {
    const usage = await getCategoryUsage(Date.now() - USAGE_WINDOW_MS);
    const least = [...CONCRETE_CATEGORIES].sort((a, b) => (usage[a] ?? 0) - (usage[b] ?? 0))[0];
    target = least;
    label = `Adaptive → ${least}`;
  }

  const adaptiveDifficulty = difficulty === 'Adaptive';
  return {
    category: target,
    label,
    difficultyPrompt: adaptiveDifficulty ? MIXED_DIFFICULTY : difficulty,
    seedDifficulty: adaptiveDifficulty ? null : difficulty,
    adaptive: category === 'Adaptive' || adaptiveDifficulty,
    sourceWords,
  };
}

export interface BatchRequest {
  targets: SessionTargets;
  apiKey?: string;
  model?: string;
  /** Every word already spoken or queued in this session (any case). */
  usedWords: string[];
  count: number;
}

export interface BatchResult {
  words: string[];
  /** Something the user should know (AI failed, bank too small, repeats used). */
  notice?: string;
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function tidy(word: string, category: string): string {
  const w = word.trim();
  return category === 'Names' ? w.charAt(0).toUpperCase() + w.slice(1) : w;
}

/**
 * Returns up to `count` words, prioritizing words marked as 'again' (retest)
 * and strictly excluding words that were already marked 'correct' or completed.
 */
export async function fetchWordBatch(req: BatchRequest): Promise<BatchResult> {
  const { targets, apiKey, model, usedWords, count } = req;
  const used = new Set(usedWords.map((w) => w.toLowerCase()));

  // 1. Fetch words marked as 'again' (retest) and mastered/correct words
  const [againWords, masteredWords, practiced] = await Promise.all([
    // For "My Text" only retest words from earlier My Text sessions belong here.
    getWordsMarkedAsAgain(targets.sourceWords ? targets.category : undefined, Boolean(targets.sourceWords)),
    getMasteredOrCompletedWords(),
    getPracticedWords(1000),
  ]);

  const allPracticedSet = new Set(practiced.map((p) => p.word.toLowerCase()));
  const againSet = new Set(againWords.map((w) => w.toLowerCase()));

  // Words that should NOT repeat: mastered (correct) or practiced (unless marked again)
  const excludeFromNew = new Set<string>([
    ...Array.from(masteredWords),
    ...Array.from(allPracticedSet).filter((w) => !againSet.has(w)),
  ]);

  const result: string[] = [];
  const taken = new Set<string>();
  const push = (w: string): boolean => {
    const key = w.toLowerCase();
    if (used.has(key) || taken.has(key)) return false;
    taken.add(key);
    result.push(tidy(w, targets.category));
    return true;
  };

  let notice: string | undefined;

  // PRIORITY 1: Words marked as 'Again' (retest)
  if (againWords.length > 0) {
    for (const w of shuffle(againWords)) {
      if (result.length >= count) break;
      push(w);
    }
  }

  // PRIORITY 2 (My Text): fresh words from the user's own text, then stop (no AI / built-in bank)
  if (targets.sourceWords) {
    for (const w of shuffle(targets.sourceWords)) {
      if (result.length >= count) break;
      if (excludeFromNew.has(w.toLowerCase())) continue;
      push(w);
    }
    if (targets.sourceWords.length === 0) {
      notice = 'No words found in your text. Add text under Practice → Writing Practice → My Text.';
    } else if (result.length === 0) {
      notice = 'You have already practiced every word in your text. Add more text for new words.';
    }
    return { words: shuffle(result).slice(0, count), notice };
  }

  // PRIORITY 2: New words generated by AI (excluding mastered & already practiced words)
  if (result.length < count && apiKey && apiKey.trim()) {
    const exclude = [
      ...usedWords.slice(-60),
      ...Array.from(excludeFromNew).slice(-100),
    ];
    let aiWords: string[] = [];
    let aiError: string | undefined;

    const geminiRes = await generateWordsGemini(apiKey, {
      category: targets.category,
      difficulty: targets.difficultyPrompt,
      count: count - result.length + 10,
      exclude,
      // Only use a stored model if it is a Gemini one (older installs may hold an OpenRouter id).
      model: model?.startsWith('gemini') ? model : undefined,
    });
    aiWords = geminiRes.words;
    aiError = geminiRes.error;

    if (aiError) notice = `${aiError} Using the built-in word bank instead.`;

    const fresh = aiWords.filter((w) => !excludeFromNew.has(w.toLowerCase()));
    for (const w of fresh) {
      if (result.length >= count) break;
      push(w);
    }
  }

  // PRIORITY 3: Built-in seed words from category that haven't been completed
  if (result.length < count) {
    const inCategory = SEED_WORDS.filter((s) => s.category === targets.category);
    const levelMatch = (s: (typeof SEED_WORDS)[number]) =>
      !targets.seedDifficulty || s.difficulty === targets.seedDifficulty;
    const candidates = inCategory.filter(levelMatch).length > 0 ? inCategory.filter(levelMatch) : inCategory;

    const unpracticedSeed = shuffle(candidates.map((s) => s.word)).filter(
      (w) => !excludeFromNew.has(w.toLowerCase())
    );

    for (const w of unpracticedSeed) {
      if (result.length >= count) break;
      push(w);
    }
  }

  // PRIORITY 4: Other built-in seed categories
  if (result.length < count) {
    const otherSeed = shuffle(SEED_WORDS.map((s) => s.word)).filter(
      (w) => !excludeFromNew.has(w.toLowerCase())
    );
    for (const w of otherSeed) {
      if (result.length >= count) break;
      push(w);
    }
  }

  return { words: shuffle(result).slice(0, count), notice };
}

