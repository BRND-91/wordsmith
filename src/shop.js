import { mulberry32 } from './rng.js';
import { POOL, RARITY_WEIGHT } from './relics.js';
import { fnv1a } from './hash.js';
import { removeOne, addCurses } from './bag.js';
import { addRelic, removeRelic, econRelics, relicList } from './inventory.js';
import { CONSUMABLE_IDS, CONSUMABLE_SLOTS } from './consumables.js';

// Economy pays a flat bounty for clearing an encounter plus at most one capped
// overflow band — never raw overflow steel, which would pay the score exploit to
// fund itself. A band is one step of surplus above target, capped at OVERFLOW_BAND.
export const CLEAR_BOUNTY = 5;
export const OVERFLOW_STEP = 25;
export const OVERFLOW_BAND = 3;

export function overflowBands(score, target) {
  if (score < target) return 0;
  return Math.min(OVERFLOW_BAND, Math.floor((score - target) / OVERFLOW_STEP));
}

// A negative clearBonus (taxman) can take the bounty below zero; a clear never
// costs gold, it just pays nothing.
export function encounterReward(score, target, econRelics = []) {
  if (score < target) return 0;
  const bands = overflowBands(score, target);
  let gold = CLEAR_BOUNTY + bands;
  for (const r of econRelics) {
    if (r.econ.clearBonus) gold += r.econ.clearBonus;
    if (r.econ.overflowBonus) gold += r.econ.overflowBonus * bands;
  }
  return Math.max(0, gold);
}

// Reroll escalates within a single shop and resets between shops (the caller
// passes rerolls=0 on a fresh shop). Coupon-type relics discount it, floored at 0.
export const REROLL_BASE = 1;
export const REROLL_STEP = 1;

export function rerollCost(rerolls, econRelics = []) {
  let discount = 0;
  for (const r of econRelics) if (r.econ.rerollDiscount) discount += r.econ.rerollDiscount;
  return Math.max(0, REROLL_BASE + REROLL_STEP * rerolls - discount);
}

export const SHOP_SIZE = 3;

// One weighted pick: walk the cumulative rarity weight until the roll lands.
// The trailing index only catches float drift when the roll sits at the top edge.
function weightedIndex(items, rng) {
  const total = items.reduce((sum, r) => sum + RARITY_WEIGHT[r.rarity], 0);
  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= RARITY_WEIGHT[items[i].rarity];
    if (roll < 0) return i;
  }
  return items.length - 1;
}

// A seeded shop: relic offers are drawn without replacement, weighted by rarity,
// from the pool minus what the run already owns (uniqueness holds at the shelf
// too) and minus zero-weight tiers (legendary), plus the two tile services. Same
// seed and ownership yield the same shelf, so a daily's shop is reproducible.
// One consumable is drawn after the relics so its draw never shifts theirs.
export function rollShop(seed, ownedIds = new Set(), pool = POOL) {
  const rng = mulberry32(seed);
  const available = Object.values(pool).filter(
    (r) => !ownedIds.has(r.id) && RARITY_WEIGHT[r.rarity] > 0,
  );
  const relics = [];
  while (relics.length < SHOP_SIZE && available.length > 0) {
    relics.push(available.splice(weightedIndex(available, rng), 1)[0]);
  }
  return {
    relics,
    services: [{ type: 'remove-tile' }, { type: 'upgrade-tile' }],
    consumable: CONSUMABLE_IDS[Math.floor(rng() * CONSUMABLE_IDS.length)],
  };
}

// Prices sit against a 5-8 gold round clear: a common relic is under one round,
// a rare one about two, a tile service under one, so an act's three shops fund
// roughly two relics or one relic plus bag work. Sell-back returns half so a
// pivot costs but is not fatal. Legendary has a price only so sell-back and a
// future event can resolve one.
export const RELIC_PRICE = { common: 5, uncommon: 7, rare: 10, legendary: 15 };
export const REMOVE_PRICE = 3;
export const UPGRADE_PRICE = 4;
export const UPGRADE_STEP = 1; // extra steel per copy of the upgraded letter
export const SELL_RATE = 0.5;
export const CONSUMABLE_PRICE = 3;
// The cheap-relic tax: a common relic is the price of one round clear, so it
// also seeds a curse tile, and the tradeoff against an uncommon is real.
export const CHEAP_RELIC_TIER = 'common';
export const CHEAP_RELIC_CURSES = 1;

export function relicPrice(relic, econRelics = []) {
  let markup = 0;
  for (const r of econRelics) if (r.econ.priceMarkup) markup += r.econ.priceMarkup;
  return RELIC_PRICE[relic.rarity] + markup;
}

export function sellPrice(relic) {
  return Math.floor(RELIC_PRICE[relic.rarity] * SELL_RATE);
}

// The shelf seed folds run seed, encounter index, and reroll count through the
// hash so a daily replays every shelf and a reroll never repeats the last one.
function shopSeed(state, rerolls) {
  return parseInt(fnv1a(`${state.seed}:${state.act}:${state.round}:${rerolls}`), 16);
}

function ownedIds(state) {
  return new Set(relicList(state.inventory).map((r) => r.id));
}

export function openShop(state) {
  const rerolls = 0;
  const rolled = rollShop(shopSeed(state, rerolls), ownedIds(state));
  state.shop = {
    shelf: rolled.relics, services: rolled.services, consumable: rolled.consumable, rerolls,
  };
  return state.shop;
}

function spend(state, cost) {
  if (state.gold < cost) return { ok: false, reason: 'not enough gold' };
  state.gold -= cost;
  return { ok: true, cost };
}

export function rerollShop(state) {
  const cost = rerollCost(state.shop.rerolls, econRelics(state.inventory));
  const paid = spend(state, cost);
  if (!paid.ok) return paid;
  state.shop.rerolls += 1;
  const rolled = rollShop(shopSeed(state, state.shop.rerolls), ownedIds(state));
  state.shop.shelf = rolled.relics;
  state.shop.consumable = rolled.consumable;
  return paid;
}

export function buyRelic(state, relicId) {
  const i = state.shop.shelf.findIndex((r) => r.id === relicId);
  if (i < 0) return { ok: false, reason: 'not on shelf' };
  const relic = state.shop.shelf[i];
  if (state.inventory.byId.has(relic.id)) return { ok: false, reason: 'already owned' };
  const paid = spend(state, relicPrice(relic, econRelics(state.inventory)));
  if (!paid.ok) return paid;
  addRelic(state.inventory, relic);
  state.shop.shelf.splice(i, 1);
  const cursed = relic.rarity === CHEAP_RELIC_TIER ? CHEAP_RELIC_CURSES : 0;
  addCurses(state.bag, cursed, state.rng);
  return { ...paid, cursed };
}

export function buyConsumable(state) {
  const id = state.shop.consumable;
  if (!id) return { ok: false, reason: 'sold out' };
  if (state.consumables.length >= CONSUMABLE_SLOTS) return { ok: false, reason: 'no free slot' };
  const paid = spend(state, CONSUMABLE_PRICE);
  if (!paid.ok) return paid;
  state.consumables.push(id);
  state.shop.consumable = null;
  return { ...paid, id };
}

export function sellRelic(state, relicId) {
  const relic = state.inventory.byId.get(relicId);
  if (!relic) return { ok: false, reason: 'not owned' };
  removeRelic(state.inventory, relicId);
  const gold = sellPrice(relic);
  state.gold += gold;
  return { ok: true, gold };
}

// Bag thinning: one copy of the letter leaves the bag for the rest of the run.
// Only the bag is eligible, never the rack, so the current round's draw stands.
export function removeTile(state, letter) {
  if (!state.bag.includes(letter)) return { ok: false, reason: 'not in bag' };
  const paid = spend(state, REMOVE_PRICE);
  if (!paid.ok) return paid;
  removeOne(state.bag, letter);
  return paid;
}

// Upgrade is per letter, not per tile: every copy of the letter scores
// UPGRADE_STEP more steel for the rest of the run, so a common letter is the
// wide pick and a rare one the spike.
export function upgradeTile(state, letter) {
  if (!state.bag.includes(letter) && !state.rack.includes(letter)) {
    return { ok: false, reason: 'not in bag' };
  }
  const paid = spend(state, UPGRADE_PRICE);
  if (!paid.ok) return paid;
  state.tileBonus[letter] = (state.tileBonus[letter] ?? 0) + UPGRADE_STEP;
  return paid;
}

export function leaveShop(state) {
  state.shop = null;
}

// Ascension raises difficulty without adding any new multiplier source: it
// shrinks the bag, raises quotas, and raises upgrade prices. Tier 0 is a no-op.
export const ASCENSION = {
  tilesRemoved: (tier) => tier * 3,
  quotaScale: (tier) => 1 + tier * 0.1,
  priceScale: (tier) => 1 + tier * 0.15,
};
