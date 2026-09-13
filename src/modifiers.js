// Act-entry modifiers: on every act advance the run drafts one of two, and the
// pick is permanent, so act N is entered on a tradeoff rather than a free ride.
// Every effect lands on the run frame (rack, plays, targets, gold, curses) and
// none on score(), so a share payload still re-scores from words alone.
// Fields read by run.js: rack, plays, targetMult, bossTargetMult, clearGold,
// curseEachAct.

export const DRAFT_SIZE = 2;

export const MODIFIERS = {
  lean: {
    id: 'lean',
    label: 'rack -1, plays +1',
    rack: -1,
    plays: 1,
  },
  deep: {
    id: 'deep',
    label: 'rack +1, targets +15%',
    rack: 1,
    targetMult: 1.15,
  },
  tithe: {
    id: 'tithe',
    label: 'targets +10%, +2 gold per clear',
    targetMult: 1.1,
    clearGold: 2,
  },
  hexed: {
    id: 'hexed',
    label: 'a curse tile joins the bag each act, +3 gold per clear',
    curseEachAct: 1,
    clearGold: 3,
  },
  bulwark: {
    id: 'bulwark',
    label: 'boss targets -10%, other targets +10%',
    bossTargetMult: 0.9,
    targetMult: 1.1,
  },
  gauntlet: {
    id: 'gauntlet',
    label: 'plays -1, +4 gold per clear',
    plays: -1,
    clearGold: 4,
  },
};

const IDS = Object.keys(MODIFIERS);

// DRAFT_SIZE distinct ids the run does not own, off the run's seeded stream.
// Fewer when the pool is nearly spent; empty once every modifier is owned.
export function drawDraft(rng, ownedIds) {
  const open = IDS.filter((id) => !ownedIds.includes(id));
  const draft = [];
  while (draft.length < DRAFT_SIZE && open.length > 0) {
    draft.push(open.splice(Math.floor(rng() * open.length), 1)[0]);
  }
  return draft;
}

export function sumField(ids, field) {
  let total = 0;
  for (const id of ids) total += MODIFIERS[id][field] ?? 0;
  return total;
}

export function productField(ids, field) {
  let total = 1;
  for (const id of ids) total *= MODIFIERS[id][field] ?? 1;
  return total;
}
