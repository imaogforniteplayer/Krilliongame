import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACHIEVEMENTS } from '../progression/achievements';
import {
  COSMETICS, EMOTE_MOOD, SLOTS, defaultLook, getCosmetic, isUnlocked, itemsInSlot, lockedItems, pickMysteryReward, resolveLook,
} from './cosmetics';
import type { UnlockContext } from './cosmetics';

const fresh: UnlockContext = {
  level: 1, bestStreak: 0, discoveries: 0, deepest: 0, achievements: new Set(), granted: new Set(),
};
const everything: UnlockContext = {
  level: 99, bestStreak: 99, discoveries: 99, deepest: 99_999,
  achievements: new Set(ACHIEVEMENTS.map((a) => a.id)), granted: new Set(COSMETICS.filter((c) => c.unlock.type === 'mystery').map((c) => c.id)),
};

test('cosmetic ids are unique', () => {
  assert.equal(new Set(COSMETICS.map((c) => c.id)).size, COSMETICS.length);
});

test('every slot has exactly one starter item and it matches the default look', () => {
  const look = defaultLook();
  for (const { slot } of SLOTS) {
    const defaults = itemsInSlot(slot).filter((c) => c.unlock.type === 'default');
    assert.equal(defaults.length, 1, slot);
    assert.equal(look[slot], (defaults[0] as (typeof defaults)[number]).id);
  }
});

test('achievement unlocks point at real achievements, and colour slots define colours', () => {
  const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
  for (const c of COSMETICS) {
    if (c.unlock.type === 'achievement') assert.ok(ids.has(c.unlock.id), `${c.id} -> ${c.unlock.id}`);
    if (c.slot === 'helmet' || c.slot === 'outfit' || c.slot === 'gloves') assert.ok(c.colors, `${c.id} needs colours`);
  }
});

test('a new player owns only starter items; a finished player owns all but unrewarded mystery items', () => {
  const owned = COSMETICS.filter((c) => isUnlocked(c, fresh));
  assert.ok(owned.every((c) => c.unlock.type === 'default'));
  assert.equal(lockedItems(everything).length, 0);
});

test('mystery-only items cannot be unlocked any other way', () => {
  const noGrants = { ...everything, granted: new Set<string>() };
  const mystery = COSMETICS.filter((c) => c.unlock.type === 'mystery');
  assert.ok(mystery.length > 0);
  assert.ok(mystery.every((c) => !isUnlocked(c, noGrants)));
});

test('resolveLook swaps anything locked, unknown or in the wrong slot for the default', () => {
  const look = resolveLook({ helmet: 'helmet-red', outfit: 'nope', pet: 'helmet-gold' }, { ...fresh, level: 2 });
  assert.equal(look.helmet, 'helmet-red');
  assert.equal(look.outfit, 'outfit-blue');
  assert.equal(look.pet, 'pet-none');
  assert.deepEqual(resolveLook({ helmet: 'helmet-red' }, fresh), defaultLook());
  assert.deepEqual(resolveLook(undefined, fresh), defaultLook());
});

test('mystery reward is deterministic, never already owned, and null when nothing is left', () => {
  const a = pickMysteryReward(fresh, 'run-1');
  const b = pickMysteryReward(fresh, 'run-1');
  assert.ok(a);
  assert.equal(a.id, b?.id);
  assert.ok(!isUnlocked(a, fresh));
  const seen = new Set(Array.from({ length: 60 }, (_, i) => pickMysteryReward(fresh, `run-${i}`)?.id));
  assert.ok(seen.size > 5, 'rewards should vary between runs');
  assert.equal(pickMysteryReward(everything, 'x'), null);
});

test('every emote maps to a mood the renderer knows', () => {
  for (const c of itemsInSlot('emote')) assert.ok(EMOTE_MOOD[c.id], c.id);
  assert.ok(getCosmetic('pet-mole'));
});
