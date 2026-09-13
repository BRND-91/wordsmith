import { readFileSync } from 'node:fs';

// Word frequency is a separate concern from validity: a rank orders hint
// candidates by commonness and gates early-difficulty submissions to the most
// common slice of the language. It is never consulted for whether a word is
// legal — that stays with dictionary.isValid. Rank 1 is the most frequent word;
// a word absent from the map is rarer than the capped list and the caller
// decides what that means.

export function loadRanks(path) {
  const map = new Map();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const word = line.slice(0, tab).trim();
    const rank = Number(line.slice(tab + 1));
    if (word && rank) map.set(word, rank);
  }
  return map;
}

export function makeRanks(entries) {
  return new Map(entries);
}

export function rankOf(word, ranks) {
  return ranks.get(word.toLowerCase()) ?? null;
}

// Most-common first. Unranked words sink to the end, keeping their input order
// among themselves because Array.sort is stable.
export function byCommonness(words, ranks) {
  return [...words].sort((a, b) => {
    const ra = ranks.get(a.toLowerCase()) ?? Infinity;
    const rb = ranks.get(b.toLowerCase()) ?? Infinity;
    return ra - rb;
  });
}

// True when the word sits within the top `percentile` of the ranked list, used
// to gate early-difficulty submissions to common words. percentile is in (0,1].
export function isCommonEnough(word, ranks, percentile) {
  const r = ranks.get(word.toLowerCase());
  if (!r) return false;
  return r <= ranks.size * percentile;
}
