import { normalizeAnswer } from './answerValidation/normalize';
import { previousDailyKey } from './daily/challenge';
import type { RunMode, RunState } from './session';
import { summarizeRun } from './session';
import { defaultLook } from './cosmetics/cosmetics';
import type { Look } from './cosmetics/cosmetics';
import { evaluateAchievements } from './progression/achievements';
import { applyRunToWeekly, emptyWeekly } from './progression/missions';
import type { WeeklyState } from './progression/missions';
import type { RarityTier } from './types';

/**
 * Everything DEEPER remembers on this device (local demo mode). When the Supabase backend is
 * connected this same shape is what gets synchronised, so keep it plain JSON.
 */
export interface Settings {
  volume: number;
  musicOn: boolean;
  sfxOn: boolean;
  /** null = follow the operating system's reduced-motion preference. */
  reducedMotion: boolean | null;
  skipAnimations: boolean;
}

export interface FinishedRunRecord {
  id: string;
  mode: RunMode;
  key: string;
  points: number;
  depth: number;
  finishedAt: number;
  run: RunState;
}

export interface CollectionEntry {
  count: number;
  firstFoundAt: number;
  firstDepth: number;
}

export interface UnknownAnswer {
  questionId: string;
  normalized: string;
  typed: string;
  count: number;
  firstSeen: number;
}

/** A Friend Challenge this player has finished on this device (one attempt per code). */
export interface ChallengeRecord {
  code: string;
  points: number;
  depth: number;
  finishedAt: number;
}

export interface SaveData {
  version: 1;
  settings: Settings;
  /** Ranked Daily Dig results, one per day key. */
  dailyResults: Record<string, FinishedRunRecord>;
  /** A run in progress (so a refresh resumes instead of granting a free restart). */
  activeRun: RunState | null;
  collection: Record<string, CollectionEntry>;
  streak: { current: number; best: number; lastKey: string | null };
  personalBest: { points: number; depth: number };
  lifetime: { depth: number; points: number; runs: number; answers: number; accepted: number };
  tierTotals: Record<RarityTier, number>;
  /** Plausible answers we did not recognise, queued for human review. */
  unknownAnswers: UnknownAnswer[];
  /** Ids of runs already folded into the totals (prevents counting a run twice). */
  appliedRunIds: string[];
  /** Highest depth ever reached in any mode (unlocks the biome map). */
  deepestEver: number;
  intro: { seenHowTo: boolean };
  /** Achievement id → when it was earned. */
  achievements: Record<string, number>;
  /** Achievement id whose title the player wears. */
  title: string | null;
  /** Cosmetics granted by daily mystery rewards. */
  unlockedCosmetics: string[];
  /** What the miner is currently wearing. Locked or unknown ids fall back to defaults when resolved. */
  look: Look;
  /** XP from claimed weekly missions. */
  bonusXp: number;
  weekly: WeeklyState;
  base: { theme: string };
  challenges: Record<string, ChallengeRecord>;
  /** Survival Dig is longer than a normal run, so it keeps its own record. */
  survivalBest: { answers: number; points: number; depth: number };
}

export const MAX_UNKNOWN = 200;
export const MAX_APPLIED = 60;

export function defaultSettings(): Settings {
  return { volume: 0.7, musicOn: true, sfxOn: true, reducedMotion: null, skipAnimations: false };
}

export function defaultSave(): SaveData {
  return {
    version: 1,
    settings: defaultSettings(),
    dailyResults: {},
    activeRun: null,
    collection: {},
    streak: { current: 0, best: 0, lastKey: null },
    personalBest: { points: 0, depth: 0 },
    lifetime: { depth: 0, points: 0, runs: 0, answers: 0, accepted: 0 },
    tierTotals: { pebble: 0, copper: 0, quartz: 0, obsidian: 0, void: 0, corebound: 0 },
    unknownAnswers: [],
    appliedRunIds: [],
    deepestEver: 0,
    intro: { seenHowTo: false },
    achievements: {},
    title: null,
    unlockedCosmetics: [],
    look: defaultLook(),
    bonusXp: 0,
    weekly: emptyWeekly(),
    base: { theme: 'soil' },
    challenges: {},
    survivalBest: { answers: 0, points: 0, depth: 0 },
  };
}

/** Whether this day's ranked attempt is still open, being played, or already finished. */
export function dailyAttemptState(save: SaveData, key: string): 'available' | 'in-progress' | 'done' {
  if (save.dailyResults[key]) return 'done';
  if (save.activeRun && save.activeRun.mode === 'daily' && save.activeRun.key === key && !save.activeRun.finishedAt) {
    return 'in-progress';
  }
  return 'available';
}

export function nextStreak(streak: SaveData['streak'], key: string): SaveData['streak'] {
  if (streak.lastKey === key) return streak;
  const current = streak.lastKey === previousDailyKey(key) ? streak.current + 1 : 1;
  return { current, best: Math.max(streak.best, current), lastKey: key };
}

/** Streak shown on the dashboard: still alive if the last daily was today or yesterday. */
export function liveStreak(save: SaveData, todayKey: string): number {
  const last = save.streak.lastKey;
  if (!last) return 0;
  return last === todayKey || last === previousDailyKey(todayKey) ? save.streak.current : 0;
}

export function recordUnknown(
  list: UnknownAnswer[],
  entry: { questionId: string; typed: string; now: number },
): UnknownAnswer[] {
  const normalized = normalizeAnswer(entry.typed);
  if (!normalized) return list;
  const idx = list.findIndex((u) => u.questionId === entry.questionId && u.normalized === normalized);
  if (idx >= 0) {
    const copy = list.slice();
    const prev = copy[idx] as UnknownAnswer;
    copy[idx] = { ...prev, count: prev.count + 1 };
    return copy;
  }
  const next = [...list, { questionId: entry.questionId, normalized, typed: entry.typed, count: 1, firstSeen: entry.now }];
  return next.length > MAX_UNKNOWN ? next.slice(next.length - MAX_UNKNOWN) : next;
}

/**
 * Folds a finished run into the save: collection, streak, personal bests, lifetime totals.
 * Idempotent per run id, so re-opening the results screen cannot double-count anything.
 */
export function applyFinishedRun(save: SaveData, run: RunState, now: number): SaveData {
  if (!run.finishedAt || save.appliedRunIds.includes(run.id)) return save;
  const summary = summarizeRun(run);

  const collection = { ...save.collection };
  for (const a of run.answers) {
    if (!a.discoveryId) continue;
    const prev = collection[a.discoveryId];
    collection[a.discoveryId] = prev
      ? { ...prev, count: prev.count + 1 }
      : {
          count: 1,
          firstFoundAt: now,
          firstDepth: a.depthBefore + (a.depthAfter - a.depthBefore) * (a.discoveryAt ?? 0.5),
        };
  }

  let unknownAnswers = save.unknownAnswers;
  for (const a of run.answers) {
    if (a.status === 'unknown') {
      unknownAnswers = recordUnknown(unknownAnswers, { questionId: a.questionId, typed: a.typed, now });
    }
  }

  const tierTotals = { ...save.tierTotals };
  for (const [tier, n] of Object.entries(summary.tierCounts)) tierTotals[tier as RarityTier] += n;

  const dailyResults =
    run.mode === 'daily' && !save.dailyResults[run.key]
      ? {
          ...save.dailyResults,
          [run.key]: {
            id: run.id,
            mode: run.mode,
            key: run.key,
            points: run.points,
            depth: run.depth,
            finishedAt: run.finishedAt,
            run,
          },
        }
      : save.dailyResults;

  // Survival Dig is much longer than a normal run, so it must not inflate "deepest ever" or the
  // single-run personal best that depth badges and cosmetics are measured against.
  const countsForBests = run.mode !== 'survival';
  const accepted = summary.accepted;

  const challenges =
    run.mode === 'challenge' && !save.challenges[run.key]
      ? { ...save.challenges, [run.key]: { code: run.key, points: run.points, depth: run.depth, finishedAt: run.finishedAt } }
      : save.challenges;

  const applied: SaveData = {
    ...save,
    dailyResults,
    challenges,
    activeRun: save.activeRun?.id === run.id ? null : save.activeRun,
    collection,
    streak: run.mode === 'daily' ? nextStreak(save.streak, run.key) : save.streak,
    personalBest: countsForBests
      ? {
          points: Math.max(save.personalBest.points, run.points),
          depth: Math.max(save.personalBest.depth, run.depth),
        }
      : save.personalBest,
    survivalBest:
      run.mode === 'survival'
        ? {
            answers: Math.max(save.survivalBest.answers, accepted),
            points: Math.max(save.survivalBest.points, run.points),
            depth: Math.max(save.survivalBest.depth, run.depth),
          }
        : save.survivalBest,
    lifetime: {
      depth: save.lifetime.depth + run.depth,
      points: save.lifetime.points + run.points,
      runs: save.lifetime.runs + 1,
      answers: save.lifetime.answers + run.answers.length,
      accepted: save.lifetime.accepted + summary.accepted,
    },
    tierTotals,
    unknownAnswers,
    appliedRunIds: [...save.appliedRunIds, run.id].slice(-MAX_APPLIED),
    deepestEver: countsForBests ? Math.max(save.deepestEver, run.depth) : save.deepestEver,
  };
  return evaluateAchievements(applyRunToWeekly(applied, run, now), now, run);
}

/** XP is points, a small bonus per distinct discovery, and claimed weekly missions. Level n needs 100·(n−1)² XP in total. */
export function xpOf(save: SaveData): number {
  return save.lifetime.points + Object.keys(save.collection).length * 25 + save.bonusXp;
}

export function levelFromXp(xp: number): { level: number; into: number; needed: number } {
  let level = 1;
  while (xp >= 100 * level * level) level += 1;
  const floor = 100 * (level - 1) * (level - 1);
  const ceil = 100 * level * level;
  return { level, into: xp - floor, needed: ceil - floor };
}

// ---------------------------------------------------------------------------------------------
// Persistence (browser only). Wrapped in try/catch: private windows and blocked storage must not
// crash the game; an in-memory copy keeps the current session working.
// ---------------------------------------------------------------------------------------------

const KEY = 'deeper:save:v1';
let memory: string | null = null;

function readRaw(): string | null {
  try {
    return globalThis.localStorage?.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

function writeRaw(value: string): void {
  memory = value;
  try {
    globalThis.localStorage?.setItem(KEY, value);
  } catch {
    /* storage unavailable */
  }
}

/** Merges whatever was stored over the defaults so older saves keep working after updates. */
export function migrate(parsed: unknown): SaveData {
  const base = defaultSave();
  if (!parsed || typeof parsed !== 'object') return base;
  const p = parsed as Partial<SaveData>;
  return {
    ...base,
    ...p,
    version: 1,
    settings: { ...base.settings, ...(p.settings ?? {}) },
    streak: { ...base.streak, ...(p.streak ?? {}) },
    personalBest: { ...base.personalBest, ...(p.personalBest ?? {}) },
    lifetime: { ...base.lifetime, ...(p.lifetime ?? {}) },
    tierTotals: { ...base.tierTotals, ...(p.tierTotals ?? {}) },
    intro: { ...base.intro, ...(p.intro ?? {}) },
    look: { ...base.look, ...(p.look ?? {}) },
    weekly: { ...base.weekly, ...(p.weekly ?? {}) },
    base: { ...base.base, ...(p.base ?? {}) },
    survivalBest: { ...base.survivalBest, ...(p.survivalBest ?? {}) },
    achievements: p.achievements ?? {},
    unlockedCosmetics: Array.isArray(p.unlockedCosmetics) ? p.unlockedCosmetics : [],
    challenges: p.challenges ?? {},
    dailyResults: p.dailyResults ?? {},
    collection: p.collection ?? {},
    unknownAnswers: Array.isArray(p.unknownAnswers) ? p.unknownAnswers : [],
    appliedRunIds: Array.isArray(p.appliedRunIds) ? p.appliedRunIds : [],
  };
}

export function loadSave(): SaveData {
  const raw = readRaw();
  if (!raw) return defaultSave();
  try {
    return migrate(JSON.parse(raw));
  } catch {
    return defaultSave();
  }
}

export function persistSave(save: SaveData): void {
  writeRaw(JSON.stringify(save));
}

export function resetSave(): SaveData {
  const fresh = defaultSave();
  persistSave(fresh);
  return fresh;
}
