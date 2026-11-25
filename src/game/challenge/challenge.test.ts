import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_CONFIG } from '../config';
import { selectChallengeQuestions, selectSurvivalQuestions } from '../daily/challenge';
import { activeQuestions } from '../questions';
import { rngFromString } from '../rng';
import { compareResults, decodeResult, encodeResult, makeChallengeCode, parseChallengeCode } from './code';

test('codes have the DEEP-XXXXXX shape and avoid look-alike characters', () => {
  const rng = rngFromString('codes');
  for (let i = 0; i < 200; i++) {
    const c = makeChallengeCode(rng);
    assert.match(c, /^DEEP-[2-9A-HJKMNP-Z]{6}$/);
    assert.equal(parseChallengeCode(c), c);
  }
});

test('parsing is forgiving about case, spacing and the prefix, and strict about everything else', () => {
  assert.equal(parseChallengeCode('deep-ab23cd'), 'DEEP-AB23CD');
  assert.equal(parseChallengeCode('  ab23cd '), 'DEEP-AB23CD');
  assert.equal(parseChallengeCode('DEEP AB23 CD'), 'DEEP-AB23CD');
  assert.equal(parseChallengeCode('DEEP-AB23C'), null);
  assert.equal(parseChallengeCode('DEEP-AB23CDE'), null);
  assert.equal(parseChallengeCode('DEEP-AB0OCD'), null); // 0 and O are not in the alphabet
  assert.equal(parseChallengeCode(''), null);
});

test('the same code always gives the same seven questions; different codes differ', () => {
  const pool = activeQuestions();
  const a1 = selectChallengeQuestions('DEEP-AB23CD', pool).map((q) => q.id);
  const a2 = selectChallengeQuestions('DEEP-AB23CD', pool).map((q) => q.id);
  const b = selectChallengeQuestions('DEEP-ZZ99YY', pool).map((q) => q.id);
  assert.equal(a1.length, GAME_CONFIG.questionsPerRun);
  assert.deepEqual(a1, a2);
  assert.notDeepEqual(a1, b);
  assert.equal(new Set(a1).size, a1.length);
});

test('result codes round-trip and reject tampering', () => {
  const r = { code: 'DEEP-AB23CD', points: 430, depth: 4300 };
  const text = encodeResult(r);
  assert.deepEqual(decodeResult(text), r);
  assert.deepEqual(decodeResult(text.toLowerCase()), r);
  assert.equal(decodeResult(text.replace('.430.', '.700.')), null);
  assert.equal(decodeResult('DEEP-AB23CD.430.4300'), null);
  assert.equal(decodeResult('nonsense'), null);
});

test('comparison is by points, then depth, then a tie', () => {
  const base = { code: 'DEEP-AB23CD', points: 400, depth: 4000 };
  assert.equal(compareResults(base, { ...base, points: 300 }), 'you');
  assert.equal(compareResults(base, { ...base, points: 500 }), 'them');
  assert.equal(compareResults(base, { ...base, depth: 3900 }), 'you');
  assert.equal(compareResults(base, base), 'tie');
});

test('survival questions get harder: easy, then medium, then hard', () => {
  const qs = selectSurvivalQuestions(activeQuestions(), rngFromString('surv'));
  assert.equal(qs.length, 15);
  const rank = { easy: 0, medium: 1, hard: 2 } as const;
  for (let i = 1; i < qs.length; i++) {
    assert.ok(rank[(qs[i] as (typeof qs)[number]).difficulty] >= rank[(qs[i - 1] as (typeof qs)[number]).difficulty]);
  }
  assert.equal(new Set(qs.map((q) => q.id)).size, qs.length);
});
