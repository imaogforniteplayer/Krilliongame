import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_QUESTIONS } from '../questions';
import type { Question } from '../types';
import { dailyKey, msUntilNextDaily, previousDailyKey, selectDailyQuestions, selectRandomQuestions } from './challenge';
import { mulberry32 } from '../rng';

test('dailyKey is the UTC date', () => {
  assert.equal(dailyKey(new Date('2026-11-22T23:59:59Z')), '2026-11-22');
  assert.equal(dailyKey(new Date('2026-11-23T00:00:00Z')), '2026-11-23');
});

test('previousDailyKey crosses month and year boundaries', () => {
  assert.equal(previousDailyKey('2026-03-01'), '2026-02-28');
  assert.equal(previousDailyKey('2027-01-01'), '2026-12-31');
});

test('msUntilNextDaily counts down to 00:00 UTC', () => {
  assert.equal(msUntilNextDaily(new Date('2026-11-22T23:00:00Z')), 3_600_000);
});

test('everyone gets the same seven questions on the same day', () => {
  const a = selectDailyQuestions('2026-11-22', ALL_QUESTIONS).map((q) => q.id);
  const b = selectDailyQuestions('2026-11-22', ALL_QUESTIONS).map((q) => q.id);
  assert.deepEqual(a, b);
  assert.equal(a.length, 7);
  assert.equal(new Set(a).size, 7);
});

test('different days give different sets', () => {
  const sets = new Set<string>();
  for (let d = 1; d <= 20; d++) {
    sets.add(selectDailyQuestions(`2026-12-${String(d).padStart(2, '0')}`, ALL_QUESTIONS).map((q) => q.id).join());
  }
  assert.ok(sets.size >= 15, `expected variety, got ${sets.size} distinct sets in 20 days`);
});

test('questions are ordered easy to hard and prefer distinct categories', () => {
  const rank = { easy: 0, medium: 1, hard: 2 } as const;
  for (let d = 1; d <= 30; d++) {
    const qs = selectDailyQuestions(`2027-01-${String(d).padStart(2, '0')}`, ALL_QUESTIONS);
    for (let i = 1; i < qs.length; i++) assert.ok(rank[qs[i]!.difficulty] >= rank[qs[i - 1]!.difficulty]);
    assert.ok(new Set(qs.map((q) => q.category)).size >= 5);
  }
});

test('retired and draft questions are never scheduled', () => {
  const pool: Question[] = ALL_QUESTIONS.map((q, i) => (i < 5 ? { ...q, status: 'retired' as const } : q));
  const retired = new Set(pool.filter((q) => q.status !== 'active').map((q) => q.id));
  for (let d = 1; d <= 20; d++) {
    for (const q of selectDailyQuestions(`2027-02-${String(d).padStart(2, '0')}`, pool)) assert.ok(!retired.has(q.id));
  }
});

test('an admin schedule can pin a day to specific questions', () => {
  const ids = ALL_QUESTIONS.slice(10, 17).map((q) => q.id);
  const got = selectDailyQuestions('2027-03-01', ALL_QUESTIONS, { overrides: { '2027-03-01': ids } }).map((q) => q.id);
  assert.deepEqual(got, ids);
});

test('endless runs are random but valid', () => {
  const run = selectRandomQuestions(ALL_QUESTIONS, mulberry32(1));
  assert.equal(run.length, 7);
  assert.equal(new Set(run.map((q) => q.id)).size, 7);
});

test('too small a pool fails loudly', () => {
  assert.throws(() => selectDailyQuestions('2027-03-02', ALL_QUESTIONS.slice(0, 3)));
});
