import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeAnswer, singularize, stemKey } from './normalize';
import { osaDistance } from './fuzzy';

test('normalizeAnswer ignores case, accents, punctuation and leading articles', () => {
  assert.equal(normalizeAnswer('  The  NILE!! '), 'nile');
  assert.equal(normalizeAnswer('Gruyère'), 'gruyere');
  assert.equal(normalizeAnswer("Giant's Causeway"), 'giants causeway');
  assert.equal(normalizeAnswer('Track & Field'), 'track and field');
  assert.equal(normalizeAnswer('An  Elephant'), 'elephant');
});

test('normalizeAnswer of punctuation-only input is empty', () => {
  assert.equal(normalizeAnswer('?!.,'), '');
  assert.equal(stemKey('???'), '');
});

test('singularize handles common plurals without breaking words that end in s', () => {
  assert.equal(singularize('ribs'), 'rib');
  assert.equal(singularize('berries'), 'berry');
  assert.equal(singularize('churches'), 'church');
  assert.equal(singularize('tomatoes'), 'tomato');
  assert.equal(singularize('glass'), 'glass');
  assert.equal(singularize('cactus'), 'cactus');
  assert.equal(singularize('gas'), 'gas');
});

test('stemKey makes singular and plural forms identical', () => {
  assert.equal(stemKey('Giant Tortoises'), stemKey('giant tortoise'));
  assert.equal(stemKey('Himalayas'), stemKey('himalaya'));
});

test('osaDistance counts edits and adjacent transpositions', () => {
  assert.equal(osaDistance('swift', 'swift'), 0);
  assert.equal(osaDistance('swfit', 'swift'), 1);
  assert.equal(osaDistance('kitten', 'sitting'), 3);
  assert.equal(osaDistance('', 'abc'), 3);
});
