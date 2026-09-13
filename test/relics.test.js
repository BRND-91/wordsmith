import assert from 'node:assert/strict';
import { score, settlePlay, hookCtx, freshPlay } from '../src/scoring.js';
import { POOL, ARCHETYPES, RARITY, RARITY_WEIGHT, poolByRarity } from '../src/relics.js';
import { createInventory, scoringRelics, relicList } from '../src/inventory.js';
import { makeDictionary } from '../src/dictionary.js';
import { createRun, playWord, playCtx } from '../src/run.js';
import { resolveTimeline, timelineTotal } from '../src/presenter.js';
import { rollShop, relicPrice, sellPrice, encounterReward, CLEAR_BOUNTY, SELL_RATE, RELIC_PRICE } from '../src/shop.js';
import { encodeSave, decodeSave } from '../src/save.js';
import { buildSharePayload, encodeShare, verifyShare } from '../src/share.js';

let pass = 0;
function check(name, fn) {
  fn();
  pass++;
  console.log(`ok - ${name}`);
}

const HOOKED = Object.values(POOL).filter((r) => r.hook);
const OUTPUT_KEYS = new Set(['addSteel', 'addMult', 'xMult']);
// Between them the fixture words trip every gate in the pool: a 9-letter
// rare-tile word, a palindrome, a vowel-starved word, a two-vowel word, a
// doubled letter, a word starting with a vowel, and a repeated word.
const FIXTURE = ['aeiouqzjx', 'level', 'gym', 'beat', 'letters', 'quartz', 'gym'];

check('every pool entry carries a matching id, a known tag, and a known rarity', () => {
  const tags = new Set(Object.values(ARCHETYPES));
  const tiers = new Set(Object.values(RARITY));
  for (const [key, r] of Object.entries(POOL)) {
    assert.equal(r.id, key);
    assert.ok(tags.has(r.tag), `${key} tag`);
    assert.ok(tiers.has(r.rarity), `${key} rarity`);
    assert.ok(r.hook || r.econ, `${key} does nothing`);
  }
});

check('rarity split: 16 common, 20 uncommon, 12 rare, 1 legendary', () => {
  const n = (t) => poolByRarity(t).length;
  assert.deepEqual(
    [n(RARITY.COMMON), n(RARITY.UNCOMMON), n(RARITY.RARE), n(RARITY.LEGENDARY)],
    [16, 20, 12, 1],
  );
  assert.equal(RARITY_WEIGHT[RARITY.LEGENDARY], 0);
});

check('the shelf is weighted by rarity and never offers a legendary', () => {
  const seen = { common: 0, uncommon: 0, rare: 0, legendary: 0 };
  for (let seed = 1; seed <= 2000; seed++) {
    const { relics } = rollShop(seed);
    assert.equal(new Set(relics.map((r) => r.id)).size, relics.length, 'duplicate on shelf');
    for (const r of relics) seen[r.rarity]++;
  }
  assert.equal(seen.legendary, 0);
  assert.ok(seen.common > seen.uncommon && seen.uncommon > seen.rare, JSON.stringify(seen));
  // Per-pick odds sit near the weights: common 60% of 6000 picks is 3600, the
  // 5% band catches a draw that ignored the weights (uniform would be ~33%).
  assert.ok(Math.abs(seen.common / 6000 - 0.6) < 0.05, `common ${seen.common}`);
  assert.ok(Math.abs(seen.rare / 6000 - 0.1) < 0.05, `rare ${seen.rare}`);
});

check('every hook runs the fixture with finite numbers, engine-read keys, and steel at or above zero', () => {
  for (const relic of HOOKED) {
    const inv = createInventory([relic]);
    const play = { played: [], relicState: inv.state };
    for (const word of FIXTURE) {
      const out = relic.hook(hookCtx(word, [relic], play, relic));
      for (const [k, v] of Object.entries(out)) {
        assert.ok(OUTPUT_KEYS.has(k), `${relic.id} emits unread key ${k}`);
        assert.ok(Number.isFinite(v), `${relic.id}.${k} on ${word} is ${v}`);
      }
      const s = score(word, [relic], {}, play);
      assert.ok(Number.isInteger(s.total) && s.total >= 0, `${relic.id} on ${word}: ${s.total}`);
      assert.ok(s.steel >= 0);
      settlePlay(word, [relic], play);
      play.played.push(word);
    }
    // A relic's slot must survive a save: plain JSON, no functions or Sets.
    assert.deepEqual(JSON.parse(JSON.stringify(inv.state)), inv.state);
  }
});

check('every escalating relic changes its output somewhere across the fixture', () => {
  for (const relic of HOOKED.filter((r) => r.onPlay)) {
    const play = freshPlay();
    const outs = FIXTURE.map((word) => {
      const out = JSON.stringify(relic.hook(hookCtx(word, [relic], play, relic)));
      settlePlay(word, [relic], play);
      play.played.push(word);
      return out;
    });
    assert.ok(new Set(outs).size > 1, `${relic.id} never escalates`);
  }
});

check('a drawback relic floors steel at zero rather than scoring negative', () => {
  const short = score('at', [POOL.glasscannon]);
  assert.equal(short.steel, 0);
  assert.equal(short.total, 0);
  assert.equal(score('cat', [POOL.anchor]).steel, score('cat').steel + 25);
  assert.equal(score('planets', [POOL.anchor]).steel, score('planets').steel - 10);
});

check('hermit reads the relic list: +4 alone, nothing beside another scoring relic', () => {
  assert.deepEqual(POOL.hermit.hook(hookCtx('cat', [POOL.hermit], freshPlay(), POOL.hermit)), { addMult: 4 });
  const pair = [POOL.hermit, POOL.ballast];
  assert.deepEqual(POOL.hermit.hook(hookCtx('cat', pair, freshPlay(), POOL.hermit)), {});
  const econOnly = createInventory([POOL.hermit, POOL.merchant]);
  assert.equal(score('cat', scoringRelics(econOnly)).mult, 5); // merchant has no hook
});

check('whetstone escalates on committed plays only, and the preview matches the commit', () => {
  const dict = makeDictionary(['planets', 'quartz', 'cat']);
  const run = createRun(11, { relics: [POOL.whetstone] });
  run.rack = ['p', 'l', 'a', 'n', 'e', 't', 's', 'c', 'x'];
  const preview = timelineTotal(resolveTimeline('planets', scoringRelics(run.inventory), run.tileBonus, playCtx(run)));
  assert.equal(playWord(run, 'planets', dict).total, preview);
  assert.equal(preview, score('planets').total); // count was 0 on the first play
  assert.equal(run.inventory.state.whetstone.count, 1);
  run.rack = ['q', 'u', 'a', 'r', 't', 'z', 'c', 'a', 't'];
  assert.equal(playWord(run, 'quartz', dict).total, score('quartz').total * 2); // mult 1 + 1
  assert.equal(run.inventory.state.whetstone.count, 2);
  playWord(run, 'cat', dict);
  assert.equal(run.inventory.state.whetstone.count, 2); // 3 letters, no tick
  assert.equal(playWord(run, 'cat', dict).ok, false); // out of letters, no tick either
  assert.equal(run.inventory.state.whetstone.count, 2);
});

check('momentum and collector read run history', () => {
  const play = freshPlay();
  const momentum = [POOL.momentum];
  assert.equal(score('cat', momentum, {}, play).steel, score('cat').steel);
  play.played.push('zoo', 'quiz');
  assert.equal(score('cat', momentum, {}, play).steel, score('cat').steel + 4);

  const inv = createInventory([POOL.collector]);
  const p2 = { played: [], relicState: inv.state };
  const c = [POOL.collector];
  assert.equal(score('cat', c, {}, p2).steel, score('cat').steel);
  settlePlay('quiz', c, p2); // q and z
  settlePlay('jazz', c, p2); // j, z again
  assert.equal(score('cat', c, {}, p2).steel, score('cat').steel + 30);
});

check('prices tier by rarity, miser marks them up, sell-back is half the base', () => {
  const c = POOL.ballast; const u = POOL.keystone; const r = POOL.novella;
  assert.ok(relicPrice(c) < relicPrice(u) && relicPrice(u) < relicPrice(r));
  assert.equal(relicPrice(c, [POOL.miser]), RELIC_PRICE.common + 2);
  assert.equal(sellPrice(r), Math.floor(RELIC_PRICE.rare * SELL_RATE));
  assert.equal(sellPrice(r), Math.floor(relicPrice(r, [POOL.miser]) * SELL_RATE) - 1); // markup never sells back
});

check('taxman taxes the clear bounty and the reward never goes negative', () => {
  assert.equal(encounterReward(100, 100, [POOL.taxman]), CLEAR_BOUNTY - 2);
  assert.equal(encounterReward(100, 100, [POOL.taxman, POOL.taxman, POOL.taxman]), 0);
});

check('relic state survives a save round trip and a share re-scores an escalated run', () => {
  const dict = makeDictionary(['planets', 'quartz']);
  const run = createRun(5, { relics: [POOL.whetstone, POOL.momentum, POOL.collector] });
  run.rack = ['p', 'l', 'a', 'n', 'e', 't', 's', 'q', 'z'];
  playWord(run, 'planets', dict);
  run.rack = ['q', 'u', 'a', 'r', 't', 'z', 'c', 'a', 't'];
  playWord(run, 'quartz', dict);
  const loaded = decodeSave(encodeSave(run));
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.run.inventory.state, run.inventory.state);
  assert.deepEqual(relicList(loaded.run.inventory).map((x) => x.id), ['whetstone', 'momentum', 'collector']);
  const v = verifyShare(encodeShare(buildSharePayload(run)), dict);
  assert.equal(v.matches, true);
  assert.equal(v.verifiedTotal, run.score);
  assert.ok(run.score > score('planets').total + score('quartz').total); // escalation is in the total
});

console.log(`\n${pass} passed`);
