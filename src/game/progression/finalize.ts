import { COSMETICS, isUnlocked, pickMysteryReward } from '../cosmetics/cosmetics';
import type { RunState } from '../session';
import { applyFinishedRun } from '../storage';
import type { SaveData } from '../storage';
import { unlockContext } from './context';

export interface Finalized {
  save: SaveData;
  /** Achievement ids earned by this run. */
  newAchievements: string[];
  /** Cosmetic ids that became available (level-ups, achievements, mystery reward). */
  newCosmetics: string[];
  /** The daily mystery reward, if this run earned one. */
  reward: string | null;
}

/**
 * Applies a finished run and everything that follows from it. Idempotent per run id: finalising the
 * same run twice changes nothing the second time.
 */
export function finalizeRun(before: SaveData, run: RunState, now: number): Finalized {
  if (!run.finishedAt || before.appliedRunIds.includes(run.id)) {
    return { save: before, newAchievements: [], newCosmetics: [], reward: null };
  }
  const ctxBefore = unlockContext(before);
  let next = applyFinishedRun(before, run, now);

  let reward: string | null = null;
  // One mystery reward per ranked Daily Dig.
  if (run.mode === 'daily') {
    const item = pickMysteryReward(unlockContext(next), run.id);
    if (item) {
      reward = item.id;
      next = { ...next, unlockedCosmetics: [...next.unlockedCosmetics, item.id] };
    }
  }

  const ctxAfter = unlockContext(next);
  const newCosmetics = COSMETICS.filter((c) => !isUnlocked(c, ctxBefore) && isUnlocked(c, ctxAfter)).map((c) => c.id);
  const newAchievements = Object.keys(next.achievements).filter((id) => before.achievements[id] === undefined);
  return { save: next, newAchievements, newCosmetics, reward };
}
