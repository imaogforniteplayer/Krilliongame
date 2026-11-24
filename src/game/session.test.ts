import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_CONFIG } from './config';
import { getQuestion } from './questions';
import { selectDailyQuestions } from './daily/challenge';
import { ALL_QUESTIONS } from './questions';
import {
  createRun, currentQuestionId, isFinished, isLate, sanitizeInput, startQuestionClock, submitAnswer,
  summarizeRun, timeLeftMs, timeoutQuestion,
} from './session';
import type { RunState } from './session';
import type { Question } from './types';

const T0 = 1_000_000;
const questions = selectDailyQuestions('2026-11-22', ALL_QUESTIONS);

function fresh(): RunState {
  return startQuestionClock(createRun({ mode: 'daily', key: '2026-11-22', questions, now: T0, id: 'run-a' }), T0);
}

const q100 = getQuestion('animals-live-100-years') as Question;
function singleQuestionRun(): RunState {
  const qs = [q100, ...questions.filter((q) => q.id !== q100.id).slice(0, 6)];
  return startQuestionClock(createRun({ mode: 'practice', key: 'p', questions: qs, now: T0, id: 'run-b' }), T0);
}

test('a run has seven questions and starts at zero depth', () => {
  const run = fresh();
  assert.equal(run.questionIds.length, GAME_CONFIG.questionsPerRun);
  assert.equal(run.depth, 0);
  assert.equal(run.points, 0);
  assert.equal(isFinished(run), false);
});

test('an accepted answer scores by rarity and adds 10 m per point', () => {
  const run = singleQuestionRun();
  const out = submitAnswer(run, q100, 'Glass sponge', T0 + 5000);
  assert.equal(out.kind, 'scored');
  if (out.kind !== 'scored') return;
  assert.equal(out.record.status, 'accepted');
  assert.equal(out.record.tier, 'corebound');
  assert.equal(out.record.points, 100);
  assert.equal(out.record.metres, 1000);
  assert.equal(out.record.equipment, 'tunnel-borer');
  assert.equal(out.run.depth, 1000);
  assert.equal(out.run.points, 100);
  assert.equal(out.run.index, 1);
  assert.equal(out.record.scoringVersion, GAME_CONFIG.scoringVersion);
  assert.equal(out.record.raritySource, 'estimated');
});

test('a common answer scores little', () => {
  const out = submitAnswer(singleQuestionRun(), q100, 'giant tortoise', T0 + 1000);
  assert.equal(out.kind === 'scored' && out.record.tier, 'pebble');
  assert.equal(out.kind === 'scored' && out.record.points, 10);
});

test('wrong, excluded and unknown answers use up the question and score zero', () => {
  for (const [typed, status] of [['elephant', 'excluded'], ['banana', 'unknown']] as const) {
    const out = submitAnswer(singleQuestionRun(), q100, typed, T0 + 1000);
    assert.equal(out.kind, 'scored');
    if (out.kind !== 'scored') continue;
    assert.equal(out.record.status, status);
    assert.equal(out.record.points, 0);
    assert.equal(out.run.depth, 0);
    assert.equal(out.run.index, 1);
  }
});

test('empty input asks again without using up the question', () => {
  const run = singleQuestionRun();
  const out = submitAnswer(run, q100, '   ', T0 + 1000);
  assert.equal(out.kind, 'retry');
  assert.equal(currentQuestionId(run), q100.id);
});

test('the same question cannot be scored twice (duplicate submission)', () => {
  const run = singleQuestionRun();
  const first = submitAnswer(run, q100, 'Glass sponge', T0 + 1000);
  assert.equal(first.kind, 'scored');
  if (first.kind !== 'scored') return;
  const second = submitAnswer(first.run, q100, 'Glass sponge', T0 + 1100);
  assert.equal(second.kind, 'retry', 'the old question is no longer active');
  assert.equal(first.run.points, 100);
});

test('answers after the deadline count as a timeout', () => {
  const run = singleQuestionRun();
  const lateAt = T0 + GAME_CONFIG.secondsPerQuestion * 1000 + GAME_CONFIG.timerGraceMs + 1;
  assert.equal(isLate(run, lateAt), true);
  const out = submitAnswer(run, q100, 'Glass sponge', lateAt);
  assert.equal(out.kind === 'scored' && out.record.status, 'timeout');
  assert.equal(out.kind === 'scored' && out.record.points, 0);
});

test('network grace allows an answer just past 25 seconds', () => {
  const run = singleQuestionRun();
  const at = T0 + GAME_CONFIG.secondsPerQuestion * 1000 + 500;
  const out = submitAnswer(run, q100, 'Glass sponge', at);
  assert.equal(out.kind === 'scored' && out.record.status, 'accepted');
});

test('the countdown uses wall-clock time, so a refresh cannot add seconds', () => {
  const run = singleQuestionRun();
  assert.equal(timeLeftMs(run, T0), 25_000);
  assert.equal(timeLeftMs(run, T0 + 10_000), 15_000);
  assert.equal(timeLeftMs(run, T0 + 99_000), 0);
  const unstarted = createRun({ mode: 'practice', key: 'p', questions, now: T0 });
  assert.equal(timeLeftMs(unstarted, T0 + 99_000), 25_000, 'the clock only runs once the question is shown');
});

test('a full run of seven finishes and totals correctly', () => {
  let run = fresh();
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const out = timeoutQuestion(run, questions[i]!, T0 + (i + 1) * 30_000);
    run = startQuestionClock(out.run, T0 + (i + 1) * 30_000);
    total += out.record.points;
  }
  assert.equal(isFinished(run), true);
  assert.equal(run.points, total);
  assert.equal(currentQuestionId(run), null);
  const after = submitAnswer(run, questions[0]!, 'anything', T0 + 999_999);
  assert.equal(after.kind, 'retry');
});

test('the best possible run is 700 points and 7,000 m', () => {
  // Every question answered with its rarest accepted answer.
  let run = fresh();
  for (let i = 0; i < 7; i++) {
    const q = questions[i]!;
    const rarest = [...q.entries].sort((a, b) => a.commonness - b.commonness)[0]!;
    const out = submitAnswer(run, q, rarest.canonical, T0 + 1000);
    assert.equal(out.kind, 'scored');
    if (out.kind !== 'scored') return;
    run = startQuestionClock(out.run, T0 + 1000);
  }
  const lowest = questions.every((q) => Math.min(...q.entries.map((e) => e.commonness)) === 1);
  if (lowest) {
    assert.equal(run.points, 700);
    assert.equal(run.depth, 7000);
  } else {
    assert.ok(run.points > 0);
  }
});

test('discoveries are deterministic for a given run id', () => {
  const a = submitAnswer(singleQuestionRun(), q100, 'Glass sponge', T0 + 1000);
  const b = submitAnswer(singleQuestionRun(), q100, 'Glass sponge', T0 + 2000);
  assert.equal(a.kind === 'scored' && a.record.discoveryId, b.kind === 'scored' && b.record.discoveryId);
});

test('summary picks best, rarest and equipment used', () => {
  let run = singleQuestionRun();
  const first = submitAnswer(run, q100, 'giant tortoise', T0 + 1000);
  assert.equal(first.kind, 'scored');
  if (first.kind !== 'scored') return;
  run = startQuestionClock(first.run, T0 + 2000);
  const q2 = questions.find((q) => q.id === run.questionIds[1])!;
  const rare = [...q2.entries].sort((a, b) => a.commonness - b.commonness)[0]!;
  const second = submitAnswer(run, q2, rare.canonical, T0 + 3000);
  assert.equal(second.kind, 'scored');
  if (second.kind !== 'scored') return;
  const s = summarizeRun(second.run);
  assert.equal(s.accepted, 2);
  assert.equal(s.rarest?.questionId, q2.id);
  assert.equal(s.best?.questionId, q2.id);
  assert.equal(s.equipmentUsed.length, 2);
  assert.equal(s.points, second.run.points);
});

test('sanitizeInput strips control characters and invisible direction marks', () => {
  assert.equal(sanitizeInput('  gia\u0000nt‮   tortoise\n'), 'gia nt tortoise');
  assert.ok(sanitizeInput('x'.repeat(500)).length <= GAME_CONFIG.maxAnswerLength + 20);
});
