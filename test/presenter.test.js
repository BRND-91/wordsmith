import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadDictionary } from '../src/dictionary.js';
import { score } from '../src/scoring.js';
import { POOL } from '../src/relics.js';
import {
  createSelection,
  pickTile,
  pickLetter,
  unpickTile,
  selectedWord,
  canSubmit,
  resolveTimeline,
  timelineTotal,
  STEP,
} from '../src/presenter.js';

let pass = 0;
function check(name, fn) {
  fn();
  pass++;
  console.log(`ok - ${name}`);
}

const WORDS = fileURLToPath(new URL('../assets/words.txt', import.meta.url));
const dict = loadDictionary(WORDS);

check('tapping tiles builds the word by rack index, ignoring dupes and range', () => {
  let sel = createSelection(['c', 'a', 't', 'x']);
  sel = pickTile(sel, 0);
  sel = pickTile(sel, 1);
  sel = pickTile(sel, 2);
  assert.equal(selectedWord(sel), 'cat');
  sel = pickTile(sel, 0); // same tile again: no double-pick
  sel = pickTile(sel, 9); // out of range: ignored
  assert.equal(selectedWord(sel), 'cat');
});

check('tapping a word-strip letter removes it by position', () => {
  let sel = createSelection(['c', 'a', 't']);
  sel = pickTile(pickTile(pickTile(sel, 0), 1), 2);
  sel = unpickTile(sel, 1); // drop the 'a'
  assert.equal(selectedWord(sel), 'ct');
});

check('typing a letter picks the first free matching tile, skips curses, ignores misses', () => {
  let s = createSelection(['*', 'a', 'a', 't', 'c']);
  s = pickLetter(s, 'A');
  s = pickLetter(s, 'a');
  s = pickLetter(s, 'a'); // both a's used: no third pick
  s = pickLetter(s, 'z'); // not on the rack: ignored
  assert.deepEqual(s.picked, [1, 2]);
  s = pickLetter(s, '*'); // the curse glyph never types in
  assert.deepEqual(s.picked, [1, 2]);
  assert.equal(selectedWord(pickLetter(pickLetter(s, 'c'), 't')), 'aact');
});

check('submit gates live on validity, never on a non-word or empty', () => {
  assert.equal(canSubmit('planets', dict), true);
  assert.equal(canSubmit('zzzz', dict), false);
  assert.equal(canSubmit('', dict), false);
});

check('timeline total is the engine total by construction', () => {
  assert.equal(timelineTotal(resolveTimeline('planets')), score('planets').total);
  assert.equal(timelineTotal(resolveTimeline('cat', [POOL.ballast])), score('cat', [POOL.ballast]).total);
});

check('per-letter length run starts at the 5th letter and steps up at the 8th', () => {
  const seven = resolveTimeline('planets').filter((s) => s.kind === STEP.LENGTH);
  assert.equal(seven.length, 3); // letters 5,6,7 of a 7-letter word
  assert.ok(seven.every((s) => s.add === 5));
  const eight = resolveTimeline('aardvark').filter((s) => s.kind === STEP.LENGTH);
  assert.equal(eight.length, 4);
  assert.equal(eight[eight.length - 1].add, 10); // the 8th letter steps to LEN_STEP2
});

check('additive mult resolves before the xMult beat', () => {
  const steps = resolveTimeline('level', [POOL.vowelMult, POOL.mirror]);
  const lastAdd = steps.map((s) => s.kind).lastIndexOf(STEP.RELIC_MULT);
  const firstX = steps.map((s) => s.kind).indexOf(STEP.XMULT);
  assert.ok(lastAdd >= 0 && firstX >= 0 && lastAdd < firstX);
  assert.equal(timelineTotal(steps), score('level', [POOL.vowelMult, POOL.mirror]).total);
});

console.log(`\n${pass} passed`);
