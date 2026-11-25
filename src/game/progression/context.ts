import type { UnlockContext } from '../cosmetics/cosmetics';
import { levelFromXp, xpOf } from '../storage';
import type { SaveData } from '../storage';

/** Everything the cosmetic unlock rules need, taken from the save. */
export function unlockContext(save: SaveData): UnlockContext {
  return {
    level: levelFromXp(xpOf(save)).level,
    bestStreak: save.streak.best,
    discoveries: Object.keys(save.collection).length,
    deepest: Math.max(save.deepestEver, 0),
    achievements: new Set(Object.keys(save.achievements)),
    granted: new Set(save.unlockedCosmetics),
  };
}
