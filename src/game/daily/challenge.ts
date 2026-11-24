import { GAME_CONFIG } from '../config';
import { rngFromString, seededShuffle } from '../rng';
import type { Difficulty, Question } from '../types';

const DIFFICULTY_RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

/**
 * The Daily Dig rolls over at 00:00 UTC for everyone, so all players share the same seven
 * questions regardless of timezone (that is 11:00 in Sydney during daylight saving time).
 */
export function dailyKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function previousDailyKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return dailyKey(prev);
}

export function msUntilNextDaily(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return next - now.getTime();
}

/**
 * Picks the day's questions deterministically from the date, preferring one question per
 * category, and orders them easy → hard so the run builds. An admin schedule can pin a day
 * to specific question ids via `overrides`.
 */
export function selectDailyQuestions(
  key: string,
  pool: readonly Question[],
  opts: { count?: number; overrides?: Record<string, string[]> } = {},
): Question[] {
  const count = opts.count ?? GAME_CONFIG.questionsPerRun;
  const eligible = pool.filter((q) => q.status === 'active');

  const pinned = opts.overrides?.[key];
  if (pinned && pinned.length > 0) {
    const byId = new Map(eligible.map((q) => [q.id, q] as const));
    const picked = pinned.map((id) => byId.get(id)).filter((q): q is Question => !!q);
    if (picked.length >= count) return picked.slice(0, count);
  }

  return pickDiverse(eligible, count, rngFromString(`deeper-daily|${GAME_CONFIG.scoringVersion}|${key}`));
}

/** Random run for Endless Dig / practice. */
export function selectRandomQuestions(pool: readonly Question[], rng: () => number = Math.random, count: number = GAME_CONFIG.questionsPerRun): Question[] {
  return pickDiverse(pool.filter((q) => q.status === 'active'), count, rng);
}

function pickDiverse(pool: readonly Question[], count: number, rng: () => number): Question[] {
  if (pool.length < count) throw new Error(`Need at least ${count} active questions, have ${pool.length}`);
  const shuffled = seededShuffle(pool, rng);
  const picked: Question[] = [];
  const usedCategories = new Set<string>();

  for (const q of shuffled) {
    if (picked.length === count) break;
    if (!usedCategories.has(q.category)) {
      picked.push(q);
      usedCategories.add(q.category);
    }
  }
  for (const q of shuffled) {
    if (picked.length === count) break;
    if (!picked.includes(q)) picked.push(q);
  }

  // Stable sort: easy → hard, keeping the shuffled order within a difficulty.
  return picked
    .map((q, i) => ({ q, i }))
    .sort((a, b) => DIFFICULTY_RANK[a.q.difficulty] - DIFFICULTY_RANK[b.q.difficulty] || a.i - b.i)
    .map((x) => x.q);
}
