import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadDictionary, isValid } from '../src/dictionary.js';
import {
  loadRanks,
  makeRanks,
  rankOf,
  byCommonness,
  isCommonEnough,
} from '../src/frequency.js';

let pass = 0;
function check(name, fn) {
  fn();
  pass++;
  console.log(`ok - ${name}`);
}

const WORDS = fileURLToPath(new URL('../assets/words.txt', import.meta.url));
const RANKS = fileURLToPath(new URL('../assets/ranks.txt', import.meta.url));

check('shipped word asset loads and validates real words', () => {
  const dict = loadDictionary(WORDS);
  assert.ok(dict.size > 150000, `expected 150k+ words, got ${dict.size}`);
  assert.equal(isValid('quiz', dict), true);
  assert.equal(isValid('ax', dict), true); // two-letter word, admin-approved floor of 2
  assert.equal(isValid('a', dict), false); // below the length floor
  assert.equal(isValid('yeet', dict), false); // slang absent from ENABLE
});

check('rank asset is capped and ordered most-common-first', () => {
  const ranks = loadRanks(RANKS);
  assert.ok(ranks.size > 0 && ranks.size <= 40000, `got ${ranks.size}`);
  assert.equal(rankOf('the', ranks), 1); // most frequent English word
  assert.equal(rankOf('quiz', ranks) > 1, true);
});

check('a valid word rarer than the cap has no rank', () => {
  const dict = loadDictionary(WORDS);
  const ranks = loadRanks(RANKS);
  assert.equal(isValid('zyzzyva', dict), true);
  assert.equal(rankOf('zyzzyva', ranks), null);
});

check('byCommonness sorts ranked ahead of unranked, keeping input order', () => {
  const ranks = makeRanks([
    ['the', 1],
    ['cat', 50],
    ['dog', 20],
  ]);
  assert.deepEqual(byCommonness(['zzz', 'cat', 'the', 'dog'], ranks), [
    'the',
    'dog',
    'cat',
    'zzz',
  ]);
});

check('isCommonEnough gates on the top percentile', () => {
  const ranks = makeRanks([
    ['a', 1],
    ['b', 2],
    ['c', 3],
    ['d', 4],
  ]);
  assert.equal(isCommonEnough('b', ranks, 0.5), true); // rank 2 <= 4*0.5
  assert.equal(isCommonEnough('c', ranks, 0.5), false); // rank 3 > 2
  assert.equal(isCommonEnough('zzz', ranks, 1), false); // unranked never passes
});

console.log(`\n${pass} passed`);
