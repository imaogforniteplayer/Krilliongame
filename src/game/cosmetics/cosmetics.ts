import { pickWeighted, rngFromString } from '../rng';

/**
 * Cosmetics. Everything here changes how the miner LOOKS and nothing else. Nothing in this file is
 * read by scoring, rarity or digging, and nothing can be bought, so there is no competitive
 * advantage to be had from any item. Items unlock by playing.
 */

export type CosmeticSlot = 'helmet' | 'outfit' | 'gloves' | 'backpack' | 'pet' | 'effect' | 'emote';

export const SLOTS: readonly { slot: CosmeticSlot; label: string }[] = [
  { slot: 'helmet', label: 'Helmet' },
  { slot: 'outfit', label: 'Outfit' },
  { slot: 'gloves', label: 'Gloves' },
  { slot: 'backpack', label: 'Backpack' },
  { slot: 'pet', label: 'Pet' },
  { slot: 'effect', label: 'Effect' },
  { slot: 'emote', label: 'Emote' },
];

export type Unlock =
  | { type: 'default' }
  | { type: 'level'; n: number }
  | { type: 'achievement'; id: string }
  | { type: 'streak'; n: number }
  | { type: 'discoveries'; n: number }
  | { type: 'depth'; m: number }
  /** Only obtainable from the daily mystery reward. */
  | { type: 'mystery' };

export interface Cosmetic {
  id: string;
  slot: CosmeticSlot;
  name: string;
  unlock: Unlock;
  /** Main and shaded colour for colour-based slots (helmet, outfit, gloves). */
  colors?: { main: string; dark: string };
}

const D: Unlock = { type: 'default' };
const lvl = (n: number): Unlock => ({ type: 'level', n });
const ach = (id: string): Unlock => ({ type: 'achievement', id });
const streak = (n: number): Unlock => ({ type: 'streak', n });
const disc = (n: number): Unlock => ({ type: 'discoveries', n });
const depth = (m: number): Unlock => ({ type: 'depth', m });
const MYSTERY: Unlock = { type: 'mystery' };

const col = (main: string, dark: string) => ({ main, dark });

export const COSMETICS: readonly Cosmetic[] = [
  { id: 'helmet-gold', slot: 'helmet', name: 'Gold Hard Hat', unlock: D, colors: col('#ffd94a', '#d9951e') },
  { id: 'helmet-red', slot: 'helmet', name: 'Red Hard Hat', unlock: lvl(2), colors: col('#ff5a4a', '#b5302a') },
  { id: 'helmet-cyan', slot: 'helmet', name: 'Frost Hat', unlock: lvl(4), colors: col('#4fd8ff', '#2a8fb5') },
  { id: 'helmet-silver', slot: 'helmet', name: 'Silver Hat', unlock: streak(3), colors: col('#d4dae8', '#8f9ab4') },
  { id: 'helmet-purple', slot: 'helmet', name: 'Prism Hat', unlock: ach('rainbow'), colors: col('#b06bff', '#7640c4') },
  { id: 'helmet-crystal', slot: 'helmet', name: 'Crystal Hat', unlock: ach('depth-2500'), colors: col('#bff3ff', '#6fc7e0') },
  { id: 'helmet-ember', slot: 'helmet', name: 'Ember Hat', unlock: ach('depth-4000'), colors: col('#ff9a3a', '#c24a10') },
  { id: 'helmet-jade', slot: 'helmet', name: 'Jade Hat', unlock: MYSTERY, colors: col('#5ee08a', '#2f9a58') },

  { id: 'outfit-blue', slot: 'outfit', name: 'Classic Blue', unlock: D, colors: col('#3f7be0', '#2a56a8') },
  { id: 'outfit-green', slot: 'outfit', name: 'Moss Green', unlock: lvl(3), colors: col('#46b86a', '#2d8048') },
  { id: 'outfit-orange', slot: 'outfit', name: 'Safety Orange', unlock: disc(8), colors: col('#f0923a', '#b8601a') },
  { id: 'outfit-purple', slot: 'outfit', name: 'Deep Violet', unlock: depth(2000), colors: col('#8a5be0', '#5b38a8') },
  { id: 'outfit-white', slot: 'outfit', name: 'Snow Suit', unlock: streak(7), colors: col('#e8ecf5', '#aab3c8') },
  { id: 'outfit-black', slot: 'outfit', name: 'Void Suit', unlock: ach('corebound-find'), colors: col('#3a3a4a', '#1e1e2a') },
  { id: 'outfit-crimson', slot: 'outfit', name: 'Crimson Coat', unlock: MYSTERY, colors: col('#d84a5a', '#9a2a38') },

  { id: 'gloves-orange', slot: 'gloves', name: 'Work Gloves', unlock: D, colors: col('#e8932c', '#b0651a') },
  { id: 'gloves-grey', slot: 'gloves', name: 'Steel Gloves', unlock: lvl(5), colors: col('#aab3c8', '#6b7490') },
  { id: 'gloves-green', slot: 'gloves', name: 'Moss Gloves', unlock: disc(10), colors: col('#6ad07a', '#3f9a52') },
  { id: 'gloves-gold', slot: 'gloves', name: 'Gold Gloves', unlock: ach('score-500'), colors: col('#ffd94a', '#c9a21a') },
  { id: 'gloves-red', slot: 'gloves', name: 'Ruby Gloves', unlock: MYSTERY, colors: col('#e8503c', '#a82a1a') },

  { id: 'pack-none', slot: 'backpack', name: 'No Backpack', unlock: D },
  { id: 'pack-satchel', slot: 'backpack', name: 'Leather Satchel', unlock: lvl(2) },
  { id: 'pack-tank', slot: 'backpack', name: 'Air Tank', unlock: lvl(6) },
  { id: 'pack-lantern', slot: 'backpack', name: 'Lantern Rig', unlock: disc(15) },
  { id: 'pack-glider', slot: 'backpack', name: 'Glider Pack', unlock: ach('clean-run') },

  { id: 'pet-none', slot: 'pet', name: 'No Pet', unlock: D },
  { id: 'pet-mole', slot: 'pet', name: 'Mole', unlock: lvl(3) },
  { id: 'pet-robot', slot: 'pet', name: 'Mining Robot', unlock: lvl(5) },
  { id: 'pet-dino', slot: 'pet', name: 'Tiny Dinosaur', unlock: disc(12) },
  { id: 'pet-bat', slot: 'pet', name: 'Cave Bat', unlock: depth(3400) },
  { id: 'pet-crystal', slot: 'pet', name: 'Crystal Critter', unlock: depth(1600) },
  { id: 'pet-golem', slot: 'pet', name: 'Rock Golem', unlock: lvl(10) },
  { id: 'pet-glow', slot: 'pet', name: 'Glowworm', unlock: streak(14) },

  { id: 'fx-none', slot: 'effect', name: 'No Effect', unlock: D },
  { id: 'fx-sparkle', slot: 'effect', name: 'Sparkle Trail', unlock: lvl(8) },
  { id: 'fx-frost', slot: 'effect', name: 'Frost Trail', unlock: depth(2700) },
  { id: 'fx-embers', slot: 'effect', name: 'Ember Trail', unlock: depth(3400) },
  { id: 'fx-stars', slot: 'effect', name: 'Star Trail', unlock: ach('corebound-find') },

  { id: 'emote-cheer', slot: 'emote', name: 'Cheer', unlock: D },
  { id: 'emote-point', slot: 'emote', name: 'Point Up', unlock: lvl(3) },
  { id: 'emote-gasp', slot: 'emote', name: 'Gasp', unlock: lvl(6) },
];

/** Renderer mood used when the miner celebrates at the end of a run. */
export const EMOTE_MOOD: Record<string, 'victory' | 'discover' | 'surprise'> = {
  'emote-cheer': 'victory',
  'emote-point': 'discover',
  'emote-gasp': 'surprise',
};

export type Look = Record<CosmeticSlot, string>;

export function defaultLook(): Look {
  return {
    helmet: 'helmet-gold',
    outfit: 'outfit-blue',
    gloves: 'gloves-orange',
    backpack: 'pack-none',
    pet: 'pet-none',
    effect: 'fx-none',
    emote: 'emote-cheer',
  };
}

const BY_ID = new Map(COSMETICS.map((c) => [c.id, c] as const));

export function getCosmetic(id: string): Cosmetic | undefined {
  return BY_ID.get(id);
}

export function itemsInSlot(slot: CosmeticSlot): Cosmetic[] {
  return COSMETICS.filter((c) => c.slot === slot);
}

/** Everything the unlock rules can look at. Built from the save by `progression/context.ts`. */
export interface UnlockContext {
  level: number;
  bestStreak: number;
  discoveries: number;
  /** Deepest single run, in metres. */
  deepest: number;
  achievements: ReadonlySet<string>;
  /** Items granted by mystery rewards. */
  granted: ReadonlySet<string>;
}

export function isUnlocked(item: Cosmetic, ctx: UnlockContext): boolean {
  if (ctx.granted.has(item.id)) return true;
  const u = item.unlock;
  switch (u.type) {
    case 'default':
      return true;
    case 'level':
      return ctx.level >= u.n;
    case 'achievement':
      return ctx.achievements.has(u.id);
    case 'streak':
      return ctx.bestStreak >= u.n;
    case 'discoveries':
      return ctx.discoveries >= u.n;
    case 'depth':
      return ctx.deepest >= u.m;
    case 'mystery':
      return false;
  }
}

export function unlockText(item: Cosmetic): string {
  const u = item.unlock;
  switch (u.type) {
    case 'default':
      return 'Starter item';
    case 'level':
      return `Reach level ${u.n}`;
    case 'achievement':
      return 'Earn an achievement';
    case 'streak':
      return `Reach a ${u.n}-day streak`;
    case 'discoveries':
      return `Discover ${u.n} different items`;
    case 'depth':
      return `Reach ${u.m.toLocaleString('en-US')} m in one dig`;
    case 'mystery':
      return 'Found in daily mystery rewards';
  }
}

/** Replaces anything missing, unknown or still locked with the default for that slot. */
export function resolveLook(look: Partial<Look> | undefined, ctx: UnlockContext): Look {
  const base = defaultLook();
  const out = { ...base };
  for (const { slot } of SLOTS) {
    const id = look?.[slot];
    const item = id ? getCosmetic(id) : undefined;
    if (item && item.slot === slot && isUnlocked(item, ctx)) out[slot] = item.id;
  }
  return out;
}

export function lockedItems(ctx: UnlockContext): Cosmetic[] {
  return COSMETICS.filter((c) => !isUnlocked(c, ctx));
}

/** Daily mystery reward: a random item the player does not own yet, or null once they own everything. */
export function pickMysteryReward(ctx: UnlockContext, seed: string): Cosmetic | null {
  const pool = lockedItems(ctx);
  if (pool.length === 0) return null;
  // Mystery-only items are a little more likely, since nothing else can unlock them.
  const weights = pool.map((c) => (c.unlock.type === 'mystery' ? 3 : 1));
  return pickWeighted(pool, weights, rngFromString(`mystery|${seed}`));
}
