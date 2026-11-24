import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defineQuestion } from '../questions/parse';
import { getQuestion } from '../questions';
import { validateAnswer } from './validate';

const q = defineQuestion({
  id: 'test-gems',
  text: 'Name a gemstone.',
  category: 'Nature',
  difficulty: 'easy',
  answers: [
    'Diamond|6|diamonds',
    'Emerald|5',
    'Tanzanite|2',
    'Taaffeite|1',
    'Sapphire|5',
    'Sapphyre alt|1',
  ],
  exclusions: ['glass|Glass is man-made, not a gemstone.'],
  explanation: 'Test question.',
});

test('accepts exact answers regardless of case and punctuation', () => {
  const r = validateAnswer(q, '  dIaMoNd!! ');
  assert.equal(r.status, 'accepted');
  if (r.status === 'accepted') {
    assert.equal(r.entry.canonical, 'Diamond');
    assert.equal(r.matchType, 'exact');
  }
});

test('accepts aliases and plural forms', () => {
  assert.equal(validateAnswer(q, 'Diamonds').status, 'accepted');
  assert.equal(validateAnswer(q, 'Emeralds').status, 'accepted');
});

test('spelling tolerance accepts a clear single typo on longer words', () => {
  const r = validateAnswer(q, 'Tanzanyte');
  assert.equal(r.status, 'accepted');
  if (r.status === 'accepted') assert.equal(r.matchType, 'fuzzy');
});

test('spelling tolerance never applies to short answers', () => {
  const short = defineQuestion({
    id: 'test-short', text: 'Name a thing.', category: 'Nature', difficulty: 'easy',
    answers: ['Jade|3', 'Jet|2'], explanation: 'x',
  });
  assert.equal(validateAnswer(short, 'Jada').status, 'unknown');
});

test('exclusions are rejected with their reason', () => {
  const r = validateAnswer(q, 'glass');
  assert.equal(r.status, 'excluded');
  if (r.status === 'excluded') assert.match(r.reason, /man-made/);
});

test('unknown answers are never guessed and are not accepted', () => {
  assert.equal(validateAnswer(q, 'banana').status, 'unknown');
});

test('empty, whitespace-only and over-long input is handled', () => {
  assert.equal(validateAnswer(q, '').status, 'empty');
  assert.equal(validateAnswer(q, '    ').status, 'empty');
  assert.equal(validateAnswer(q, 'x'.repeat(500)).status, 'invalid');
  assert.equal(validateAnswer(q, '!!!').status, 'invalid');
});

test('equally-close fuzzy matches are ambiguous instead of guessed', () => {
  const amb = defineQuestion({
    id: 'test-amb', text: 'Name a thing.', category: 'Nature', difficulty: 'easy',
    answers: ['Marble|3', 'Marbly|2'], explanation: 'x',
  });
  assert.equal(validateAnswer(amb, 'Marblx').status, 'ambiguous');
});

test('real bank: a famous answer and a deep cut both validate', () => {
  const live100 = getQuestion('animals-live-100-years');
  assert.ok(live100);
  assert.equal(validateAnswer(live100, 'giant tortoise').status, 'accepted');
  assert.equal(validateAnswer(live100, 'Glass sponge').status, 'accepted');
  assert.equal(validateAnswer(live100, 'elephant').status, 'excluded');
});
