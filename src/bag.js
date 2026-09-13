import { shuffle } from './rng.js';

// Standard Scrabble letter distribution without the two blanks: 98 tiles, a
// single copy each of the four 8-10 point letters (J X Q Z) plus K, so a
// high-value play depends on the draw rather than being always available. The
// Scrabble skew also keeps common seven-letter plays in the ~24-29 steel band
// the round targets are tuned against.
export const DISTRIBUTION = {
  e: 12, a: 9, i: 9, o: 8, n: 6, r: 6, t: 6, l: 4, s: 4, u: 4, d: 4, g: 3,
  b: 2, c: 2, m: 2, p: 2, f: 2, h: 2, v: 2, w: 2, y: 2,
  k: 1, j: 1, x: 1, q: 1, z: 1,
};

export function makeBag() {
  const tiles = [];
  for (const [letter, count] of Object.entries(DISTRIBUTION)) {
    for (let i = 0; i < count; i++) tiles.push(letter);
  }
  return tiles;
}

export function fillBag(rng) {
  return shuffle(makeBag(), rng);
}

// Letter -> copies still in the bag, sorted a-z, for the shop's tile services.
export function countTiles(bag) {
  const counts = {};
  for (const t of bag) counts[t] = (counts[t] ?? 0) + 1;
  return Object.keys(counts).sort().map((letter) => ({ letter, count: counts[letter] }));
}

// Remove one copy of a letter from the bag; false when none remains.
export function removeOne(bag, letter) {
  const i = bag.indexOf(letter);
  if (i < 0) return false;
  bag.splice(i, 1);
  return true;
}

// A curse tile is a 0-value tile that no word can use (the dictionary never
// holds it), so it wastes a rack slot until it is exchanged or removed. It is
// spliced into a seeded position so a daily meets its curses at the same draw.
export const CURSE = '*';

export function isCurse(tile) {
  return tile === CURSE;
}

export function addCurses(bag, count, rng) {
  for (let i = 0; i < count; i++) {
    bag.splice(Math.floor(rng() * (bag.length + 1)), 0, CURSE);
  }
}

export function countCurses(tiles) {
  let n = 0;
  for (const t of tiles) if (isCurse(t)) n++;
  return n;
}
