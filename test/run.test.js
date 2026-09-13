import assert from 'node:assert/strict';
import { makeBag, DISTRIBUTION } from '../src/bag.js';
import { makeDictionary } from '../src/dictionary.js';
import { score } from '../src/scoring.js';
import { CURSE, countCurses } from '../src/bag.js';
import { POOL } from '../src/relics.js';
import { MODIFIERS, DRAFT_SIZE } from '../src/modifiers.js';
import { CONSUMABLE_SLOTS } from '../src/consumables.js';
import {
  openShop,
  leaveShop,
  buyRelic,
  buyConsumable,
  removeTile,
  REMOVE_PRICE,
  CONSUMABLE_PRICE,
  CHEAP_RELIC_CURSES,
} from '../src/shop.js';
import {
  createRun,
  playWord,
  endRound,
  actTargets,
  roundTarget,
  activeBoss,
  telegraph,
  exchangeCurses,
  exchangeTiles,
  pickModifier,
  useItem,
  pickLane,
  handSize,
  playsPerRound,
  BOSS_RULES,
  eligibleBossIds,
  LANES,
  LANE_ROUND,
  ELITE_TARGET_SCALE,
  RACK_SIZE,
  PLAYS_PER_ROUND,
  ROUNDS_PER_ACT,
  TELEGRAPH_LEAD,
  NEAR_MISS_SCALE,
  NEAR_MISS_CURSES,
} from '../src/run.js';

let pass = 0;
function check(name, fn) {
  fn();
  pass++;
  console.log(`ok - ${name}`);
}

// Force the current round to clear and settle it.
function clearRound(state) {
  state.score = roundTarget(state);
  return endRound(state);
}

check('bag holds 98 tiles with the Scrabble distribution', () => {
  const bag = makeBag();
  assert.equal(bag.length, 98);
  assert.equal(DISTRIBUTION.e, 12);
  assert.equal(bag.filter((t) => t === 'e').length, 12);
  assert.equal(bag.filter((t) => t === 'q').length, 1);
});

check('a run fills a full rack and the same seed replays identically', () => {
  const a = createRun(42);
  const b = createRun(42);
  assert.equal(a.rack.length, RACK_SIZE);
  assert.equal(a.bag.length, 98 - RACK_SIZE);
  assert.deepEqual(a.rack, b.rack);
  assert.equal(a.plays, PLAYS_PER_ROUND);
  assert.equal(a.lost, null);
});

check('a legal play scores, refills to full, and spends a play', () => {
  const dict = makeDictionary(['cats', 'cat', 'dog']);
  const state = createRun(1);
  state.rack = ['c', 'a', 't', 's', 'd', 'o', 'g', 'z', 'x'];
  const r = playWord(state, 'cats', dict);
  assert.equal(r.ok, true);
  assert.equal(r.total, score('cats').total);
  assert.equal(state.rack.length, RACK_SIZE); // drew back to full from the bag
  assert.equal(state.plays, PLAYS_PER_ROUND - 1);
  assert.equal(state.score, r.total);
});

check('a play using letters not in rack is rejected without mutating state', () => {
  const dict = makeDictionary(['dog']);
  const state = createRun(1);
  state.rack = ['c', 'a', 't', 's', 'd', 'o', 'b', 'z', 'x']; // no g
  const r = playWord(state, 'dog', dict);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'letters not in rack');
  assert.equal(state.plays, PLAYS_PER_ROUND);
});

check('a non-dictionary word is rejected before letters are checked', () => {
  const dict = makeDictionary(['cat']);
  const state = createRun(1);
  state.rack = ['z', 'z', 'z', 'a', 'b', 'c', 'd', 'e', 'f'];
  assert.equal(playWord(state, 'zzz', dict).reason, 'not a word');
});

check('the minLength boss zeroes short words and scores long ones', () => {
  const dict = makeDictionary(['cat', 'binaries']);
  const short = createRun(1);
  short.boss = 'minLength';
  short.round = ROUNDS_PER_ACT;
  short.rack = ['c', 'a', 't', 'x', 'x', 'x', 'x', 'x', 'x'];
  const playsBefore = short.plays;
  const r = playWord(short, 'cat', dict);
  assert.deepEqual([r.ok, r.total, r.blocked], [true, 0, BOSS_RULES.minLength.label]);
  assert.deepEqual([short.score, short.plays, short.rack.length], [0, playsBefore - 1, 9]);
  assert.ok(!short.rack.includes('c'));
  const long = createRun(1);
  long.boss = 'minLength';
  long.round = ROUNDS_PER_ACT;
  long.rack = ['b', 'i', 'n', 'a', 'r', 'i', 'e', 's', 'x'];
  assert.equal(playWord(long, 'binaries', dict).ok, true);
});

check('noRepeatLong blocks a repeated 6+ word but allows short repeats', () => {
  const boss = BOSS_RULES.noRepeatLong;
  const state = { played: ['planets', 'at'] };
  assert.equal(boss.allows('planets', state), false);
  assert.equal(boss.allows('at', state), true);
  assert.equal(boss.allows('quiz', state), true);
});

check('maxOneVowel gates on vowel count and discounts the target', () => {
  const boss = BOSS_RULES.maxOneVowel;
  assert.equal(boss.allows('crypt', {}), true); // zero vowels (y is a consonant)
  assert.equal(boss.allows('house', {}), false); // three vowels
  const state = { act: 1, round: ROUNDS_PER_ACT, boss: 'maxOneVowel' };
  assert.equal(roundTarget(state), Math.round(210 * 0.5));
});

check('a boss rule binds only in the boss round', () => {
  const dict = makeDictionary(['house']);
  const state = createRun(1);
  state.boss = 'maxOneVowel';
  state.rack = ['h', 'o', 'u', 's', 'e', 'x', 'x', 'x', 'x'];
  assert.equal(activeBoss(state), null);
  assert.equal(roundTarget(state), 90);
  assert.equal(playWord(state, 'house', dict).ok, true);
  state.round = ROUNDS_PER_ACT;
  state.rack = ['h', 'o', 'u', 's', 'e', 'x', 'x', 'x', 'x'];
  assert.equal(activeBoss(state).id, 'maxOneVowel');
  assert.equal(playWord(state, 'house', dict).total, 0);
});

check('every non-restricting boss target sits at or above the act round-3 target', () => {
  // Through act 8 so the minAct-4 bosses (vowelBlight, flint) are covered.
  for (let act = 1; act <= 8; act++) {
    for (const id of Object.keys(BOSS_RULES)) {
      if (id === 'maxOneVowel') continue; // restricts the word set, pays the floor with the constraint
      const target = roundTarget({ act, round: ROUNDS_PER_ACT, boss: id });
      assert.ok(target >= actTargets(act).rounds[2], `${id} act ${act}: ${target}`);
    }
  }
});

check('maxOneVowel scales below the round-3 floor, paid for by the word restriction', () => {
  for (let act = 1; act <= 3; act++) {
    const target = roundTarget({ act, round: ROUNDS_PER_ACT, boss: 'maxOneVowel' });
    assert.ok(target < actTargets(act).rounds[2], `maxOneVowel act ${act}: ${target}`);
  }
});

check('act targets scale at act breaks', () => {
  assert.deepEqual(actTargets(1).rounds, [90, 120, 160]);
  assert.equal(actTargets(1).boss, 210);
  assert.equal(actTargets(2).boss, Math.round(210 * 1.7));
});

check('clearing a round advances it and resets score and plays', () => {
  const state = createRun(3);
  state.plays = 1;
  state.round = 2;
  state.lane = 'safe';
  const r = clearRound(state);
  assert.equal(r.outcome, 'round');
  assert.equal(state.round, 3);
  assert.equal(state.score, 0);
  assert.equal(state.plays, PLAYS_PER_ROUND);
  assert.equal(state.act, 1);
  assert.ok(state.shop);
});

check('a round-1 clear opens the lane choice, which blocks play until a pick', () => {
  const dict = makeDictionary(['cat']);
  const state = createRun(3);
  const r = clearRound(state);
  assert.equal(r.outcome, 'lane');
  assert.equal(state.round, LANE_ROUND);
  assert.equal(state.laneChoice, true);
  assert.equal(state.shop, null);
  state.rack = ['c', 'a', 't', 'x', 'x', 'x', 'x', 'x', 'x'];
  assert.equal(playWord(state, 'cat', dict).reason, 'choose a lane');
  assert.equal(pickLane(state, 'scenic').reason, 'not a lane');
  assert.equal(pickLane(state, 'safe').ok, true);
  assert.equal(state.laneChoice, false);
  assert.deepEqual(state.route, ['safe']);
  assert.ok(state.shop); // safe opens the shop the round-1 clear withheld
  assert.equal(pickLane(state, 'safe').reason, 'no lane to choose');
  assert.equal(playWord(state, 'cat', dict).ok, true);
});

check('the elite lane pays its relic at the pick, runs the boss rule from LANE_ROUND, closes the mid-act shop, and opens the pre-boss shop', () => {
  const dict = makeDictionary(['cat', 'binaries']);
  const state = createRun(3);
  state.boss = 'minLength';
  clearRound(state);
  const relicsBefore = state.inventory.byId.size;
  const picked = pickLane(state, 'elite');
  assert.equal(picked.ok, true);
  assert.ok(picked.relic in POOL);
  assert.equal(state.inventory.byId.size, relicsBefore + 1);
  assert.equal(state.shop, null);
  assert.equal(activeBoss(state).id, 'minLength');
  assert.equal(roundTarget(state), Math.round(actTargets(1).rounds[1] * ELITE_TARGET_SCALE));
  state.rack = ['c', 'a', 't', 'x', 'x', 'x', 'x', 'x', 'x'];
  assert.equal(playWord(state, 'cat', dict).blocked, BOSS_RULES.minLength.label);
  let r = clearRound(state);
  assert.deepEqual([r.outcome, state.round, state.shop], ['round', 3, null]);
  r = clearRound(state);
  assert.equal(r.outcome, 'round');
  assert.equal(state.round, ROUNDS_PER_ACT);
  assert.equal(state.inventory.byId.size, relicsBefore + 1); // one relic per elite act
  assert.ok(state.shop); // the pre-boss shop stays open on elite
  leaveShop(state);
  r = clearRound(state);
  assert.equal(r.outcome, 'act');
  assert.equal(state.lane, null); // the lane ends w/ the act
  assert.equal(activeBoss(state), null);
});

check('the elite relic is seeded off seed and act, and a safe lane leaves the boss draws untouched', () => {
  const walk = (seed, lane) => {
    const state = createRun(seed);
    const relics = [];
    const bosses = [state.boss];
    for (let act = 1; act <= 3; act++) {
      clearRound(state);
      relics.push(pickLane(state, lane).relic);
      clearRound(state);
      clearRound(state);
      clearRound(state);
      bosses.push(state.boss);
      if (state.draft) pickModifier(state, state.draft[0]);
    }
    return { relics: relics.filter(Boolean), bosses, route: state.route };
  };
  const a = walk(21, 'elite');
  const b = walk(21, 'elite');
  assert.deepEqual(a.relics, b.relics);
  assert.equal(a.relics.length, 3);
  assert.equal(new Set(a.relics).size, 3);
  assert.deepEqual(a.route, ['elite', 'elite', 'elite']);
  const safe = walk(21, 'safe');
  assert.deepEqual(safe.relics, []);
  assert.deepEqual(safe.bosses, a.bosses);
  assert.notDeepEqual(walk(22, 'elite').relics, a.relics);
  for (const lane of LANES) assert.ok(['elite', 'safe'].includes(lane));
});

check('clearing the boss round advances the act and draws a new boss', () => {
  const state = createRun(3);
  state.round = ROUNDS_PER_ACT;
  const r = clearRound(state);
  assert.equal(r.outcome, 'act');
  assert.equal(state.act, 2);
  assert.equal(state.round, 1);
  assert.equal(state.score, 0);
  assert.ok(state.boss in BOSS_RULES);
  assert.equal(roundTarget(state), actTargets(2).rounds[0]);
});

check('a round under target with plays left continues', () => {
  const state = createRun(3);
  state.score = 10;
  state.plays = 2;
  assert.equal(endRound(state).outcome, 'continue');
  assert.equal(state.round, 1);
  assert.equal(state.lost, null);
});

check('running out of plays under the target loses the run w/ the failing target captured', () => {
  const dict = makeDictionary(['cat']);
  const state = createRun(3);
  state.boss = 'minLength';
  state.round = ROUNDS_PER_ACT;
  state.score = 10;
  state.plays = 0;
  assert.equal(endRound(state).outcome, 'lost');
  assert.deepEqual(state.lost, {
    act: 1, round: ROUNDS_PER_ACT, target: 210, score: 10,
    boss: 'minLength', bossLabel: BOSS_RULES.minLength.label,
  });
  state.plays = 1;
  state.rack = ['c', 'a', 't', 'x', 'x', 'x', 'x', 'x', 'x'];
  assert.equal(playWord(state, 'cat', dict).reason, 'run over');
});

check('boss roll is deterministic per seed across acts and varies by seed', () => {
  const draws = (seed) => {
    const state = createRun(seed);
    const ids = [state.boss];
    for (let act = 1; act <= 5; act++) {
      state.round = ROUNDS_PER_ACT;
      clearRound(state);
      ids.push(state.boss);
    }
    return ids;
  };
  assert.deepEqual(draws(11), draws(11));
  for (const id of draws(11)) assert.ok(id in BOSS_RULES);
  const seen = new Set();
  for (let seed = 1; seed <= 20; seed++) seen.add(draws(seed)[0]);
  assert.equal(seen.size, eligibleBossIds(1).length);
});

check('a boss is only eligible from its minAct onward', () => {
  const rules = {
    early: { id: 'early', minAct: 1 },
    late: { id: 'late', minAct: 4 },
  };
  assert.deepEqual(eligibleBossIds(1, rules), ['early']);
  assert.deepEqual(eligibleBossIds(3, rules), ['early']);
  assert.deepEqual(eligibleBossIds(4, rules), ['early', 'late']);
  // every shipped rule declares a minAct at or before act 1 today
  for (const id of Object.keys(BOSS_RULES)) {
    assert.ok(eligibleBossIds(BOSS_RULES[id].minAct).includes(id));
  }
});

check('a category-zero boss nulls its target archetype and spares the others', () => {
  const dict = makeDictionary(['audio']);
  const relics = [POOL.vowelMult, POOL.ballast];
  const rack = ['a', 'u', 'd', 'i', 'o', 'x', 'x', 'x', 'x'];

  const blighted = createRun(3, { relics });
  blighted.boss = 'vowelBlight';
  blighted.round = ROUNDS_PER_ACT;
  blighted.rack = [...rack];
  const under = playWord(blighted, 'audio', dict);

  const free = createRun(3, { relics });
  free.round = 1; // no boss active on a round-1 encounter
  free.rack = [...rack];
  const clear = playWord(free, 'audio', dict);

  assert.equal(under.total, score('audio', [POOL.ballast]).total);
  assert.equal(clear.total, score('audio', [POOL.vowelMult, POOL.ballast]).total);
  assert.ok(under.total < clear.total);
});

check('a mult-cut boss scales mult only and leaves steel whole', () => {
  const dict = makeDictionary(['audio']);
  const relics = [POOL.vowelMult, POOL.ballast];
  const state = createRun(3, { relics });
  state.boss = 'flint';
  state.round = ROUNDS_PER_ACT;
  state.rack = ['a', 'u', 'd', 'i', 'o', 'x', 'x', 'x', 'x'];
  const r = playWord(state, 'audio', dict);

  const full = score('audio', relics);
  const scale = BOSS_RULES.flint.multScale;
  assert.equal(r.total, Math.round(full.steel * full.mult * scale));
  assert.ok(r.total < full.total);
});

check('an anti-shape-repeat boss blocks a repeat shape and clears on a new one', () => {
  const dict = makeDictionary(['area', 'gong', 'cat']);
  const state = createRun(3);
  state.boss = 'noRepeatShape';
  state.round = ROUNDS_PER_ACT;

  state.rack = ['a', 'r', 'e', 'a', 'x', 'x', 'x', 'x', 'x'];
  assert.equal(playWord(state, 'area', dict).ok, true); // first bookend lands

  state.rack = ['g', 'o', 'n', 'g', 'x', 'x', 'x', 'x', 'x'];
  const blocked = playWord(state, 'gong', dict); // second bookend in a row
  assert.equal(blocked.total, 0);
  assert.equal(blocked.blocked, BOSS_RULES.noRepeatShape.label);

  state.rack = ['c', 'a', 't', 'x', 'x', 'x', 'x', 'x', 'x'];
  assert.equal(playWord(state, 'cat', dict).ok, true); // a plain shape clears
});

check('the boss is telegraphed TELEGRAPH_LEAD rounds ahead and not before', () => {
  const state = createRun(5);
  state.boss = 'noRepeatLong';
  for (let round = 1; round < ROUNDS_PER_ACT - TELEGRAPH_LEAD; round++) {
    state.round = round;
    assert.equal(telegraph(state), null);
  }
  state.round = ROUNDS_PER_ACT - TELEGRAPH_LEAD;
  assert.equal(telegraph(state), BOSS_RULES.noRepeatLong.label);
  state.round = ROUNDS_PER_ACT;
  assert.equal(telegraph(state), BOSS_RULES.noRepeatLong.label);
});

check('a boss cleared inside the near-miss margin seeds a curse, a clean clear does not', () => {
  const scrape = createRun(3);
  scrape.round = ROUNDS_PER_ACT;
  scrape.score = roundTarget(scrape);
  const r = endRound(scrape);
  assert.equal(r.outcome, 'act');
  assert.equal(r.cursed, NEAR_MISS_CURSES);
  assert.equal(countCurses(scrape.bag), NEAR_MISS_CURSES);
  const clean = createRun(3);
  clean.round = ROUNDS_PER_ACT;
  clean.score = Math.ceil(roundTarget(clean) * NEAR_MISS_SCALE);
  assert.equal(endRound(clean).cursed, 0);
  assert.equal(countCurses(clean.bag), 0);
});

check('a curse in rack plays as no word and exchangeCurses clears every copy for one play', () => {
  const dict = makeDictionary(['cat']);
  const state = createRun(1);
  state.rack = ['c', 'a', 't', CURSE, CURSE, 'x', 'x', 'x', 'x'];
  assert.equal(playWord(state, `cat${CURSE}`, dict).reason, 'not a word');
  assert.deepEqual(exchangeCurses(state), { ok: true, exchanged: 2, cleared: 2, plays: PLAYS_PER_ROUND - 1 });
  assert.equal(state.rack.length, RACK_SIZE);
  assert.equal(countCurses(state.rack), 0);
  assert.equal(exchangeCurses(state).reason, 'no curse in rack');
  state.rack[0] = CURSE;
  state.plays = 0;
  assert.equal(exchangeCurses(state).reason, 'no plays left');
});

check('exchangeTiles sends letters to the spent pile, drops curses, and costs a play', () => {
  const state = createRun(1);
  state.rack = ['q', CURSE, 'z', 'a', 'a', 'a', 'a', 'a', 'a'];
  const bagStart = state.bag.length;
  const r = exchangeTiles(state, [0, 1, 2, 99]);
  assert.deepEqual(r, { ok: true, exchanged: 3, cleared: 1, plays: PLAYS_PER_ROUND - 1 });
  assert.equal(state.rack.length, RACK_SIZE);
  assert.deepEqual(state.spent, ['q', 'z']);
  assert.equal(state.bag.length, bagStart - 3);
  assert.equal(exchangeTiles(state, []).reason, 'pick tiles to exchange');
});

check('a cleared round shuffles the spent pile back into the bag', () => {
  const state = createRun(1);
  state.spent = ['q', 'z'];
  const bagStart = state.bag.length;
  state.score = roundTarget(state);
  assert.equal(endRound(state).outcome, 'lane');
  assert.deepEqual(state.spent, []);
  assert.equal(state.bag.length, bagStart + 2);
});

check('the remove-tile service clears a curse still in the bag', () => {
  const state = createRun(1);
  state.bag.push(CURSE);
  state.gold = REMOVE_PRICE;
  assert.equal(removeTile(state, CURSE).ok, true);
  assert.equal(countCurses(state.bag), 0);
});

check('buying a common relic taxes a curse into the bag, an uncommon does not', () => {
  const state = createRun(1);
  state.round = 2;
  openShop(state);
  state.shop.shelf = [POOL.ballast, POOL.vowelMult];
  state.gold = 30;
  assert.equal(POOL.ballast.rarity, 'common');
  assert.equal(buyRelic(state, 'ballast').cursed, CHEAP_RELIC_CURSES);
  assert.equal(buyRelic(state, 'vowelMult').cursed, 0);
  assert.equal(countCurses(state.bag), CHEAP_RELIC_CURSES);
});

check('an act advance opens a draft that blocks play until a pick, and picks persist', () => {
  const dict = makeDictionary(['cat']);
  const state = createRun(7);
  state.round = ROUNDS_PER_ACT;
  state.score = roundTarget(state) * 2;
  const r = endRound(state);
  assert.equal(r.outcome, 'act');
  assert.equal(r.draft.length, DRAFT_SIZE);
  assert.equal(new Set(r.draft).size, DRAFT_SIZE);
  for (const id of r.draft) assert.ok(id in MODIFIERS);
  state.rack = ['c', 'a', 't', 'x', 'x', 'x', 'x', 'x', 'x'];
  assert.equal(playWord(state, 'cat', dict).reason, 'choose a modifier');
  assert.equal(pickModifier(state, 'nope').ok, false);
  const first = r.draft[0];
  assert.equal(pickModifier(state, first).ok, true);
  assert.equal(state.draft, null);
  assert.deepEqual(state.modifiers, [first]);
  assert.equal(playWord(state, 'cat', dict).ok, true);
  state.round = ROUNDS_PER_ACT;
  state.score = roundTarget(state) * 2;
  const next = endRound(state).draft;
  assert.ok(!next.includes(first));
  pickModifier(state, next[1]);
  assert.deepEqual(state.modifiers, [first, next[1]]);
  assert.equal(state.act, 3);
});

check('the draft is deterministic per seed', () => {
  const draft = (seed) => {
    const state = createRun(seed);
    state.round = ROUNDS_PER_ACT;
    state.score = roundTarget(state) * 2;
    return endRound(state).draft;
  };
  assert.deepEqual(draft(13), draft(13));
});

check('modifiers resize the rack and plays at pick and scale targets by round kind', () => {
  const state = createRun(2);
  state.boss = 'minLength';
  const bagStart = state.bag.length;
  state.draft = ['lean', 'deep'];
  assert.equal(pickModifier(state, 'lean').ok, true);
  assert.equal(handSize(state), RACK_SIZE - 1);
  assert.equal(state.rack.length, RACK_SIZE - 1);
  assert.equal(state.bag.length, bagStart + 1);
  assert.equal(playsPerRound(state), PLAYS_PER_ROUND + 1);
  assert.equal(state.plays, PLAYS_PER_ROUND + 1);
  state.draft = ['deep'];
  pickModifier(state, 'deep');
  assert.equal(state.rack.length, RACK_SIZE);
  assert.equal(roundTarget(state), Math.round(90 * 1.15));
  state.round = ROUNDS_PER_ACT;
  assert.equal(roundTarget(state), 210); // deep scales non-boss rounds only
  state.modifiers = ['bulwark'];
  assert.equal(roundTarget(state), Math.round(210 * 0.9));
  state.round = 1;
  assert.equal(roundTarget(state), Math.round(90 * 1.1));
});

check('a clear pays the modifiers gold bonus and hexed seeds a curse per act', () => {
  const state = createRun(4);
  state.modifiers = ['hexed'];
  state.round = ROUNDS_PER_ACT;
  state.score = roundTarget(state) * 2;
  const plain = createRun(4);
  plain.round = ROUNDS_PER_ACT;
  plain.score = roundTarget(plain) * 2;
  const r = endRound(state);
  assert.equal(r.gold, endRound(plain).gold + MODIFIERS.hexed.clearGold);
  assert.equal(r.cursed, 1);
  assert.equal(countCurses(state.bag), 1);
});

check('consumables buy into two slots and the shelf sells one per roll', () => {
  const state = createRun(9);
  state.round = 2;
  openShop(state);
  state.shop.consumable = 'freeplay';
  state.gold = CONSUMABLE_PRICE * 3;
  assert.equal(buyConsumable(state).id, 'freeplay');
  assert.equal(state.shop.consumable, null);
  assert.equal(buyConsumable(state).reason, 'sold out');
  state.shop.consumable = 'refresh';
  assert.equal(buyConsumable(state).ok, true);
  state.shop.consumable = 'vowel';
  assert.equal(buyConsumable(state).reason, 'no free slot');
  assert.equal(state.consumables.length, CONSUMABLE_SLOTS);
  assert.equal(state.gold, CONSUMABLE_PRICE);
});

check('freeplay arms once and only the next play is free', () => {
  const dict = makeDictionary(['cat', 'dog']);
  const state = createRun(9);
  state.consumables = ['freeplay'];
  assert.equal(useItem(state, 'freeplay').ok, true);
  assert.equal(state.armed, 'freeplay');
  assert.equal(useItem(state, 'freeplay').reason, 'not held');
  state.rack = ['c', 'a', 't', 'd', 'o', 'g', 'x', 'x', 'x'];
  assert.equal(playWord(state, 'cat', dict).plays, PLAYS_PER_ROUND);
  assert.equal(state.armed, null);
  state.rack = ['d', 'o', 'g', 'x', 'x', 'x', 'x', 'x', 'x'];
  assert.equal(playWord(state, 'dog', dict).plays, PLAYS_PER_ROUND - 1);
});

check('refresh sends the rack to the bag bottom and keeps a curse in place', () => {
  const state = createRun(9);
  state.consumables = ['refresh'];
  state.rack = ['a', 'b', 'c', CURSE, 'd', 'e', 'f', 'g', 'h'];
  const bagStart = state.bag.length;
  assert.equal(useItem(state, 'refresh').ok, true);
  assert.equal(state.rack.length, RACK_SIZE);
  assert.equal(state.rack[0], CURSE);
  assert.equal(state.bag.length, bagStart);
  assert.deepEqual(state.bag.slice(0, 8), ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  assert.deepEqual(state.consumables, []);
});

check('vowel swaps a chosen tile for the next vowel in the bag or refuses and stays held', () => {
  const state = createRun(9);
  state.consumables = ['vowel'];
  state.rack = ['q', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x'];
  state.bag = ['e', 'z', 'z'];
  assert.equal(useItem(state, 'vowel', 0).ok, true);
  assert.equal(state.rack[0], 'e');
  assert.deepEqual(state.bag, ['q', 'z', 'z']);
  state.consumables = ['vowel'];
  state.bag = ['z'];
  assert.equal(useItem(state, 'vowel', 1).reason, 'no vowel left in the bag');
  assert.deepEqual(state.consumables, ['vowel']);
  assert.equal(useItem(state, 'vowel', 99).reason, 'pick a tile to swap');
});

console.log(`\n${pass} passed`);
