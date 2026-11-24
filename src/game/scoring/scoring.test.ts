import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_CONFIG } from '../config';
import { TIER_ORDER } from '../types';
import { equipmentForTier, EQUIPMENT_BY_TIER } from '../digging/equipment';
import { biomeAtDepth, BIOMES, nextBiome, progressInBiome } from '../biomes/biomes';
import { depthForPoints, formatMetres, maxRunDepth, maxRunPoints, pointsForTier } from './scoring';

test('points follow the starting table', () => {
  assert.deepEqual(TIER_ORDER.map(pointsForTier), [10, 15, 30, 60, 85, 100]);
});

test('every point is worth ten metres, so a perfect run is 700 points / 7,000 m', () => {
  assert.equal(depthForPoints(1), 10);
  assert.equal(maxRunPoints(), 700);
  assert.equal(maxRunDepth(), 7000);
  assert.equal(GAME_CONFIG.questionsPerRun, 7);
});

test('formatMetres groups thousands', () => {
  assert.equal(formatMetres(7000), '7,000 m');
  assert.equal(formatMetres(0), '0 m');
});

test('each tier has its own equipment, with growing duration and intensity', () => {
  const ids = TIER_ORDER.map((t) => equipmentForTier(t).id);
  assert.equal(new Set(ids).size, 6);
  for (let i = 1; i < TIER_ORDER.length; i++) {
    const a = EQUIPMENT_BY_TIER[TIER_ORDER[i - 1]!];
    const b = EQUIPMENT_BY_TIER[TIER_ORDER[i]!];
    assert.ok(b.durationMs > a.durationMs);
    assert.ok(b.intensity > a.intensity);
    assert.ok(b.durationMs >= 2000 && b.durationMs <= 5000, 'animations run 2-5 seconds');
  }
});

test('depth maps to the right biome and the maximum run reaches the final biomes', () => {
  assert.equal(biomeAtDepth(0).id, 'surface');
  assert.equal(biomeAtDepth(39).id, 'surface');
  assert.equal(biomeAtDepth(40).id, 'soft-soil');
  assert.equal(biomeAtDepth(6800).id, 'the-unknown');
  assert.equal(biomeAtDepth(maxRunDepth()).id, 'the-unknown');
  assert.equal(nextBiome(0)?.id, 'soft-soil');
  assert.equal(nextBiome(7000), null);
  assert.equal(progressInBiome(7000), 1);
  assert.equal(BIOMES.length, 15);
  BIOMES.forEach((b, i) => assert.equal(b.index, i));
  for (let i = 1; i < BIOMES.length; i++) assert.ok(BIOMES[i]!.startDepth > BIOMES[i - 1]!.startDepth);
});
