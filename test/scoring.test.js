import assert from 'node:assert/strict';
import { score, RELICS } from '../src/scoring.js';
import { makeDictionary, isValid } from '../src/dictionary.js';

let pass = 0;
function check(name, fn) {
  fn();
  pass++;
  console.log(`ok - ${name}`);
}

check('bare word scores tile sum, no length bonus under 5', () => {
  const r = score('quiz');
  assert.equal(r.steel, 22); // q10 u1 i1 z10
  assert.equal(r.mult, 1);
  assert.equal(r.total, 22);
});

check('length bonus stacks past the 5th letter', () => {
  const r = score('planets'); // 7 letters, tiles=9, bonus=5+5+5
  assert.equal(r.steel, 24);
});

check('vowelMult adds one mult per vowel', () => {
  const r = score('planets', [RELICS.vowelMult]); // vowels a,e => mult 3
  assert.equal(r.mult, 3);
  assert.equal(r.total, 72);
});

check('bookend applies its xMult last, over additive mult', () => {
  const r = score('level', [RELICS.vowelMult, RELICS.bookend]); // l1e1v4e1l1=8, +5 length = 13; vowels e,e => mult (1+2)*2=6
  assert.equal(r.steel, 13);
  assert.equal(r.mult, 6);
  assert.equal(r.total, 78);
});

check('longhand fires only at 7+ letters', () => {
  assert.equal(score('planets', [RELICS.longhand]).steel, 44);
  assert.equal(score('quiz', [RELICS.longhand]).steel, 22);
});

check('two-letter words validate, slang absent from list stays invalid', () => {
  const dict = makeDictionary(['qi', 'za', 'planets', 'quiz']);
  assert.equal(isValid('qi', dict), true);
  assert.equal(isValid('a', dict), false); // below length floor
  assert.equal(isValid('yeet', dict), false); // not in list
});

console.log(`\n${pass} passed`);
