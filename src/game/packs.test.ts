import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PACKS, getPack, questionsForPack } from './packs';
import { ALL_QUESTIONS, activeQuestions } from './questions';
import { GAME_CONFIG } from './config';

test('every pack has enough active questions for a full run', () => {
  const pool = activeQuestions();
  for (const p of PACKS) {
    const n = questionsForPack(p, pool).length;
    assert.ok(n >= GAME_CONFIG.questionsPerRun, `${p.id} has only ${n} questions`);
  }
});

test('pack ids are unique and General Knowledge covers the whole bank', () => {
  assert.equal(new Set(PACKS.map((p) => p.id)).size, PACKS.length);
  const general = getPack('general');
  assert.ok(general);
  assert.equal(questionsForPack(general, ALL_QUESTIONS).length, activeQuestions().length);
});

test('a themed pack only contains its own categories', () => {
  const animals = getPack('animals');
  assert.ok(animals);
  const qs = questionsForPack(animals, ALL_QUESTIONS);
  assert.ok(qs.length > 0);
  assert.ok(qs.every((q) => q.category === 'Animals'));
});

test('inactive questions are never served from a pack', () => {
  const general = getPack('general');
  assert.ok(general);
  const draft = { ...(ALL_QUESTIONS[0] as (typeof ALL_QUESTIONS)[number]), id: 'draft-x', status: 'draft' as const };
  assert.ok(!questionsForPack(general, [...ALL_QUESTIONS, draft]).some((q) => q.id === 'draft-x'));
});
