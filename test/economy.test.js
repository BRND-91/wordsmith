import assert from 'node:assert/strict';
import { makeDictionary } from '../src/dictionary.js';
import { score } from '../src/scoring.js';
import { countTiles } from '../src/bag.js';
import { POOL } from '../src/relics.js';
import { relicList, scoringRelics } from '../src/inventory.js';
import { createRun, playWord, endRound, roundTarget, pickLane, ROUNDS_PER_ACT } from '../src/run.js';
import {
  openShop,
  buyRelic,
  sellRelic,
  rerollShop,
  removeTile,
  upgradeTile,
  leaveShop,
  rerollCost,
  encounterReward,
  CLEAR_BOUNTY,
  relicPrice,
  REMOVE_PRICE,
  UPGRADE_PRICE,
  UPGRADE_STEP,
  SHOP_SIZE,
  sellPrice,
  CHEAP_RELIC_TIER,
  CHEAP_RELIC_CURSES,
} from '../src/shop.js';

let pass = 0;
function check(name, fn) {
  fn();
  pass++;
  console.log(`ok - ${name}`);
}

const STARTERS = [POOL.longhand, POOL.vowelMult, POOL.bookend];

// Force the current round to clear and settle it, taking the safe lane when the
// clear opens the act's route, so the shop these checks exercise is open.
function clearRound(state) {
  state.score = roundTarget(state);
  const r = endRound(state);
  if (state.laneChoice) pickLane(state, 'safe');
  return r;
}

check('a run starts broke w/ an inventory, no upgrades, and no shop', () => {
  const state = createRun(3, { relics: STARTERS });
  assert.equal(state.gold, 0);
  assert.equal(state.shop, null);
  assert.deepEqual(state.tileBonus, {});
  assert.deepEqual(relicList(state.inventory).map((r) => r.id), ['longhand', 'vowelMult', 'bookend']);
});

check('a non-boss clear pays the reward and the safe lane opens a shop for the next round', () => {
  const state = createRun(3, { relics: STARTERS });
  state.score = roundTarget(state);
  const r = endRound(state);
  assert.equal(r.outcome, 'lane');
  assert.equal(r.gold, CLEAR_BOUNTY);
  assert.equal(state.gold, CLEAR_BOUNTY);
  assert.equal(state.round, 2);
  assert.equal(state.shop, null);
  pickLane(state, 'safe');
  assert.ok(state.shop);
  assert.equal(state.shop.shelf.length, SHOP_SIZE);
  assert.equal(state.shop.rerolls, 0);
  assert.deepEqual(state.shop.services.map((s) => s.type), ['remove-tile', 'upgrade-tile']);
  assert.ok(!state.shop.shelf.some((x) => x.id === 'longhand')); // owned excluded
});

check('overflow and econ relics raise the reward; a boss clear pays but opens no shop', () => {
  const state = createRun(3, { relics: [POOL.merchant] });
  state.round = ROUNDS_PER_ACT;
  state.score = roundTarget(state) + 60; // two overflow bands
  const r = endRound(state);
  assert.equal(r.outcome, 'act');
  assert.equal(r.gold, encounterReward(160, 100, [POOL.merchant]));
  assert.equal(r.gold, CLEAR_BOUNTY + 2 + 2); // two bands plus merchant's +2
  assert.equal(state.shop, null);
});

check('the shelf is a function of seed and round, and differs by round', () => {
  const ids = (state) => state.shop.shelf.map((r) => r.id);
  const a = createRun(9, { relics: STARTERS });
  const b = createRun(9, { relics: STARTERS });
  clearRound(a);
  clearRound(b);
  assert.deepEqual(ids(a), ids(b));
  const first = ids(a);
  leaveShop(a);
  clearRound(a);
  assert.equal(a.round, 3);
  assert.notDeepEqual(ids(a), first);
});

check('buying a relic spends gold, adds to inventory once, and clears the shelf slot', () => {
  const state = createRun(3, { relics: STARTERS });
  clearRound(state);
  const pick = state.shop.shelf[0];
  const price = relicPrice(pick);
  state.gold = price;
  assert.equal(buyRelic(state, pick.id).ok, true);
  assert.equal(state.gold, 0);
  assert.ok(state.inventory.byId.has(pick.id));
  assert.equal(state.shop.shelf.length, SHOP_SIZE - 1);
  assert.equal(buyRelic(state, pick.id).reason, 'not on shelf');
  state.gold = price;
  state.shop.shelf.push(pick); // a shelf that re-offers an owned relic is still refused
  assert.equal(buyRelic(state, pick.id).reason, 'already owned');
  assert.equal(state.gold, price);
});

check('a purchase over budget is refused without touching gold or inventory', () => {
  const state = createRun(3, { relics: STARTERS });
  clearRound(state);
  const pick = state.shop.shelf[0];
  state.gold = relicPrice(pick) - 1;
  const before = relicList(state.inventory).length;
  const r = buyRelic(state, pick.id);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'not enough gold');
  assert.equal(state.gold, relicPrice(pick) - 1);
  assert.equal(relicList(state.inventory).length, before);
});

check('reroll escalates in cost, changes the shelf, and replays per seed', () => {
  const roll = () => {
    const state = createRun(5, { relics: STARTERS });
    clearRound(state);
    state.gold = 10;
    const first = state.shop.shelf.map((r) => r.id);
    assert.equal(rerollShop(state).cost, rerollCost(0));
    const second = state.shop.shelf.map((r) => r.id);
    assert.notDeepEqual(second, first);
    assert.equal(rerollShop(state).cost, rerollCost(1));
    assert.equal(state.gold, 10 - rerollCost(0) - rerollCost(1));
    assert.equal(state.shop.rerolls, 2);
    return state.shop.shelf.map((r) => r.id);
  };
  assert.deepEqual(roll(), roll());
});

check('a fresh shop resets the reroll ladder and a coupon discounts it', () => {
  const state = createRun(5, { relics: [POOL.coupon] });
  clearRound(state);
  state.gold = 10;
  assert.equal(rerollShop(state).cost, rerollCost(0, [POOL.coupon]));
  assert.equal(rerollShop(state).cost, rerollCost(1, [POOL.coupon]));
  leaveShop(state);
  clearRound(state);
  assert.equal(state.shop.rerolls, 0);
});

check('remove-tile thins the bag by one copy and charges REMOVE_PRICE', () => {
  const state = createRun(3, { relics: STARTERS });
  clearRound(state);
  state.gold = REMOVE_PRICE;
  const before = countTiles(state.bag).find((t) => t.letter === 'e').count;
  const bagSize = state.bag.length;
  assert.equal(removeTile(state, 'e').ok, true);
  assert.equal(state.bag.length, bagSize - 1);
  assert.equal(countTiles(state.bag).find((t) => t.letter === 'e').count, before - 1);
  assert.equal(state.gold, 0);
  assert.equal(removeTile(state, 'e').reason, 'not enough gold');
  state.gold = REMOVE_PRICE;
  state.bag = state.bag.filter((t) => t !== 'q');
  assert.equal(removeTile(state, 'q').reason, 'not in bag');
  assert.equal(state.gold, REMOVE_PRICE);
});

check('upgrade-tile raises every play of that letter by UPGRADE_STEP steel', () => {
  const dict = makeDictionary(['seas']);
  const state = createRun(3, { relics: [] });
  clearRound(state);
  state.gold = UPGRADE_PRICE * 2;
  assert.equal(upgradeTile(state, 's').ok, true);
  assert.equal(upgradeTile(state, 's').ok, true);
  assert.equal(state.gold, 0);
  assert.deepEqual(state.tileBonus, { s: UPGRADE_STEP * 2 });
  leaveShop(state);
  state.rack = ['s', 'e', 'a', 's', 'x', 'x', 'x', 'x', 'x'];
  const r = playWord(state, 'seas', dict);
  assert.equal(r.total, score('seas').total + 2 * UPGRADE_STEP * 2); // two s tiles
  assert.equal(r.total, score('seas', scoringRelics(state.inventory), state.tileBonus).total);
});

check('sell-back returns partial gold and drops the relic from scoring', () => {
  const state = createRun(3, { relics: STARTERS });
  clearRound(state);
  const gold = state.gold;
  const r = sellRelic(state, 'vowelMult');
  assert.equal(r.ok, true);
  assert.equal(r.gold, sellPrice(POOL.vowelMult));
  assert.ok(sellPrice(POOL.vowelMult) < relicPrice(POOL.vowelMult));
  assert.equal(state.gold, gold + sellPrice(POOL.vowelMult));
  assert.ok(!state.inventory.byId.has('vowelMult'));
  assert.equal(sellRelic(state, 'vowelMult').reason, 'not owned');
});

check('a seeded run plays clear, buy, reroll, remove w/ the asserted bag and gold deltas', () => {
  const state = createRun(21, { relics: STARTERS });
  const bagStart = state.bag.length;
  state.score = roundTarget(state) + 25; // one overflow band
  assert.equal(endRound(state).outcome, 'lane');
  pickLane(state, 'safe');
  assert.equal(state.gold, CLEAR_BOUNTY + 1);
  const bought = state.shop.shelf[1];
  state.gold += relicPrice(bought) + REMOVE_PRICE; // top up so every action fits
  const goldStart = state.gold;
  const buy = buyRelic(state, bought.id);
  assert.equal(buy.ok, true);
  assert.equal(buy.cursed, bought.rarity === CHEAP_RELIC_TIER ? CHEAP_RELIC_CURSES : 0);
  assert.equal(rerollShop(state).ok, true);
  assert.ok(!state.shop.shelf.some((r) => r.id === bought.id));
  assert.equal(removeTile(state, state.bag[0]).ok, true);
  leaveShop(state);
  assert.equal(state.shop, null);
  assert.equal(state.bag.length, bagStart - 1 + buy.cursed);
  assert.equal(state.gold, goldStart - relicPrice(bought) - rerollCost(0) - REMOVE_PRICE);
  assert.equal(relicList(state.inventory).length, STARTERS.length + 1);
  // the shop opened by openShop directly matches what endRound opened
  const twin = createRun(21, { relics: STARTERS });
  twin.round = 2;
  assert.deepEqual(openShop(twin).shelf.map((r) => r.id), (() => {
    const again = createRun(21, { relics: STARTERS });
    clearRound(again);
    return again.shop.shelf.map((r) => r.id);
  })());
});

console.log(`\n${pass} passed`);
