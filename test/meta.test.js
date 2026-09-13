import assert from 'node:assert/strict';
import { score, settlePlay, hookCtx, freshPlay, RELICS } from '../src/scoring.js';
import { POOL, ARCHETYPES } from '../src/relics.js';
import {
  createInventory,
  addRelic,
  scoringRelics,
  econRelics,
  relicList,
} from '../src/inventory.js';
import {
  encounterReward,
  overflowBands,
  rerollCost,
  rollShop,
  ASCENSION,
  CLEAR_BOUNTY,
  OVERFLOW_BAND,
  SHOP_SIZE,
} from '../src/shop.js';

let pass = 0;
function check(name, fn) {
  fn();
  pass++;
  console.log(`ok - ${name}`);
}

check('score invokes each relic hook exactly once', () => {
  let calls = 0;
  const spy = { id: 'spy', hook: () => { calls++; return { addMult: 1 }; } };
  score('planets', [spy]);
  assert.equal(calls, 1); // the old two-loop engine fired hooks twice
});

check('score math is unchanged for pure relics after the refactor', () => {
  const r = score('planets', [RELICS.vowelMult]);
  assert.equal(r.mult, 3);
  assert.equal(r.total, 72);
});

check('inventory refuses a duplicate relic by id', () => {
  const inv = createInventory();
  assert.equal(addRelic(inv, POOL.vowelMult).ok, true);
  assert.equal(addRelic(inv, POOL.vowelMult).ok, false);
  assert.equal(relicList(inv).length, 1); // no five-copy vowelMult stack
});

check('scoringRelics excludes economy relics, econRelics keeps them', () => {
  const inv = createInventory([POOL.ballast, POOL.merchant]);
  assert.deepEqual(scoringRelics(inv).map((r) => r.id), ['ballast']);
  assert.deepEqual(econRelics(inv).map((r) => r.id), ['merchant']);
});

check('encounter reward is bounty plus a capped overflow band, zero on a loss', () => {
  assert.equal(encounterReward(50, 100), 0); // under target
  assert.equal(encounterReward(100, 100), CLEAR_BOUNTY); // exact, no overflow
  assert.equal(overflowBands(1000, 100), OVERFLOW_BAND); // band caps
  assert.equal(encounterReward(1000, 100), CLEAR_BOUNTY + OVERFLOW_BAND);
});

check('economy relics adjust reward and reroll cost', () => {
  assert.equal(encounterReward(100, 100, [POOL.merchant]), CLEAR_BOUNTY + 2);
  assert.equal(rerollCost(0), 1);
  assert.equal(rerollCost(2), 3); // escalates within a shop
  assert.equal(rerollCost(2, [POOL.coupon]), 2); // discounted, floored at 0
});

check('shop is seeded, excludes owned relics, and caps its shelf', () => {
  const owned = new Set(['ballast']);
  const a = rollShop(7, owned);
  const b = rollShop(7, owned);
  assert.deepEqual(a.relics.map((r) => r.id), b.relics.map((r) => r.id));
  assert.ok(a.relics.length <= SHOP_SIZE);
  assert.ok(!a.relics.some((r) => r.id === 'ballast'));
  assert.deepEqual(a.services.map((s) => s.type), ['remove-tile', 'upgrade-tile']);
});

check('every mult relic gates on a property other than word length', () => {
  const shortNoRepeat = 'quartz'; // 6 letters, no repeat, has a rare tile, 1 vowel
  const longRepeat = 'letters'; // 7 letters, repeats, common
  for (const relic of Object.values(POOL)) {
    if (typeof relic.hook !== 'function') continue;
    const grantsMult = (w) => {
      const r = relic.hook(hookCtx(w, [relic], freshPlay(), relic));
      return Boolean(r.addMult || r.xMult);
    };
    // A pure length gate would grant on the longer word and deny the shorter;
    // no mult relic in the pool does that.
    if (grantsMult(shortNoRepeat)) continue;
    assert.equal(
      grantsMult(longRepeat) && !grantsMult(shortNoRepeat),
      false,
      `${relic.id} appears to gate mult on length`,
    );
  }
});

check('ascension raises difficulty without a new multiplier source', () => {
  assert.equal(ASCENSION.tilesRemoved(0), 0);
  assert.ok(ASCENSION.tilesRemoved(2) > 0);
  assert.ok(ASCENSION.quotaScale(3) > ASCENSION.quotaScale(1));
  assert.ok(ASCENSION.priceScale(3) > 1);
});

check('the pool spans all five archetypes', () => {
  const tags = new Set(Object.values(POOL).map((r) => r.tag));
  for (const tag of Object.values(ARCHETYPES)) assert.ok(tags.has(tag), `missing ${tag}`);
});

check('the pool holds 49 relics split to the council ratios', () => {
  const relics = Object.values(POOL);
  assert.equal(relics.length, 49);
  // Gated relics return {} when their gate misses, so classify by sweeping probes
  // that between them trip every gate: rare-tile/vowel-heavy, vowel-starved,
  // exactly-two-vowel, and a palindrome. The probes replay in order through one
  // play context so an escalating relic has a count by the second probe. A
  // relic that never returns mult on any probe is an additive-steel relic; a
  // relic with a hook and an econ block classifies by its hook.
  const probes = ['aeiouqzjx', 'gym', 'beat', 'aba'];
  const kind = (r) => {
    if (!r.hook) return 'econ';
    const play = freshPlay();
    const outs = probes.map((w) => {
      const out = r.hook(hookCtx(w, [r], play, r));
      settlePlay(w, [r], play);
      play.played.push(w);
      return out;
    });
    if (outs.some((o) => o.xMult)) return 'xMult';
    if (outs.some((o) => o.addMult)) return 'addMult';
    return 'steel';
  };
  const counts = relics.reduce((m, r) => ((m[kind(r)] = (m[kind(r)] || 0) + 1), m), {});
  // ~55/20/10/15 of 49: steel 26, addMult 10, xMult 6, econ 7.
  assert.deepEqual(counts, { steel: 26, addMult: 10, xMult: 6, econ: 7 });
});

check('every econ field a relic declares is one the shop layer reads', () => {
  const consumed = new Set(['clearBonus', 'overflowBonus', 'rerollDiscount', 'priceMarkup']);
  for (const r of Object.values(POOL)) {
    if (!r.econ) continue;
    for (const key of Object.keys(r.econ)) assert.ok(consumed.has(key), `dead econ key ${key}`);
  }
});

console.log(`\n${pass} passed`);
