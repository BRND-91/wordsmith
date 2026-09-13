import { fnv1a } from './hash.js';

export const TILE_VALUES = {
  a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8,
  k: 5, l: 1, m: 3, n: 1, o: 1, p: 3, q: 10, r: 1, s: 1, t: 1,
  u: 1, v: 4, w: 4, x: 8, y: 4, z: 10,
};

export const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

// Length bonus rewards long words on an escalating curve: each letter from the
// 5th adds LEN_TIER1, each from the 8th adds LEN_TIER2 instead. This is the
// primary skill axis, so the tiers live here as the single tuning point.
const LEN_TIER1 = 5;
const LEN_TIER2 = 10;

export function lengthBonus(word) {
  let bonus = 0;
  for (let i = 4; i < word.length; i++) {
    bonus += i >= 7 ? LEN_TIER2 : LEN_TIER1;
  }
  return bonus;
}

export function tileSum(word) {
  let sum = 0;
  for (const ch of word) sum += TILE_VALUES[ch] ?? 0;
  return sum;
}

// The ruleset stamp: a hash over the two things that change what a word is worth
// — the tile values and the length tiers. A share payload and a save blob carry
// it so a routine app patch keeps runs comparable and only a genuine retune of
// these numbers invalidates the comparison, degrading to "can't compare" rather
// than lying. Keys are sorted so object order can't shift the hash.
const RULESET_STRING =
  Object.keys(TILE_VALUES).sort().map((k) => `${k}${TILE_VALUES[k]}`).join(',') +
  `|${LEN_TIER1},${LEN_TIER2}`;

export const RULESET_HASH = fnv1a(RULESET_STRING);
