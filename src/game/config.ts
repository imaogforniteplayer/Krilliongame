import type { Commonness, RarityTier } from './types';

/**
 * Every competitive rule lives here so it can be tuned (and versioned) in one place.
 * Bump `scoringVersion` / `rarityVersion` whenever a number below changes so that
 * historical results stay explainable.
 */
export const GAME_CONFIG = {
  scoringVersion: 'scoring-v1',
  rarityVersion: 'rarity-v1',

  questionsPerRun: 7,
  secondsPerQuestion: 25,
  /** Extra time the (future) server accepts for network latency before an answer counts as late. */
  timerGraceMs: 1500,
  maxAnswerLength: 80,

  /** Every point is worth this many metres of digging. */
  metresPerPoint: 10,
  pointsByTier: {
    pebble: 10,
    copper: 15,
    quartz: 30,
    obsidian: 60,
    void: 85,
    corebound: 100,
  } satisfies Record<RarityTier, number>,

  rarity: {
    /** Share >= threshold ⇒ that tier. Below the `void` threshold is Corebound. */
    thresholds: { pebble: 0.08, copper: 0.03, quartz: 0.01, obsidian: 0.004, void: 0.0015 },
    /** Curated starting estimate of how many players give an answer, by commonness class. */
    priorShareByCommonness: {
      6: 0.15,
      5: 0.05,
      4: 0.018,
      3: 0.006,
      2: 0.0025,
      1: 0.0007,
    } satisfies Record<Commonness, number>,
    /** Pseudo-submissions of the prior used for smoothing (higher = slower to trust real data). */
    priorStrength: 40,
    /** Real response data is only trusted once a question has this many valid answers. */
    minSampleForObserved: 300,
  },

  fuzzy: {
    /** Keys shorter than this must match exactly. */
    minLengthForTolerance: 5,
    /** Edit distance allowed for keys of length 5–8. */
    toleranceMedium: 1,
    /** Edit distance allowed for keys of length 9+. */
    toleranceLong: 2,
  },
} as const;

export type GameConfig = typeof GAME_CONFIG;
