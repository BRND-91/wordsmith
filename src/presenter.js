import { TILE_VALUES } from './letters.js';
import { isValid } from './dictionary.js';
import { isCurse } from './bag.js';
import { score, hookCtx, freshPlay } from './scoring.js';

// The presenter is the headless view-model between the engine and the React
// Native tree: selection state, live submit gating, and the score-resolution
// timeline. Keeping it a pure module means the load-bearing UI logic — the
// first-minute submit gate and the animation ordering the design teaches through
// — is unit-testable without a renderer, which RN components are not.

// Selection is tap-to-select: a rack tile taps into the word by its rack index,
// and a word-strip letter taps back out by its position in the word. Indices,
// not letters, so a rack holding two of the same tile stays unambiguous.
export function createSelection(rack) {
  return { rack, picked: [] };
}

export function pickTile(sel, rackIndex) {
  if (rackIndex < 0 || rackIndex >= sel.rack.length) return sel;
  if (sel.picked.includes(rackIndex)) return sel;
  return { rack: sel.rack, picked: [...sel.picked, rackIndex] };
}

export function unpickTile(sel, wordPosition) {
  if (wordPosition < 0 || wordPosition >= sel.picked.length) return sel;
  const picked = sel.picked.slice();
  picked.splice(wordPosition, 1);
  return { rack: sel.rack, picked };
}

// Keyboard path: a typed letter picks the first unpicked rack tile holding it,
// so the same tile can never be played twice and a curse tile never types in.
export function pickLetter(sel, letter) {
  const want = letter.toLowerCase();
  const i = sel.rack.findIndex((tile, idx) => tile === want && !isCurse(tile) && !sel.picked.includes(idx));
  return i === -1 ? sel : pickTile(sel, i);
}

export function selectedWord(sel) {
  return sel.picked.map((i) => sel.rack[i]).join('');
}

// Live submit gate: the design's one first-minute fix is that a non-word can
// never reach a submit, so the button state is recomputed on every tap from a
// cheap Set lookup. A Set cannot prefix-hint, so this is validity only, not
// reachability of a longer word.
export function canSubmit(word, dict) {
  return word.length > 0 && isValid(word, dict);
}

export const STEP = {
  TILE: 'tile',
  LENGTH: 'length',
  RELIC_STEEL: 'relicSteel',
  RELIC_MULT: 'relicMult',
  XMULT: 'xmult',
  TOTAL: 'total',
};

// Length increment per letter mirrors letters.js lengthBonus: each letter from
// the 5th (index 4) adds LEN_STEP1, stepping to LEN_STEP2 at the 8th (index 7).
const LEN_STEP1 = 5;
const LEN_STEP2 = 10;
const LEN_FIRST_INDEX = 4;
const LEN_STEP2_INDEX = 7;

// The animation timeline as ordered data, driven by the real scoring math so the
// on-screen run and the engine's total are the same number by construction. The
// order is the taught relationship: per-letter steel run (tile value then its
// length increment), additive relic contributions (steel then mult), a distinct
// xMult beat last, then the total. One step per contribution, since the Stage-4
// single-invocation score() fires each hook once.
export function resolveTimeline(rawWord, relics = [], tileBonus = {}, play = freshPlay()) {
  const word = rawWord.toLowerCase();
  const steps = [];
  let steel = 0;
  let mult = 1;

  word.split('').forEach((letter, i) => {
    const value = (TILE_VALUES[letter] ?? 0) + (tileBonus[letter] ?? 0);
    steel += value;
    steps.push({ kind: STEP.TILE, letter, value, steel });
    if (i >= LEN_FIRST_INDEX) {
      const add = i >= LEN_STEP2_INDEX ? LEN_STEP2 : LEN_STEP1;
      steel += add;
      steps.push({ kind: STEP.LENGTH, letter, add, steel });
    }
  });

  const results = relics.map((relic) => ({
    id: relic.id,
    out: relic.hook(hookCtx(word, relics, play, relic)),
  }));
  for (const { id, out } of results) {
    if (out.addSteel) {
      steel += out.addSteel;
      steps.push({ kind: STEP.RELIC_STEEL, relicId: id, add: out.addSteel, steel });
    }
  }
  for (const { id, out } of results) {
    if (out.addMult) {
      mult += out.addMult;
      steps.push({ kind: STEP.RELIC_MULT, relicId: id, add: out.addMult, mult });
    }
  }
  for (const { id, out } of results) {
    if (out.xMult) {
      mult *= out.xMult;
      steps.push({ kind: STEP.XMULT, relicId: id, factor: out.xMult, mult });
    }
  }

  steps.push({ kind: STEP.TOTAL, steel, mult, total: Math.round(steel * mult) });
  return steps;
}

// The engine's total is the contract the timeline must land on; a caller can
// assert the last step matches score() rather than re-deriving it.
export function timelineTotal(steps) {
  const last = steps[steps.length - 1];
  return last && last.kind === STEP.TOTAL ? last.total : null;
}

export { score };
