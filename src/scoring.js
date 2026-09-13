import { VOWELS, lengthBonus, tileSum } from './letters.js';

// Scoring follows Balatro's steel-times-mult split: additive contributions build
// the steel base and the flat mult, then multiplicative relics (xMult) apply
// last, so compounding stays with the rarest effects. A relic hook is a pure
// function of its context returning any of { addSteel, addMult, xMult }.
//
// Hook context: { word, played, relics, self }. `played` is the run's words
// before this one, `relics` the scoring relics held, `self` the relic's own
// per-run slot. The hook only reads `self`; a relic that escalates declares an
// `onPlay(ctx)` that writes it, and run.js fires that once per committed play
// through settlePlay. Keeping mutation out of the hook is what lets the
// presenter's timeline call the same hooks without advancing the run.

export const RELICS = {
  vowelMult: {
    id: 'vowelMult',
    label: '+1 mult per vowel',
    hook: ({ word }) => {
      let v = 0;
      for (const ch of word) if (VOWELS.has(ch)) v++;
      return { addMult: v };
    },
  },
  bookend: {
    id: 'bookend',
    label: 'x2 if first letter = last letter',
    hook: ({ word }) =>
      word.length > 1 && word[0] === word[word.length - 1] ? { xMult: 2 } : {},
  },
  longhand: {
    id: 'longhand',
    label: '+20 steel on words of 7+ letters',
    hook: ({ word }) => (word.length >= 7 ? { addSteel: 20 } : {}),
  },
};

// A play context with no history: what a bare score() call or the first word of
// a replay sees.
export function freshPlay() {
  return { played: [], relicState: {} };
}

function slot(relicState, id) {
  return relicState[id] || (relicState[id] = {});
}

export function hookCtx(word, relics, play, relic) {
  return { word, played: play.played, relics, self: slot(play.relicState, relic.id) };
}

// tileBonus is the run's upgrade map (letter -> extra steel per copy played),
// bought in the shop; it lands in the steel base so mult relics scale it.
export function score(rawWord, relics = [], tileBonus = {}, play = freshPlay()) {
  const word = rawWord.toLowerCase();
  let steel = tileSum(word) + lengthBonus(word);
  for (const ch of word) steel += tileBonus[ch] ?? 0;
  let mult = 1;

  // Invoke each hook exactly once so a stateful (Balatro-style scaling) relic
  // counts a play a single time, then apply results in tiers: addSteel, then
  // addMult, then xMult last, keeping compounding with the rarest effects.
  const results = relics.map((relic) => relic.hook(hookCtx(word, relics, play, relic)));
  for (const r of results) if (r.addSteel) steel += r.addSteel;
  // A drawback relic can subtract past the word's own base; the floor keeps a
  // mult from turning that into a negative total.
  steel = Math.max(0, steel);
  for (const r of results) if (r.addMult) mult += r.addMult;
  for (const r of results) if (r.xMult) mult *= r.xMult;

  return { word, steel, mult, total: Math.round(steel * mult) };
}

// Advance every escalating relic's slot for a play that has been committed.
// Called once per accepted word, after score(), by run.js and the share replay.
export function settlePlay(rawWord, relics, play) {
  const word = rawWord.toLowerCase();
  for (const relic of relics) {
    if (relic.onPlay) relic.onPlay(hookCtx(word, relics, play, relic));
  }
}
