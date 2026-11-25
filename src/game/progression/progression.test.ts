import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectDailyQuestions, selectSurvivalQuestions } from '../daily/challenge';
import { defaultLook } from '../cosmetics/cosmetics';
import { rngFromString } from '../rng';
import { createRun, startQuestionClock, submitAnswer } from '../session';
import { SURVIVAL_LIVES } from '../session';
import { defaultSave, levelFromXp, migrate, xpOf } from '../storage';
import type { SaveData } from '../storage';
import { ALL_QUESTIONS, activeQuestions } from '../questions';
import { answerForTier, playRun, rarestAnswer } from '../testutil';
import type { Question, RarityTier } from '../types';
import { ACHIEVEMENTS, equippedTitle, evaluateAchievements, nextAchievement } from './achievements';
import { finalizeRun } from './finalize';
import {
  applyRunToWeekly, canClaim, claimMission, emptyWeekly, missionProgress, missionsForWeek, monthGrid, weekKeyOf,
} from './missions';

const NOW = Date.UTC(2026, 10, 25, 3, 0, 0); // Wed 25 Nov 2026
const key = '2026-11-25';

/** Seven questions that each have a Corebound answer, for a perfect run. */
const perfectQs = activeQuestions().filter((q) => answerForTier(q, 'corebound')).slice(0, 7);
function perfectRun(id: string, mode: 'daily' | 'practice' = 'daily') {
  return playRun({ mode, key, questions: perfectQs, pick: (q) => answerForTier(q, 'corebound'), id });
}
function missRun(id: string) {
  const qs = selectDailyQuestions('2026-11-26', ALL_QUESTIONS);
  return playRun({ mode: 'practice', key: 'p', questions: qs, pick: () => null, id });
}

test('there are enough Corebound-capable questions to build a perfect run', () => {
  assert.equal(perfectQs.length, 7);
});

test('a perfect run earns the big achievements, the title, and a mystery reward', () => {
  const run = perfectRun('perfect-1');
  assert.equal(run.points, 700);
  const out = finalizeRun(defaultSave(), run, NOW);
  for (const id of ['first-dig', 'perfect', 'score-500', 'clean-run', 'corebound-find', 'void-find', 'depth-5000', 'depth-6800']) {
    assert.ok(out.newAchievements.includes(id), `missing ${id}`);
  }
  assert.ok(out.reward, 'daily run grants a mystery reward');
  assert.ok(out.save.unlockedCosmetics.includes(out.reward));
  assert.ok(out.newCosmetics.includes(out.reward));
  const wear = { ...out.save, title: 'perfect' };
  assert.equal(equippedTitle(wear), 'Perfectionist');
});

test('finalising the same run twice changes nothing the second time', () => {
  const run = perfectRun('perfect-2');
  const once = finalizeRun(defaultSave(), run, NOW);
  const twice = finalizeRun(once.save, run, NOW + 1000);
  assert.equal(twice.save, once.save);
  assert.deepEqual(twice.newAchievements, []);
  assert.equal(twice.reward, null);
});

test('only ranked Daily Digs grant a mystery reward', () => {
  const out = finalizeRun(defaultSave(), perfectRun('perfect-3', 'practice'), NOW);
  assert.equal(out.reward, null);
  assert.deepEqual(out.save.unlockedCosmetics, []);
});

test('a run of misses still counts as a first dig but earns nothing rare', () => {
  const out = finalizeRun(defaultSave(), missRun('miss-1'), NOW);
  assert.deepEqual(out.newAchievements, ['first-dig']);
  assert.equal(out.save.deepestEver, 0);
});

test('Full Spectrum needs all six tiers in one run', () => {
  const tiers: RarityTier[] = ['pebble', 'copper', 'quartz', 'obsidian', 'void', 'corebound'];
  const used = new Set<string>();
  const chosen: { q: Question; tier: RarityTier }[] = [];
  for (const tier of tiers) {
    const q = activeQuestions().find((x) => !used.has(x.id) && answerForTier(x, tier));
    assert.ok(q, `a question with a ${tier} answer`);
    used.add(q.id);
    chosen.push({ q, tier });
  }
  const play = (picks: typeof chosen) =>
    playRun({
      mode: 'practice',
      key: 'p',
      questions: picks.map((c) => c.q),
      pick: (_q, i) => answerForTier((picks[i] as (typeof chosen)[number]).q, (picks[i] as (typeof chosen)[number]).tier),
    });

  const all = play(chosen);
  assert.equal(all.answers.length, 6);
  assert.ok(finalizeRun(defaultSave(), all, NOW).newAchievements.includes('rainbow'));

  // Same run but the last answer is a second Pebble: only five tiers, so no badge.
  const five = play(chosen.map((c, i) => (i === 5 ? { q: c.q, tier: 'pebble' as RarityTier } : c)).filter((c) => answerForTier(c.q, c.tier)));
  assert.ok(!finalizeRun(defaultSave(), five, NOW).newAchievements.includes('rainbow'));
});

test('streak and count badges come from the save, and are never removed', () => {
  let s: SaveData = { ...defaultSave(), streak: { current: 7, best: 7, lastKey: key }, lifetime: { ...defaultSave().lifetime, runs: 12 } };
  s = evaluateAchievements(s, NOW);
  for (const id of ['streak-3', 'streak-7', 'first-dig', 'runs-10']) assert.ok(s.achievements[id] !== undefined, id);
  assert.equal(s.achievements['streak-30'], undefined);
  const lower = evaluateAchievements({ ...s, streak: { current: 0, best: 0, lastKey: null } }, NOW + 1);
  assert.equal(lower.achievements['streak-7'], NOW);
});

test('progress points at the closest unfinished badge', () => {
  const s = { ...defaultSave(), lifetime: { ...defaultSave().lifetime, runs: 9 } };
  const next = nextAchievement(evaluateAchievements(s, NOW));
  assert.ok(next);
  assert.equal(next.achievement.id, 'runs-10');
  assert.equal(next.value, 9);
  assert.equal(next.target, 10);
});

test('achievement ids and titles are unique', () => {
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.title)).size, ACHIEVEMENTS.length);
});

test('a title can only be worn once it has been earned', () => {
  assert.equal(equippedTitle({ ...defaultSave(), title: 'perfect' }), null);
});

// ------------------------------------------------------------------ survival

test('survival: each miss costs a life and the third miss ends the run', () => {
  const qs = selectSurvivalQuestions(activeQuestions(), rngFromString('s1'));
  let run = startQuestionClock(createRun({ mode: 'survival', key: 's', questions: qs, now: 1, id: 'surv-1' }), 1);
  assert.equal(run.lives, SURVIVAL_LIVES);
  const step = (text: string) => {
    const q = qs[run.index] as Question;
    const out = submitAnswer(run, q, text, 2000 + run.index * 1000);
    assert.equal(out.kind, 'scored');
    if (out.kind === 'scored') run = startQuestionClock(out.run, 2000 + run.index * 1000);
  };
  step(rarestAnswer(qs[0] as Question));
  assert.equal(run.lives, 3);
  step('qqqq zzzz');
  assert.equal(run.lives, 2);
  step(rarestAnswer(qs[2] as Question));
  step('qqqq zzzz');
  assert.equal(run.lives, 1);
  assert.equal(run.finishedAt, null);
  step('qqqq zzzz');
  assert.equal(run.lives, 0);
  assert.notEqual(run.finishedAt, null);
  assert.equal(run.answers.length, 5);
});

test('survival: an empty answer asks again and does not cost a life', () => {
  const qs = selectSurvivalQuestions(activeQuestions(), rngFromString('s2'));
  const run = startQuestionClock(createRun({ mode: 'survival', key: 's', questions: qs, now: 1, id: 'surv-2' }), 1);
  const out = submitAnswer(run, qs[0] as Question, '   ', 2000);
  assert.equal(out.kind, 'retry');
});

test('survival never touches the normal personal best, deepest dig or depth badges', () => {
  const qs = selectSurvivalQuestions(activeQuestions(), rngFromString('s3'));
  const run = playRun({ mode: 'survival', key: 's', questions: qs, pick: (q) => rarestAnswer(q), id: 'surv-3' });
  assert.ok(run.depth > 7000, 'a long survival run can go past a normal run');
  const out = finalizeRun(defaultSave(), run, NOW);
  assert.equal(out.save.deepestEver, 0);
  assert.equal(out.save.personalBest.depth, 0);
  assert.ok(out.save.survivalBest.depth > 7000);
  assert.equal(out.save.achievements['depth-6800'], undefined);
  assert.equal(out.save.achievements['score-500'], undefined);
  assert.equal(out.reward, null);
});

// ------------------------------------------------------------------ missions

test('ISO week keys', () => {
  assert.equal(weekKeyOf(new Date(Date.UTC(2026, 0, 1))), '2026-W01');
  assert.equal(weekKeyOf(new Date(Date.UTC(2024, 11, 30))), '2025-W01');
  assert.equal(weekKeyOf(new Date(Date.UTC(2021, 0, 3))), '2020-W53');
  assert.equal(weekKeyOf(new Date(Date.UTC(2026, 10, 22))), weekKeyOf(new Date(Date.UTC(2026, 10, 16))));
  assert.notEqual(weekKeyOf(new Date(Date.UTC(2026, 10, 22))), weekKeyOf(new Date(Date.UTC(2026, 10, 23))));
});

test('three missions per week, with different goals, the same for everyone', () => {
  const a = missionsForWeek('2026-W48');
  assert.equal(a.length, 3);
  assert.equal(new Set(a.map((m) => m.metric)).size, 3);
  assert.deepEqual(a.map((m) => m.id), missionsForWeek('2026-W48').map((m) => m.id));
  const different = Array.from({ length: 10 }, (_, i) => missionsForWeek(`2026-W${10 + i}`).map((m) => m.id).join());
  assert.ok(new Set(different).size > 1);
});

test('mission progress accumulates through the week, resets in a new week, and bonus XP is claimed once', () => {
  const week = weekKeyOf(new Date(NOW));
  let s = defaultSave();
  const run = perfectRun('wk-1');
  s = applyRunToWeekly(s, run, NOW);
  s = applyRunToWeekly(s, perfectRun('wk-2'), NOW + 3600_000);
  assert.equal(s.weekly.weekKey, week);
  assert.equal(s.weekly.progress.runs, 2);
  assert.equal(s.weekly.progress.depth, 7000);
  assert.equal(s.weekly.dailyKeys.length, 1, 'the same daily key is only counted once');

  const next = applyRunToWeekly(s, missRun('wk-3'), NOW + 8 * 86_400_000);
  assert.notEqual(next.weekly.weekKey, week);
  assert.equal(next.weekly.progress.runs, 1);
});

test('claiming needs the goal to be complete, pays once, and counts towards XP', () => {
  const week = weekKeyOf(new Date(NOW));
  const mission = missionsForWeek(week)[0];
  assert.ok(mission);
  let s = defaultSave();
  assert.equal(claimMission(s, week, mission.id), s, 'not complete yet');
  s = { ...s, weekly: { ...emptyWeekly(week), progress: { [mission.metric]: mission.target } } };
  assert.equal(canClaim(s.weekly, mission), true);
  assert.equal(missionProgress(s.weekly, mission), mission.target);
  const paid = claimMission(s, week, mission.id);
  assert.equal(paid.bonusXp, mission.bonusXp);
  assert.equal(xpOf(paid), xpOf(s) + mission.bonusXp);
  assert.equal(claimMission(paid, week, mission.id), paid, 'second claim pays nothing');
  assert.ok(levelFromXp(xpOf(paid)).level >= 1);
});

test('calendar grid starts on Monday and marks finished days', () => {
  const grid = monthGrid(2026, 10, new Set(['2026-11-03', '2026-11-25']));
  assert.equal(grid.filter((c) => c.day !== null).length, 30);
  assert.equal(grid.findIndex((c) => c.day === 1), 6, '1 Nov 2026 is a Sunday');
  assert.equal(grid.filter((c) => c.done).length, 2);
});

// ------------------------------------------------------------------ save migration

test('an old save with none of the new fields loads with sensible defaults', () => {
  const s = migrate({ version: 1, lifetime: { depth: 1, points: 2, runs: 3, answers: 4, accepted: 5 }, streak: { current: 2, best: 4, lastKey: key } });
  assert.deepEqual(s.look, defaultLook());
  assert.deepEqual(s.achievements, {});
  assert.deepEqual(s.unlockedCosmetics, []);
  assert.equal(s.bonusXp, 0);
  assert.equal(s.base.theme, 'soil');
  assert.equal(s.lifetime.runs, 3);
  assert.equal(s.streak.best, 4);
});
