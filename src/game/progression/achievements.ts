import { DISCOVERIES } from '../discoveries/discoveries';
import { summarizeRun } from '../session';
import type { RunState } from '../session';
import type { SaveData } from '../storage';
import { GAME_CONFIG } from '../config';
import { TIER_ORDER } from '../types';

/**
 * Achievement badges and player titles. Each achievement unlocks a title the player can wear.
 * `check` is evaluated against the save AFTER a finished run has been applied, plus that run for
 * achievements about a single run.
 */
export interface Achievement {
  id: string;
  name: string;
  description: string;
  /** Title unlocked by earning this badge. */
  title: string;
  check: (save: SaveData, run?: RunState) => boolean;
  /** For count-based badges: [current, target], used for "progress towards next achievement". */
  progress?: (save: SaveData) => [number, number];
}

const counter = (
  id: string,
  name: string,
  description: string,
  title: string,
  value: (s: SaveData) => number,
  target: number,
): Achievement => ({
  id,
  name,
  description,
  title,
  check: (s) => value(s) >= target,
  progress: (s) => [Math.min(value(s), target), target],
});

const rareCount = (s: SaveData) => s.tierTotals.quartz + s.tierTotals.obsidian + s.tierTotals.void + s.tierTotals.corebound;
const found = (s: SaveData) => Object.keys(s.collection).length;

export const ACHIEVEMENTS: readonly Achievement[] = [
  counter('first-dig', 'First Descent', 'Finish your first dig.', 'Rookie Miner', (s) => s.lifetime.runs, 1),
  counter('runs-10', 'Regular Digger', 'Finish 10 digs.', 'Shaft Regular', (s) => s.lifetime.runs, 10),
  counter('runs-50', 'Dedicated Digger', 'Finish 50 digs.', 'Dedicated Digger', (s) => s.lifetime.runs, 50),
  counter('answers-100', 'Hundred Answers', 'Give 100 answers.', 'Quick Thinker', (s) => s.lifetime.answers, 100),

  counter('streak-3', 'Back Again', 'Reach a 3-day Daily Dig streak.', 'Regular', (s) => s.streak.best, 3),
  counter('streak-7', 'Week Underground', 'Reach a 7-day Daily Dig streak.', 'Tunnel Veteran', (s) => s.streak.best, 7),
  counter('streak-30', 'Month Deep', 'Reach a 30-day Daily Dig streak.', 'Lifer', (s) => s.streak.best, 30),

  counter('depth-1000', 'Kilometre Club', 'Dig 1,000 m in one run.', 'Soil Scout', (s) => s.deepestEver, 1000),
  counter('depth-2500', 'Into the Crystals', 'Dig 2,500 m in one run.', 'Crystal Seeker', (s) => s.deepestEver, 2500),
  counter('depth-4000', 'Deep Diver', 'Dig 4,000 m in one run.', 'Deep Diver', (s) => s.deepestEver, 4000),
  counter('depth-5000', 'The Hollow', 'Dig 5,000 m in one run.', 'Hollow Walker', (s) => s.deepestEver, 5000),
  counter('depth-6800', 'The Unknown', 'Dig 6,800 m in one run.', 'Unknown Explorer', (s) => s.deepestEver, 6800),

  counter('void-find', 'Void Answer', 'Give a Void-rarity answer.', 'Void Caller', (s) => s.tierTotals.void + s.tierTotals.corebound, 1),
  counter('corebound-find', 'Corebound!', 'Give a Corebound-rarity answer.', 'Core Whisperer', (s) => s.tierTotals.corebound, 1),
  counter('rare-25', 'Rare Habit', 'Give 25 Quartz-or-rarer answers.', 'Rare Hunter', rareCount, 25),

  counter('collector-5', 'Pocketful', 'Discover 5 different items.', 'Collector', found, 5),
  counter('collector-15', 'Curator', 'Discover 15 different items.', 'Curator', found, 15),
  counter('collector-all', 'Complete Museum', 'Discover every item.', 'Museum Master', found, DISCOVERIES.length),

  {
    id: 'rainbow',
    name: 'Full Spectrum',
    description: 'Give answers from all six rarity tiers in one run.',
    title: 'Prismatic',
    check: (_s, run) => !!run && TIER_ORDER.every((t) => summarizeRun(run).tierCounts[t] > 0),
  },
  {
    id: 'score-500',
    name: 'Big Brain',
    description: 'Score 500 points or more in one run.',
    title: 'Big Brain',
    check: (_s, run) => !!run && run.mode !== 'survival' && run.points >= 500,
  },
  {
    id: 'perfect',
    name: 'Perfect Dig',
    description: 'Score the maximum for a run: every answer Corebound.',
    title: 'Perfectionist',
    check: (_s, run) =>
      !!run &&
      run.mode !== 'survival' &&
      run.answers.length >= GAME_CONFIG.questionsPerRun &&
      run.points >= GAME_CONFIG.questionsPerRun * GAME_CONFIG.pointsByTier.corebound,
  },
  {
    id: 'clean-run',
    name: 'Clean Run',
    description: 'Answer every question in a run correctly.',
    title: 'Steady Hand',
    check: (_s, run) => !!run && run.answers.length >= GAME_CONFIG.questionsPerRun && run.answers.every((a) => a.status === 'accepted'),
  },
];

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a] as const));

export function getAchievement(id: string): Achievement | undefined {
  return BY_ID.get(id);
}

/** Adds any newly earned achievements to the save, stamped with `now`. Never removes one. */
export function evaluateAchievements(save: SaveData, now: number, run?: RunState): SaveData {
  let earned: Record<string, number> | null = null;
  for (const a of ACHIEVEMENTS) {
    if (save.achievements[a.id] !== undefined) continue;
    if (a.check(save, run)) {
      earned = earned ?? { ...save.achievements };
      earned[a.id] = now;
    }
  }
  return earned ? { ...save, achievements: earned } : save;
}

/** The unfinished count-based badge the player is closest to completing (or null). */
export function nextAchievement(save: SaveData): { achievement: Achievement; value: number; target: number } | null {
  let best: { achievement: Achievement; value: number; target: number; frac: number } | null = null;
  for (const a of ACHIEVEMENTS) {
    if (save.achievements[a.id] !== undefined || !a.progress) continue;
    const [value, target] = a.progress(save);
    if (value >= target) continue;
    const frac = value / target;
    if (!best || frac > best.frac) best = { achievement: a, value, target, frac };
  }
  return best ? { achievement: best.achievement, value: best.value, target: best.target } : null;
}

/** Title the player is wearing, or null. Only earned titles count. */
export function equippedTitle(save: SaveData): string | null {
  if (!save.title) return null;
  const a = getAchievement(save.title);
  return a && save.achievements[a.id] !== undefined ? a.title : null;
}
