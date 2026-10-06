import { getDb } from '../client';
import { sessions, sessionWords } from '../schema';
import { and, count, desc, eq, gte, isNull, or, sql } from 'drizzle-orm';

export interface SessionListItem {
  id: number;
  startedAt: number;
  endedAt: number | null;
  durationPlannedSec: number;
  durationActualSec: number | null;
  intervalSec: number;
  category: string;
  difficulty: string;
  wordCount: number;
  unmarkedCount: number;
  correctCount: number;
  retestCount: number;
}

export interface SpokenWordItem {
  id: number;
  sessionId: number;
  position: number;
  word: string;
  spokenAt: number;
  mark: 'correct' | 'retest' | null;
}

export async function createSession(
  durationPlannedSec: number,
  intervalSec: number,
  category: string,
  difficulty: string
): Promise<number> {
  const db = getDb();
  const res = await db.insert(sessions).values({
    startedAt: Date.now(),
    durationPlannedSec,
    intervalSec,
    category,
    difficulty,
  });
  return res.lastInsertRowId as number;
}

export async function finalizeSession(
  sessionId: number,
  durationActualSec: number
): Promise<void> {
  const db = getDb();
  await db
    .update(sessions)
    .set({
      endedAt: Date.now(),
      durationActualSec,
    })
    .where(eq(sessions.id, sessionId));
}

export async function recordSpokenWord(
  sessionId: number,
  position: number,
  word: string
): Promise<void> {
  const db = getDb();
  // Mark prior 'retest' flags as 'retried' so this word isn't duplicated in future queues
  await db
    .update(sessionWords)
    .set({ mark: 'retried' })
    .where(and(eq(sessionWords.word, word), eq(sessionWords.mark, 'retest')));

  await db.insert(sessionWords).values({
    sessionId,
    position,
    word,
    spokenAt: Date.now(),
    mark: null,
  });
}

export async function listSessions(): Promise<SessionListItem[]> {
  const db = getDb();
  const [allSessions, counts] = await Promise.all([
    db.select().from(sessions).orderBy(desc(sessions.startedAt)),
    db
      .select({
        sessionId: sessionWords.sessionId,
        total: count(),
        correct: sql<number>`coalesce(sum(case when ${sessionWords.mark} = 'correct' then 1 else 0 end), 0)`,
        retest: sql<number>`coalesce(sum(case when ${sessionWords.mark} = 'retest' then 1 else 0 end), 0)`,
      })
      .from(sessionWords)
      .groupBy(sessionWords.sessionId),
  ]);
  const bySession = new Map(counts.map((c) => [c.sessionId, c]));

  return allSessions.map((s) => {
    const c = bySession.get(s.id);
    const wordCount = c?.total ?? 0;
    const correctCount = Number(c?.correct ?? 0);
    const retestCount = Number(c?.retest ?? 0);
    return {
      id: s.id,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      durationPlannedSec: s.durationPlannedSec,
      durationActualSec: s.durationActualSec,
      intervalSec: s.intervalSec,
      category: s.category,
      difficulty: s.difficulty,
      wordCount,
      unmarkedCount: wordCount - correctCount - retestCount,
      correctCount,
      retestCount,
    };
  });
}

export async function getSession(sessionId: number) {
  const db = getDb();
  const res = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
  return res[0] || null;
}

export async function getSessionWords(sessionId: number): Promise<SpokenWordItem[]> {
  const db = getDb();
  const res = await db
    .select()
    .from(sessionWords)
    .where(eq(sessionWords.sessionId, sessionId))
    .orderBy(sessionWords.position);

  return res.map((r) => ({
    id: r.id,
    sessionId: r.sessionId,
    position: r.position,
    word: r.word,
    spokenAt: r.spokenAt,
    mark: (r.mark as 'correct' | 'retest' | null) || null,
  }));
}

export async function setWordMark(
  sessionId: number,
  position: number,
  mark: 'correct' | 'retest' | null
): Promise<void> {
  const db = getDb();
  await db
    .update(sessionWords)
    .set({ mark })
    .where(and(eq(sessionWords.sessionId, sessionId), eq(sessionWords.position, position)));
}

export async function deleteSession(sessionId: number): Promise<void> {
  const db = getDb();
  await db.delete(sessionWords).where(eq(sessionWords.sessionId, sessionId));
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function updateSessionLabel(
  sessionId: number,
  category: string,
  difficulty: string
): Promise<void> {
  const db = getDb();
  await db.update(sessions).set({ category, difficulty }).where(eq(sessions.id, sessionId));
}

export interface PracticedWord {
  word: string;
  /** Category label of the session the word was last spoken in. */
  category: string;
  lastSpokenAt: number;
}

/** Distinct previously spoken words, most recently spoken first. */
export async function getPracticedWords(limit: number = 500): Promise<PracticedWord[]> {
  const db = getDb();
  const rows = await db
    .select({
      word: sessionWords.word,
      spokenAt: sessionWords.spokenAt,
      category: sessions.category,
    })
    .from(sessionWords)
    .innerJoin(sessions, eq(sessionWords.sessionId, sessions.id))
    .orderBy(desc(sessionWords.spokenAt))
    .limit(limit * 3);

  const seen = new Map<string, PracticedWord>();
  for (const r of rows) {
    const key = r.word.toLowerCase();
    if (!seen.has(key)) seen.set(key, { word: r.word, category: r.category, lastSpokenAt: r.spokenAt });
    if (seen.size >= limit) break;
  }
  return Array.from(seen.values());
}

/** Sessions per category since `sinceMs`; adaptive labels ("Adaptive → Transport") count towards the resolved category. */
export async function getCategoryUsage(sinceMs: number): Promise<Record<string, number>> {
  const db = getDb();
  const rows = await db
    .select({ category: sessions.category })
    .from(sessions)
    .where(gte(sessions.startedAt, sinceMs));
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const resolved = r.category.split('→').pop()!.trim();
    counts[resolved] = (counts[resolved] || 0) + 1;
  }
  return counts;
}

export async function getRetestWords(sessionId: number): Promise<string[]> {
  const db = getDb();
  const words = await db
    .select({ word: sessionWords.word })
    .from(sessionWords)
    .where(and(eq(sessionWords.sessionId, sessionId), eq(sessionWords.mark, 'retest')))
    .orderBy(sessionWords.position);

  return words.map((w) => w.word);
}

export interface AllSpokenWordItem {
  id: number;
  sessionId: number;
  position: number;
  word: string;
  spokenAt: number;
  mark: 'correct' | 'retest' | null;
  category: string;
  difficulty: string;
}

export async function getAllSpokenWords(): Promise<AllSpokenWordItem[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: sessionWords.id,
      sessionId: sessionWords.sessionId,
      position: sessionWords.position,
      word: sessionWords.word,
      spokenAt: sessionWords.spokenAt,
      mark: sessionWords.mark,
      category: sessions.category,
      difficulty: sessions.difficulty,
    })
    .from(sessionWords)
    .innerJoin(sessions, eq(sessionWords.sessionId, sessions.id))
    .where(or(isNull(sessionWords.mark), eq(sessionWords.mark, 'correct')))
    .orderBy(desc(sessionWords.spokenAt));

  return rows.map((r) => ({
    id: r.id,
    sessionId: r.sessionId,
    position: r.position,
    word: r.word,
    spokenAt: r.spokenAt,
    mark: (r.mark as 'correct' | 'retest' | null) || null,
    category: r.category,
    difficulty: r.difficulty,
  }));
}

export async function updateWordMarkById(
  wordId: number,
  mark: 'correct' | 'retest' | null
): Promise<void> {
  const db = getDb();
  await db.update(sessionWords).set({ mark }).where(eq(sessionWords.id, wordId));
}

export async function deleteWordById(wordId: number): Promise<void> {
  const db = getDb();
  await db.delete(sessionWords).where(eq(sessionWords.id, wordId));
}

export async function getWordsMarkedAsAgain(category?: string, strict = false): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ word: sessionWords.word, category: sessions.category })
    .from(sessionWords)
    .innerJoin(sessions, eq(sessionWords.sessionId, sessions.id))
    .where(eq(sessionWords.mark, 'retest'))
    .orderBy(desc(sessionWords.spokenAt));

  const seen = new Set<string>();
  const out: string[] = [];

  // Prioritize words belonging to the matching category
  const matching = category
    ? rows.filter((r) => r.category.toLowerCase().includes(category.toLowerCase()))
    : [];
  const others = category
    ? rows.filter((r) => !r.category.toLowerCase().includes(category.toLowerCase()))
    : rows;

  for (const r of strict ? matching : [...matching, ...others]) {
    const key = r.word.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(r.word);
    }
  }
  return out;
}

export interface AgainWordItem {
  id: number;
  sessionId: number;
  word: string;
  spokenAt: number;
  category: string;
  difficulty: string;
}

export async function getAgainWordsList(): Promise<AgainWordItem[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: sessionWords.id,
      sessionId: sessionWords.sessionId,
      word: sessionWords.word,
      spokenAt: sessionWords.spokenAt,
      category: sessions.category,
      difficulty: sessions.difficulty,
    })
    .from(sessionWords)
    .innerJoin(sessions, eq(sessionWords.sessionId, sessions.id))
    .where(eq(sessionWords.mark, 'retest'))
    .orderBy(desc(sessionWords.spokenAt));

  return rows;
}

export async function removeAgainWord(wordId: number): Promise<void> {
  const db = getDb();
  await db.update(sessionWords).set({ mark: null }).where(eq(sessionWords.id, wordId));
}

export async function clearAllAgainWords(): Promise<void> {
  const db = getDb();
  await db.update(sessionWords).set({ mark: null }).where(eq(sessionWords.mark, 'retest'));
}

export async function getMasteredOrCompletedWords(): Promise<Set<string>> {
  const db = getDb();
  const rows = await db
    .select({ word: sessionWords.word, mark: sessionWords.mark })
    .from(sessionWords);

  const completed = new Set<string>();
  for (const r of rows) {
    const key = r.word.toLowerCase();
    if (r.mark === 'correct') {
      completed.add(key);
    }
  }
  return completed;
}

