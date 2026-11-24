import type { QuestionStats } from '../types';

export interface StatsStore {
  byQuestion: Record<string, QuestionStats>;
  /** `${attemptKey}|${questionId}` of observations already counted (most recent last, capped). */
  seen: string[];
}

export const MAX_SEEN = 400;

export function emptyStatsStore(): StatsStore {
  return { byQuestion: {}, seen: [] };
}

/**
 * Records that an attempt gave an accepted answer. Each attempt can count at most once per
 * question, so refreshing, resubmitting or replaying cannot inflate how common an answer looks.
 * Returns a new store; if the observation was a duplicate the same store is returned.
 */
export function recordObservation(
  store: StatsStore,
  obs: { attemptKey: string; questionId: string; entryId: string },
): StatsStore {
  const seenKey = `${obs.attemptKey}|${obs.questionId}`;
  if (store.seen.includes(seenKey)) return store;

  const prev = store.byQuestion[obs.questionId] ?? { total: 0, counts: {} };
  const next: QuestionStats = {
    total: prev.total + 1,
    counts: { ...prev.counts, [obs.entryId]: (prev.counts[obs.entryId] ?? 0) + 1 },
  };
  const seen = [...store.seen, seenKey];
  while (seen.length > MAX_SEEN) seen.shift();
  return { byQuestion: { ...store.byQuestion, [obs.questionId]: next }, seen };
}
