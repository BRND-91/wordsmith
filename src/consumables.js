import { VOWELS } from './letters.js';
import { isCurse } from './bag.js';

// Single-use items held in a small slot inventory, bought in the shop. An
// instant one resolves on use; an armed one waits on the run and is spent by the
// next committed playWord, and only one can be armed at a time. None touch
// score(), so a share re-scores from words alone.
export const CONSUMABLE_SLOTS = 2;

// Draws pop from the end of the bag, so the front is the bottom of the pile.
function toBottom(bag, tiles) {
  bag.unshift(...tiles);
}

export const CONSUMABLES = {
  refresh: {
    id: 'refresh',
    label: 'exchange the rack and draw fresh',
    use(state) {
      const kept = state.rack.filter(isCurse);
      toBottom(state.bag, state.rack.filter((t) => !isCurse(t)));
      state.rack = kept;
      return { ok: true };
    },
  },
  vowel: {
    id: 'vowel',
    label: 'swap a tile for the next vowel in the bag',
    use(state, rackIndex) {
      if (rackIndex < 0 || rackIndex >= state.rack.length || isCurse(state.rack[rackIndex])) {
        return { ok: false, reason: 'pick a tile to swap' };
      }
      let i = state.bag.length - 1;
      while (i >= 0 && !VOWELS.has(state.bag[i])) i--;
      if (i < 0) return { ok: false, reason: 'no vowel left in the bag' };
      const [vowel] = state.bag.splice(i, 1);
      toBottom(state.bag, [state.rack[rackIndex]]);
      state.rack[rackIndex] = vowel;
      return { ok: true };
    },
  },
  freeplay: {
    id: 'freeplay',
    label: 'the next play costs no play',
    armed: true,
  },
};

export const CONSUMABLE_IDS = Object.keys(CONSUMABLES);

// Spend a held consumable. `arg` is the item's argument (a rack index for
// `vowel`). The caller refills the rack after an instant item; the engine owns
// refill so rack size stays a run.js decision.
export function useConsumable(state, id, arg) {
  const i = state.consumables.indexOf(id);
  if (i < 0) return { ok: false, reason: 'not held' };
  const item = CONSUMABLES[id];
  if (item.armed) {
    if (state.armed) return { ok: false, reason: `${state.armed} already armed` };
    state.armed = id;
  } else {
    const r = item.use(state, arg);
    if (!r.ok) return r;
  }
  state.consumables.splice(i, 1);
  return { ok: true, id };
}
