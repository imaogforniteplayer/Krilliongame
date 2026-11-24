import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildIndex } from '../answerValidation/validate';
import { ALL_QUESTIONS } from './index';

test('question ids are unique', () => {
  const ids = ALL_QUESTIONS.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every question builds a collision-free answer index', () => {
  for (const q of ALL_QUESTIONS) assert.doesNotThrow(() => buildIndex(q), q.id);
});

/** Questions whose answer set is naturally small (a fixed list of seven). They may have fewer entries and less rarity spread. */
const CLOSED_LISTS = new Set(['history-ancient-wonders', 'science-noble-gases']);

test('every question has enough valid answers, an explanation and verification notes', () => {
  for (const q of ALL_QUESTIONS) {
    assert.ok(q.entries.length >= (CLOSED_LISTS.has(q.id) ? 7 : 10), `${q.id} needs several valid answers`);
    assert.ok(q.explanation.length > 30, `${q.id} explanation`);
    assert.ok(q.verification.length > 10, `${q.id} verification`);
    assert.ok(q.text.trim().endsWith('.') || q.text.trim().endsWith('?'), `${q.id} text ends with punctuation`);
  }
});

test('every question spans the rarity range so rare answers exist to find', () => {
  for (const q of ALL_QUESTIONS.filter((x) => !CLOSED_LISTS.has(x.id))) {
    const levels = new Set(q.entries.map((e) => e.commonness));
    assert.ok(levels.size >= 3, `${q.id} should mix common and rare answers`);
    assert.ok(Math.max(...levels) >= 4, `${q.id} needs at least one common answer`);
    assert.ok(Math.min(...levels) <= 2, `${q.id} needs at least one rare answer`);
  }
});
