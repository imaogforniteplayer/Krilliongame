import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_CONFIG } from '../config';
import type { AnswerEntry, Commonness } from '../types';
import { computeRarity, priorShare, smoothedShare, tierForShare } from './rarity';
import { emptyStatsStore, MAX_SEEN, recordObservation } from './stats';

const entry = (commonness: Commonness, id = 'x'): AnswerEntry => ({ id, canonical: id, commonness, aliases: [] });

test('curated commonness maps to the six tiers', () => {
  assert.equal(computeRarity(entry(6)).tier, 'pebble');
  assert.equal(computeRarity(entry(5)).tier, 'copper');
  assert.equal(computeRarity(entry(4)).tier, 'quartz');
  assert.equal(computeRarity(entry(3)).tier, 'obsidian');
  assert.equal(computeRarity(entry(2)).tier, 'void');
  assert.equal(computeRarity(entry(1)).tier, 'corebound');
});

test('without real data the result is labelled "estimated" with zero sample size', () => {
  const r = computeRarity(entry(3));
  assert.equal(r.source, 'estimated');
  assert.equal(r.sampleSize, 0);
  assert.equal(r.share, priorShare(entry(3)));
});

test('tier thresholds are inclusive at their lower edge', () => {
  const t = GAME_CONFIG.rarity.thresholds;
  assert.equal(tierForShare(t.pebble), 'pebble');
  assert.equal(tierForShare(t.pebble - 1e-9), 'copper');
  assert.equal(tierForShare(t.void), 'void');
  assert.equal(tierForShare(t.void - 1e-9), 'corebound');
  assert.equal(tierForShare(0), 'corebound');
});

test('too little real data keeps using the estimate', () => {
  const r = computeRarity(entry(6, 'a'), { total: GAME_CONFIG.rarity.minSampleForObserved - 1, counts: { a: 1 } });
  assert.equal(r.source, 'estimated');
  assert.equal(r.tier, 'pebble');
});

test('enough real data switches to "observed" and uses smoothing', () => {
  const total = 1000;
  const r = computeRarity(entry(6, 'a'), { total, counts: { a: 2 } });
  assert.equal(r.source, 'observed');
  assert.equal(r.sampleSize, total);
  // The curated prior (15%) is a strong belief worth 40 pretend submissions, so 2/1000 real
  // submissions pull it down but not all the way to the raw 0.2%.
  assert.ok(r.share > 0.002);
  assert.ok(r.share < 0.15);
});

test('one odd submission cannot make an answer extremely rare', () => {
  const total = 400;
  const r = computeRarity(entry(6, 'popular'), { total, counts: { popular: 0 } });
  assert.notEqual(r.tier, 'corebound');
  const solo = smoothedShare(0.15, 1, 1);
  assert.ok(solo > 0.1, 'a sample of one barely moves the prior');
});

test('smoothing rejects negative counts', () => {
  assert.throws(() => smoothedShare(0.1, -1, 10), RangeError);
});

test('an attempt can only count once per question in the statistics store', () => {
  let store = emptyStatsStore();
  const obs = { attemptKey: 'run1', questionId: 'q1', entryId: 'tortoise' };
  store = recordObservation(store, obs);
  const again = recordObservation(store, obs);
  assert.equal(again, store, 'duplicate returns the same store');
  assert.equal(store.byQuestion.q1?.total, 1);
  assert.equal(store.byQuestion.q1?.counts.tortoise, 1);

  store = recordObservation(store, { ...obs, attemptKey: 'run2' });
  assert.equal(store.byQuestion.q1?.total, 2);
});

test('the seen-list is capped', () => {
  let store = emptyStatsStore();
  for (let i = 0; i < MAX_SEEN + 50; i++) {
    store = recordObservation(store, { attemptKey: `r${i}`, questionId: 'q', entryId: 'e' });
  }
  assert.equal(store.seen.length, MAX_SEEN);
});
