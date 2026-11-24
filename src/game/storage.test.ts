import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_QUESTIONS } from './questions';
import { selectDailyQuestions } from './daily/challenge';
import { createRun, startQuestionClock, submitAnswer, timeoutQuestion } from './session';
import type { RunState } from './session';
import {
  applyFinishedRun, dailyAttemptState, defaultSave, levelFromXp, liveStreak, migrate, nextStreak, recordUnknown, xpOf,
} from './storage';

const qs = selectDailyQuestions('2026-11-22', ALL_QUESTIONS);

function finishedRun(key: string, id: string, mode: 'daily' | 'endless' = 'daily'): RunState {
  let run = startQuestionClock(createRun({ mode, key, questions: qs, now: 1000, id }), 1000);
  for (let i = 0; i < 7; i++) {
    const q = qs[i]!;
    const rare = [...q.entries].sort((a, b) => a.commonness - b.commonness)[0]!;
    const out = submitAnswer(run, q, rare.canonical, 2000);
    if (out.kind !== 'scored') throw new Error('expected a scored answer');
    run = startQuestionClock(out.run, 2000);
  }
  return run;
}

test('finishing a daily run records the result and blocks a second ranked attempt', () => {
  const run = finishedRun('2026-11-22', 'r1');
  const save = applyFinishedRun(defaultSave(), run, 5000);
  assert.equal(dailyAttemptState(save, '2026-11-22'), 'done');
  assert.equal(dailyAttemptState(save, '2026-11-23'), 'available');
  assert.equal(save.dailyResults['2026-11-22']?.points, run.points);
  assert.equal(save.lifetime.runs, 1);
  assert.equal(save.personalBest.points, run.points);
  assert.equal(save.streak.current, 1);
});

test('a run in progress resumes instead of restarting', () => {
  const run = startQuestionClock(createRun({ mode: 'daily', key: '2026-11-22', questions: qs, now: 1000, id: 'live' }), 1000);
  const save = { ...defaultSave(), activeRun: run };
  assert.equal(dailyAttemptState(save, '2026-11-22'), 'in-progress');
  assert.equal(dailyAttemptState(save, '2026-11-21'), 'available');
});

test('applying the same run twice does not double count', () => {
  const run = finishedRun('2026-11-22', 'dup');
  const once = applyFinishedRun(defaultSave(), run, 5000);
  const twice = applyFinishedRun(once, run, 6000);
  assert.deepEqual(twice, once);
  assert.equal(twice.lifetime.runs, 1);
});

test('endless runs do not touch daily results or the streak', () => {
  const save = applyFinishedRun(defaultSave(), finishedRun('endless', 'e1', 'endless'), 5000);
  assert.deepEqual(save.dailyResults, {});
  assert.equal(save.streak.current, 0);
  assert.equal(save.lifetime.runs, 1);
});

test('streak grows on consecutive days, holds on the same day and resets after a gap', () => {
  let s = nextStreak({ current: 0, best: 0, lastKey: null }, '2026-11-22');
  assert.equal(s.current, 1);
  s = nextStreak(s, '2026-11-22');
  assert.equal(s.current, 1);
  s = nextStreak(s, '2026-11-23');
  assert.equal(s.current, 2);
  s = nextStreak(s, '2026-11-26');
  assert.equal(s.current, 1);
  assert.equal(s.best, 2);
});

test('liveStreak drops to zero once a day has been missed', () => {
  const save = { ...defaultSave(), streak: { current: 4, best: 4, lastKey: '2026-11-22' } };
  assert.equal(liveStreak(save, '2026-11-22'), 4);
  assert.equal(liveStreak(save, '2026-11-23'), 4);
  assert.equal(liveStreak(save, '2026-11-24'), 0);
});

test('discoveries are collected with counts', () => {
  let run = startQuestionClock(createRun({ mode: 'endless', key: 'e', questions: qs, now: 0, id: 'find' }), 0);
  for (let i = 0; i < 7; i++) run = startQuestionClock(timeoutQuestion(run, qs[i]!, 100).run, 100);
  run = { ...run, answers: run.answers.map((a, i) => (i === 0 ? { ...a, discoveryId: 'diamond', discoveryAt: 0.5 } : a)) };
  const save = applyFinishedRun(defaultSave(), run, 9000);
  assert.equal(save.collection.diamond?.count, 1);
});

test('unknown answers are queued once and counted afterwards', () => {
  let list = recordUnknown([], { questionId: 'q', typed: 'Blue Whale!', now: 1 });
  list = recordUnknown(list, { questionId: 'q', typed: 'blue whale', now: 2 });
  assert.equal(list.length, 1);
  assert.equal(list[0]!.count, 2);
  assert.deepEqual(recordUnknown(list, { questionId: 'q', typed: '???', now: 3 }), list);
});

test('level curve and migration of partial saves', () => {
  assert.equal(levelFromXp(0).level, 1);
  assert.equal(levelFromXp(100).level, 2);
  assert.equal(levelFromXp(399).level, 2);
  assert.equal(levelFromXp(400).level, 3);
  assert.equal(xpOf(defaultSave()), 0);
  const m = migrate({ lifetime: { depth: 5 } });
  assert.equal(m.lifetime.depth, 5);
  assert.equal(m.lifetime.runs, 0);
  assert.equal(m.settings.volume, 0.7);
  assert.deepEqual(migrate('garbage'), defaultSave());
});
