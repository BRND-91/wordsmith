import { score, settlePlay } from './scoring.js';
import { isValid } from './dictionary.js';
import { VOWELS } from './letters.js';
import { mulberry32, shuffle } from './rng.js';
import { fillBag, addCurses, isCurse } from './bag.js';
import { createInventory, scoringRelics, econRelics, addRelic, relicList } from './inventory.js';
import { encounterReward, openShop, rollShop } from './shop.js';
import { fnv1a } from './hash.js';
import { drawDraft, sumField, productField } from './modifiers.js';
import { useConsumable } from './consumables.js';
import { ARCHETYPES } from './relics.js';

// Rack 9, not the length-8 minimum that first activates LEN_TIER2, but the
// smallest rack that makes that tier a real skill axis: two 10-point letters fit
// and the bare-steel ceiling reaches the ~50s (council verdict). Draw-to-full
// after each play, four plays to clear a round's target. Both are the base a
// drafted modifier shifts from; the live numbers are handSize / playsPerRound.
export const RACK_SIZE = 9;
export const PLAYS_PER_ROUND = 4;
export const ROUNDS_PER_ACT = 4; // rounds 1-3 are normal, round 4 is the boss
// The act's boss is revealed this many rounds before the boss round.
export const TELEGRAPH_LEAD = 2;

// A boss cleared by less than this margin over its target seeds a curse tile
// into the bag: a scrape-through costs the next act a rack slot.
export const NEAR_MISS_SCALE = 1.15;
export const NEAR_MISS_CURSES = 1;

// Act 1 round targets then boss; later acts scale by ACT_BREAK_SCALE. Tuned to
// the reliable-relic floor (longhand / vowelMult), leaving conditional xMult as
// a ceiling the player builds toward, never an assumption the curve requires.
// Score resets every round, so each target is a single-round number.
export const ACT1_TARGETS = [90, 120, 160];
export const ACT1_BOSS = 210;
const ACT_BREAK_SCALE = 1.7;

export function actTargets(act) {
  const factor = ACT_BREAK_SCALE ** (act - 1);
  return {
    rounds: ACT1_TARGETS.map((t) => Math.round(t * factor)),
    boss: Math.round(ACT1_BOSS * factor),
  };
}

function countVowels(word) {
  let v = 0;
  for (const ch of word) if (VOWELS.has(ch)) v++;
  return v;
}

function hasDoubleLetter(word) {
  for (let i = 1; i < word.length; i++) if (word[i] === word[i - 1]) return true;
  return false;
}

// The structural shape a build spams for a relic payout (bookend, palindrome,
// doubled letter). 'plain' words carry no such payout, so the anti-repeat boss
// never locks them; palindrome outranks bookend since every palindrome is one.
function wordShape(word) {
  if (word.length > 2 && word === [...word].reverse().join('')) return 'palindrome';
  if (word.length > 1 && word[0] === word[word.length - 1]) return 'bookend';
  if (hasDoubleLetter(word)) return 'doubled';
  return 'plain';
}

const SHAPE_LOCKS = new Set(['palindrome', 'bookend', 'doubled']);

// A boss rule may forbid a word (allows) and/or scale the round's target down to
// pay for the constraint (targetScale). A boss that only debuffs score, with no
// word restriction, must keep its scaled target at or above the act's round-3
// target, or a plain high word clears it for free; run.test.js asserts that. A
// boss that restricts the legal word set may scale below that floor, since the
// restriction itself carries the difficulty.
export const BOSS_RULES = {
  minLength: {
    id: 'minLength',
    minAct: 1,
    label: `words must be ${RACK_SIZE - 2}+ letters`,
    allows: (word) => word.length >= RACK_SIZE - 2,
  },
  noRepeatLong: {
    id: 'noRepeatLong',
    minAct: 1,
    label: 'no repeating a 6+ letter word',
    allows: (word, state) => word.length < 6 || !state.played.includes(word),
  },
  // VOWELS excludes y, so this permits y-words yet caps vowelMult at +1 for the
  // round; its telegraph must warn vowelMult holders specifically. One-vowel words
  // are scarce, so this scales below the round-3 floor: the restriction carries the
  // difficulty, and 0.5 is the scale that holds its boss-round death rate to parity
  // with the full-target bosses in the greedy smoke.
  maxOneVowel: {
    id: 'maxOneVowel',
    minAct: 1,
    label: 'at most one vowel per word (vowelMult capped at +1)',
    targetScale: 0.5,
    allows: (word) => countVowels(word) <= 1,
  },
  // Category debuff (Balatro The Eye/Plant pattern): a relic archetype scores
  // nothing this round, so an overspecialized stack faces real boss risk instead
  // of only a word-legality gate. zeroTag names the archetype the round nulls.
  // Debuff-only, so its scale sits at the round-3 floor (r3/boss is 0.762 in
  // every act, 0.77 clears it after rounding through act 8). The scale alone
  // only trims the greedy smoke's safe-lane death rate from 0.40 to 0.28; the
  // rest is the bot's vowelMult starter, which this boss exists to punish.
  vowelBlight: {
    id: 'vowelBlight',
    minAct: 4,
    label: 'vowel relics score nothing this round',
    zeroTag: ARCHETYPES.VOWEL,
    targetScale: 0.77,
    allows: () => true,
  },
  // Mult-cut (Balatro The Flint), asymmetric on purpose: it scales the final
  // mult only, never steel, so it taxes a mult/xMult stack while a steel build
  // barely feels it. A symmetric steel+mult cut would just duplicate targetScale.
  flint: {
    id: 'flint',
    minAct: 4,
    label: 'all mult is halved this round',
    multScale: 0.5,
    allows: () => true,
  },
  // Anti-repeat-shape (Balatro The Eye, no repeated hand type): noRepeatLong bars
  // the identical word; this bars a second word of the same structural shape in a
  // row, so a build that leans on one winning shape all round meets friction.
  noRepeatShape: {
    id: 'noRepeatShape',
    minAct: 4,
    label: 'no two words of the same shape in a row',
    allows: (word, state) => {
      const prev = state.played[state.played.length - 1];
      if (!prev) return true;
      const shape = wordShape(word);
      return !(SHAPE_LOCKS.has(shape) && shape === wordShape(prev));
    },
  },
};

// The act's one route decision, owed on clearing round 1. Elite banks a free
// seeded relic at the pick, plays the rest of the act under the boss rule,
// skips the round-2 shop, and on clearing round 3 opens the pre-boss shop; safe
// keeps the flat targets and both shops. The relic draw is
// seeded off seed:act, not the run stream, so the lane never moves the boss or
// draft draws and a seed meets the same bosses down either lane.
export const LANES = ['elite', 'safe'];
export const LANE_ROUND = 2;
// Elite's non-boss rounds pay for the rule w/ a lower target, on top of the
// rule's own scale; the greedy smoke lost 62 of 100 elite runs under
// maxOneVowel at flat targets.
export const ELITE_TARGET_SCALE = 0.75;

// Bosses unlock by act: an entry is eligible once act >= its minAct, so the
// pool grows as archetype-counter bosses come online in later acts.
export function eligibleBossIds(act, rules = BOSS_RULES) {
  return Object.keys(rules).filter((id) => act >= (rules[id].minAct ?? 1));
}

// One boss per act off the run's seeded stream, so a seed meets the same bosses
// in the same order. Drawn uniformly from the act's eligible pool.
function drawBoss(rng, act) {
  const ids = eligibleBossIds(act);
  return ids[Math.floor(rng() * ids.length)];
}

export function createRun(seed, { relics = [] } = {}) {
  const rng = mulberry32(seed);
  const bag = fillBag(rng);
  const rack = bag.splice(0, RACK_SIZE);
  return {
    seed, rng, bag, rack,
    act: 1, round: 1, plays: PLAYS_PER_ROUND,
    score: 0, played: [], inventory: createInventory(relics),
    gold: 0, tileBonus: {}, shop: null,
    boss: drawBoss(rng, 1), lost: null,
    modifiers: [], draft: null, consumables: [], armed: null,
    spent: [],
    lane: null, laneChoice: false, route: [],
  };
}

// Played and exchanged letters wait in the spent pile and rejoin the bag,
// reshuffled off the run's stream, when a round clears. The bag is 98 tiles
// against ~5 letters a play, so without the recycle it runs dry inside act 2;
// the balance smoke dead-ended every run there before this existed.
function recycleBag(state) {
  state.bag = shuffle([...state.bag, ...state.spent], state.rng);
  state.spent = [];
}

export function handSize(state) {
  return RACK_SIZE + sumField(state.modifiers, 'rack');
}

export function playsPerRound(state) {
  return PLAYS_PER_ROUND + sumField(state.modifiers, 'plays');
}

// Remove the word's letters from a copy of the rack; null when a letter is not
// held, so the rack is only mutated once the play is fully validated.
function takeFromRack(rack, word) {
  const pool = [...rack];
  for (const ch of word) {
    const i = pool.indexOf(ch);
    if (i < 0) return null;
    pool.splice(i, 1);
  }
  return pool;
}

function refill(state) {
  const size = handSize(state);
  while (state.rack.length < size && state.bag.length > 0) state.rack.push(state.bag.pop());
}

// The act's boss rule: live in the boss round, and from LANE_ROUND on down the
// elite lane.
export function activeBoss(state) {
  const elite = state.lane === 'elite' && state.round >= LANE_ROUND;
  return state.round >= ROUNDS_PER_ACT || elite ? BOSS_RULES[state.boss] : null;
}

// The boss label once the run is within TELEGRAPH_LEAD rounds of the boss round,
// null before that.
export function telegraph(state) {
  return state.round >= ROUNDS_PER_ACT - TELEGRAPH_LEAD ? BOSS_RULES[state.boss].label : null;
}

export function roundTarget(state) {
  const targets = actTargets(state.act);
  const boss = activeBoss(state);
  const isBoss = state.round >= ROUNDS_PER_ACT;
  const base = isBoss ? targets.boss : targets.rounds[state.round - 1];
  const bossScale = boss && boss.targetScale ? boss.targetScale : 1;
  const eliteScale = boss && !isBoss ? ELITE_TARGET_SCALE : 1;
  const modScale = productField(state.modifiers ?? [], isBoss ? 'bossTargetMult' : 'targetMult');
  return Math.round(base * bossScale * eliteScale * modScale);
}

// The hook context's run-side half: words already played and the escalating
// relics' slots. The UI hands this to resolveTimeline before playWord so the
// preview and the committed score read the same history.
export function playCtx(state) {
  return { played: state.played, relicState: state.inventory.state };
}

export function playWord(state, rawWord, dict) {
  const word = rawWord.toLowerCase();
  if (state.lost) return { ok: false, reason: 'run over' };
  if (state.draft) return { ok: false, reason: 'choose a modifier' };
  if (state.laneChoice) return { ok: false, reason: 'choose a lane' };
  if (state.plays <= 0) return { ok: false, reason: 'no plays left' };
  if (!isValid(word, dict)) return { ok: false, reason: 'not a word' };
  const remaining = takeFromRack(state.rack, word);
  if (remaining === null) return { ok: false, reason: 'letters not in rack' };
  const boss = activeBoss(state);
  // A word the boss rule forbids still plays: tiles leave, the play is spent,
  // nothing scores and no relic escalates. The alternative was a rack with no
  // legal word and no move but exchange, which reads as a soft lock.
  if (boss && !boss.allows(word, state)) {
    commitPlay(state, word, remaining, 0);
    return { ok: true, total: 0, blocked: boss.label, score: state.score, plays: state.plays };
  }
  const relics = scoringRelics(state.inventory);
  // A category-debuff boss drops its target archetype from the round: the hooks
  // never fire, so both the score and the escalation (settlePlay) skip them.
  const scoring = boss && boss.zeroTag ? relics.filter((r) => r.tag !== boss.zeroTag) : relics;
  const play = playCtx(state);
  const scored = score(word, scoring, state.tileBonus, play);
  settlePlay(word, scoring, play);
  // A mult-cut boss scales the final mult for the round; recompute from the parts
  // so the cut lands on mult alone and steel is untouched.
  const multScale = boss && boss.multScale ? boss.multScale : 1;
  const total = multScale === 1 ? scored.total : Math.round(scored.steel * scored.mult * multScale);
  commitPlay(state, word, remaining, total);
  return { ok: true, total, score: state.score, plays: state.plays };
}

function commitPlay(state, word, remaining, total) {
  state.rack = remaining;
  state.spent.push(...word);
  refill(state);
  state.played.push(word);
  if (state.armed === 'freeplay') state.armed = null;
  else state.plays -= 1;
  state.score += total;
}

// Draw-and-spent: the chosen rack indices leave for the price of one play and
// the rack refills. A exchanged letter goes to the spent pile; a exchanged
// curse leaves the run. Without this a rack with no legal word under
// a boss rule (minLength w/ no 7-letter word) has no action at all; the balance
// smoke found 154 of 200 greedy runs dead-ended there before it existed.
export function exchangeTiles(state, indices) {
  if (state.lost) return { ok: false, reason: 'run over' };
  if (state.plays <= 0) return { ok: false, reason: 'no plays left' };
  const picked = new Set(indices.filter((i) => i >= 0 && i < state.rack.length));
  if (picked.size === 0) return { ok: false, reason: 'pick tiles to exchange' };
  const kept = [];
  const returned = [];
  let cleared = 0;
  state.rack.forEach((t, i) => {
    if (!picked.has(i)) kept.push(t);
    else if (isCurse(t)) cleared++;
    else returned.push(t);
  });
  state.spent.push(...returned);
  state.rack = kept;
  state.plays -= 1;
  refill(state);
  return { ok: true, exchanged: picked.size, cleared, plays: state.plays };
}

// Every curse tile in the rack, cleared in one exchange. The other route is the
// shop's remove-tile service, which reaches only the copies still in the bag.
export function exchangeCurses(state) {
  const indices = [];
  state.rack.forEach((t, i) => { if (isCurse(t)) indices.push(i); });
  if (indices.length === 0) return { ok: false, reason: 'no curse in rack' };
  return exchangeTiles(state, indices);
}

// Spend a held consumable through the engine so an instant item's rack change
// refills to the run's rack size.
export function useItem(state, id, arg) {
  if (state.lost) return { ok: false, reason: 'run over' };
  const r = useConsumable(state, id, arg);
  if (r.ok) refill(state);
  return r;
}

// Draft pick at act entry. The rack and the fresh round's plays resize to the
// new frame at once: a shrunk rack returns its last tile to the bottom of the
// bag, a grown one draws.
export function pickModifier(state, id) {
  if (!state.draft || !state.draft.includes(id)) return { ok: false, reason: 'not in the draft' };
  state.modifiers.push(id);
  state.draft = null;
  const size = handSize(state);
  while (state.rack.length > size) state.bag.unshift(state.rack.pop());
  refill(state);
  state.plays = playsPerRound(state);
  return { ok: true, id };
}

// The lane pick lands the act's route entry. Safe opens the shop the round-1
// clear withheld; elite banks its relic here so it scores rounds 2-3 under the
// boss rule, where the balance smoke put most elite deaths, instead of landing
// after them.
export function pickLane(state, lane) {
  if (!state.laneChoice) return { ok: false, reason: 'no lane to choose' };
  if (!LANES.includes(lane)) return { ok: false, reason: 'not a lane' };
  state.lane = lane;
  state.laneChoice = false;
  state.route.push(lane);
  if (lane === 'safe') openShop(state);
  const relic = lane === 'elite' ? grantEliteRelic(state) : null;
  return { ok: true, lane, relic };
}

// The elite lane's payout: the top weighted draw of a shelf rolled off seed:act
// against current ownership, so the same seed down the same route banks the
// same relic. Null when the pool is spent.
function grantEliteRelic(state) {
  const owned = new Set(relicList(state.inventory).map((r) => r.id));
  const seed = parseInt(fnv1a(`${state.seed}:${state.act}:elite`), 16);
  const relic = rollShop(seed, owned).relics[0];
  if (!relic) return null;
  addRelic(state.inventory, relic);
  return relic.id;
}

// Settle the round after a play has been shown. Clearing the target pays the
// encounter reward and advances the round (score resets, plays refill). A
// round-1 clear opens the lane choice; a later non-boss clear opens the shop on
// the safe lane, and the elite lane's round-3 clear opens the one pre-boss shop
// the lane allows.
// Clearing the boss round advances the act, clears the lane, draws its boss,
// seeds a curse on a near miss, and opens the modifier draft; running out of
// plays under the target ends the run with the failing target and boss captured
// for the game-over screen.
export function endRound(state) {
  const target = roundTarget(state);
  const boss = activeBoss(state);
  if (state.score >= target) {
    const gold =
      encounterReward(state.score, target, econRelics(state.inventory)) +
      sumField(state.modifiers, 'clearGold');
    state.gold += gold;
    state.plays = playsPerRound(state);
    const cleared = state.score;
    state.score = 0;
    recycleBag(state);
    if (state.round >= ROUNDS_PER_ACT) {
      const cursed =
        (cleared < target * NEAR_MISS_SCALE ? NEAR_MISS_CURSES : 0) +
        sumField(state.modifiers, 'curseEachAct');
      addCurses(state.bag, cursed, state.rng);
      state.act += 1;
      state.round = 1;
      state.lane = null;
      state.boss = drawBoss(state.rng, state.act);
      state.draft = drawDraft(state.rng, state.modifiers);
      if (state.draft.length === 0) state.draft = null;
      return { outcome: 'act', gold, cursed, draft: state.draft };
    }
    state.round += 1;
    if (state.round === LANE_ROUND) {
      state.laneChoice = true;
      return { outcome: 'lane', gold };
    }
    if (state.lane === 'elite') {
      if (state.round === ROUNDS_PER_ACT) openShop(state);
      return { outcome: 'round', gold };
    }
    openShop(state);
    return { outcome: 'round', gold };
  }
  if (state.plays <= 0) {
    state.lost = {
      act: state.act, round: state.round, target, score: state.score,
      boss: boss ? boss.id : null, bossLabel: boss ? boss.label : null,
    };
    return { outcome: 'lost' };
  }
  return { outcome: 'continue' };
}
