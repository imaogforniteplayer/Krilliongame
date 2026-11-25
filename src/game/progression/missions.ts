import { rngFromString, seededShuffle } from '../rng';
import type { RunState } from '../session';
import { summarizeRun } from '../session';
import type { SaveData } from '../storage';

/**
 * Weekly missions ("mining contracts"): three small goals per week, the same for everyone,
 * chosen from the week key. They are optional and only grant bonus XP.
 */

export type MissionMetric = 'runs' | 'daily' | 'rare' | 'discoveries' | 'depth' | 'points';

export interface MissionDef {
  id: string;
  text: string;
  metric: MissionMetric;
  target: number;
  bonusXp: number;
  /** 'max' tracks the best single run (e.g. depth); 'sum' adds up over the week. */
  how: 'sum' | 'max';
}

export const MISSION_POOL: readonly MissionDef[] = [
  { id: 'm-runs-3', text: 'Finish 3 digs', metric: 'runs', target: 3, bonusXp: 40, how: 'sum' },
  { id: 'm-runs-6', text: 'Finish 6 digs', metric: 'runs', target: 6, bonusXp: 80, how: 'sum' },
  { id: 'm-daily-3', text: 'Complete the Daily Dig on 3 different days', metric: 'daily', target: 3, bonusXp: 60, how: 'sum' },
  { id: 'm-rare-5', text: 'Give 5 Quartz-or-rarer answers', metric: 'rare', target: 5, bonusXp: 50, how: 'sum' },
  { id: 'm-rare-12', text: 'Give 12 Quartz-or-rarer answers', metric: 'rare', target: 12, bonusXp: 100, how: 'sum' },
  { id: 'm-disc-2', text: 'Discover 2 items underground', metric: 'discoveries', target: 2, bonusXp: 40, how: 'sum' },
  { id: 'm-disc-5', text: 'Discover 5 items underground', metric: 'discoveries', target: 5, bonusXp: 90, how: 'sum' },
  { id: 'm-depth-2500', text: 'Dig 2,500 m in a single run', metric: 'depth', target: 2500, bonusXp: 50, how: 'max' },
  { id: 'm-depth-4000', text: 'Dig 4,000 m in a single run', metric: 'depth', target: 4000, bonusXp: 100, how: 'max' },
  { id: 'm-points-300', text: 'Score 300 points in a single run', metric: 'points', target: 300, bonusXp: 50, how: 'max' },
];

export interface WeeklyState {
  weekKey: string;
  progress: Record<string, number>;
  claimed: string[];
  /** Daily keys already counted for the 'daily' metric this week. */
  dailyKeys: string[];
}

export function emptyWeekly(weekKey = ''): WeeklyState {
  return { weekKey, progress: {}, claimed: [], dailyKeys: [] };
}

/** ISO-8601 week of a UTC date, e.g. "2026-W48". Weeks start on Monday. */
export function weekKeyOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Three missions with three different metrics, the same for everyone in a given week. */
export function missionsForWeek(weekKey: string): MissionDef[] {
  const shuffled = seededShuffle(MISSION_POOL, rngFromString(`deeper-missions|${weekKey}`));
  const out: MissionDef[] = [];
  const metrics = new Set<MissionMetric>();
  for (const m of shuffled) {
    if (metrics.has(m.metric)) continue;
    metrics.add(m.metric);
    out.push(m);
    if (out.length === 3) break;
  }
  return out;
}

/** Folds one finished run into this week's mission progress (resetting first if the week changed). */
export function applyRunToWeekly(save: SaveData, run: RunState, now: number): SaveData {
  const weekKey = weekKeyOf(new Date(now));
  const prev = save.weekly.weekKey === weekKey ? save.weekly : emptyWeekly(weekKey);
  const progress = { ...prev.progress };
  const sum = summarizeRun(run);
  const rare = run.answers.filter((a) => a.tier === 'quartz' || a.tier === 'obsidian' || a.tier === 'void' || a.tier === 'corebound').length;

  const add = (metric: MissionMetric, n: number) => {
    progress[metric] = (progress[metric] ?? 0) + n;
  };
  const best = (metric: MissionMetric, n: number) => {
    progress[metric] = Math.max(progress[metric] ?? 0, n);
  };

  add('runs', 1);
  add('rare', rare);
  add('discoveries', sum.discoveryIds.length);
  best('depth', run.depth);
  best('points', run.points);

  let dailyKeys = prev.dailyKeys;
  if (run.mode === 'daily' && !dailyKeys.includes(run.key)) {
    dailyKeys = [...dailyKeys, run.key];
    progress.daily = dailyKeys.length;
  }
  return { ...save, weekly: { ...prev, progress, dailyKeys } };
}

export function missionProgress(weekly: WeeklyState, m: MissionDef): number {
  return Math.min(weekly.progress[m.metric] ?? 0, m.target);
}

export function canClaim(weekly: WeeklyState, m: MissionDef): boolean {
  return !weekly.claimed.includes(m.id) && (weekly.progress[m.metric] ?? 0) >= m.target;
}

/** Marks a mission claimed and adds its bonus XP. Does nothing if it is not complete or already claimed. */
export function claimMission(save: SaveData, weekKey: string, missionId: string): SaveData {
  const week = save.weekly.weekKey === weekKey ? save.weekly : emptyWeekly(weekKey);
  const m = missionsForWeek(weekKey).find((x) => x.id === missionId);
  if (!m || !canClaim(week, m)) return save;
  return {
    ...save,
    bonusXp: save.bonusXp + m.bonusXp,
    weekly: { ...week, claimed: [...week.claimed, m.id] },
  };
}

/** Calendar cells for a month: which days have a finished Daily Dig. `doneKeys` are YYYY-MM-DD. */
export function monthGrid(year: number, month: number, doneKeys: ReadonlySet<string>): { day: number | null; key: string; done: boolean }[] {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday first
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: { day: number | null; key: string; done: boolean }[] = [];
  for (let i = 0; i < lead; i++) cells.push({ day: null, key: '', done: false });
  for (let d = 1; d <= days; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, key, done: doneKeys.has(key) });
  }
  return cells;
}
