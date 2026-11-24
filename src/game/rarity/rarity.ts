import { GAME_CONFIG } from '../config';
import type { AnswerEntry, QuestionStats, RarityResult, RarityTier } from '../types';

export function priorShare(entry: Pick<AnswerEntry, 'commonness'>): number {
  return GAME_CONFIG.rarity.priorShareByCommonness[entry.commonness];
}

export function tierForShare(share: number): RarityTier {
  const t = GAME_CONFIG.rarity.thresholds;
  if (share >= t.pebble) return 'pebble';
  if (share >= t.copper) return 'copper';
  if (share >= t.quartz) return 'quartz';
  if (share >= t.obsidian) return 'obsidian';
  if (share >= t.void) return 'void';
  return 'corebound';
}

/**
 * Bayesian-style smoothing: the curated prior counts as `priorStrength` pretend submissions,
 * so a single odd submission cannot turn an answer "extremely rare" (or common) overnight.
 */
export function smoothedShare(prior: number, count: number, total: number, strength = GAME_CONFIG.rarity.priorStrength): number {
  if (total < 0 || count < 0) throw new RangeError('counts must be non-negative');
  return (count + strength * prior) / (total + strength);
}

/**
 * Rarity of an accepted answer.
 *  - With no (or too little) real player data → the curated estimate, labelled "estimated".
 *  - With enough real data → smoothed real share, labelled "observed".
 * Never invents statistics: `source` always says which one you are looking at.
 */
export function computeRarity(entry: AnswerEntry, stats?: QuestionStats): RarityResult {
  const prior = priorShare(entry);
  const enough = !!stats && stats.total >= GAME_CONFIG.rarity.minSampleForObserved;
  if (!stats || !enough) {
    return { tier: tierForShare(prior), share: prior, source: 'estimated', sampleSize: stats?.total ?? 0 };
  }
  const share = smoothedShare(prior, stats.counts[entry.id] ?? 0, stats.total);
  return { tier: tierForShare(share), share, source: 'observed', sampleSize: stats.total };
}
