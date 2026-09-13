import { readFileSync, writeFileSync } from 'node:fs';
import { MIN_LEN } from '../src/dictionary.js';

// Regenerates the two shipped word assets from raw source lists:
//   assets/words.txt - ENABLE, one lowercased token per line, length floor applied
//   assets/ranks.txt - the RANK_CAP most frequent ENABLE words, "word\trank"
// Both sources are keyless public-domain downloads:
//   ENABLE  https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt
//   Norvig  https://norvig.com/ngrams/count_1w.txt
// Run: node tools/build-dictionary.mjs [enablePath] [norvigPath]

const RANK_CAP = 40000; // frequency-map size; sorts hints and gates early difficulty, never validity

const [enablePath = '/tmp/enable_raw.txt', norvigPath = '/tmp/norvig_raw.txt'] =
  process.argv.slice(2);
const WORDS_OUT = new URL('../assets/words.txt', import.meta.url);
const RANKS_OUT = new URL('../assets/ranks.txt', import.meta.url);

const alphaOnly = /^[a-z]+$/;

function buildWords(raw) {
  const set = new Set();
  for (const line of raw.split('\n')) {
    const w = line.trim().toLowerCase();
    if (w.length >= MIN_LEN && alphaOnly.test(w)) set.add(w);
  }
  return set;
}

// Norvig's list is already sorted by descending count, so a valid word's rank is
// its ordinal among the valid words kept, capped at RANK_CAP.
function buildRanks(raw, valid) {
  const out = [];
  const seen = new Set();
  for (const line of raw.split('\n')) {
    if (out.length >= RANK_CAP) break;
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const w = line.slice(0, tab).trim().toLowerCase();
    if (valid.has(w) && !seen.has(w)) {
      seen.add(w);
      out.push(`${w}\t${out.length + 1}`);
    }
  }
  return out;
}

const words = [...buildWords(readFileSync(enablePath, 'utf8'))].sort();
writeFileSync(WORDS_OUT, words.join('\n') + '\n');

const ranks = buildRanks(readFileSync(norvigPath, 'utf8'), new Set(words));
writeFileSync(RANKS_OUT, ranks.join('\n') + '\n');

console.log(`words.txt: ${words.length}`);
console.log(`ranks.txt: ${ranks.length}`);
