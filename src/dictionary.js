import { readFileSync } from 'node:fs';

export const MIN_LEN = 2; // two-letter words are legal; slang is excluded at list-build time

// The word list ships as one lowercased token per line (ENABLE, public domain).
// Slang is filtered when the list is built, so runtime validation only enforces
// membership and the length floor.
export function loadDictionary(path) {
  const words = readFileSync(path, 'utf8').split('\n');
  const set = new Set();
  for (const w of words) {
    const t = w.trim().toLowerCase();
    if (t.length >= MIN_LEN) set.add(t);
  }
  return set;
}

export function makeDictionary(words) {
  const set = new Set();
  for (const w of words) {
    const t = w.toLowerCase();
    if (t.length >= MIN_LEN) set.add(t);
  }
  return set;
}

export function isValid(word, dict) {
  const w = word.toLowerCase();
  return w.length >= MIN_LEN && dict.has(w);
}
