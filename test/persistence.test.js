import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadDictionary } from '../src/dictionary.js';
import { fnv1a } from '../src/hash.js';
import { RULESET_HASH } from '../src/letters.js';
import { createRun, playWord, endRound, roundTarget, pickLane } from '../src/run.js';
import { POOL } from '../src/relics.js';
import { encodeSave, decodeSave, commitSave, loadSave, KEYS, SCHEMA_VERSION } from '../src/save.js';
import { relicList } from '../src/inventory.js';
import { buildSharePayload, encodeShare, decodeShare, verifyShare } from '../src/share.js';
import { makeScoreboard, record, best, bestOverall, toRows } from '../src/highscores.js';
import { initDb, saveRun, loadRun, clearRun, recordHighScore, loadScoreboard } from '../src/ui/db.web.js';

let pass = 0;
function check(name, fn) {
  fn();
  pass++;
  console.log(`ok - ${name}`);
}

const WORDS = fileURLToPath(new URL('../assets/words.txt', import.meta.url));
const dict = loadDictionary(WORDS);
const RELIC_IDS = ['longhand', 'vowelMult', 'bookend'];

function freshRun(seed = 42) {
  const run = createRun(seed, { relics: RELIC_IDS.map((id) => POOL[id]) });
  // Force a known word into the run so save/share carry real state.
  run.rack = ['p', 'l', 'a', 'n', 'e', 't', 's', 'x', 'z'];
  run.tileBonus = { s: 2 };
  run.gold = 7;
  playWord(run, 'planets', dict);
  return run;
}

check('fnv1a is deterministic and sensitive to input', () => {
  assert.equal(fnv1a('planets'), fnv1a('planets'));
  assert.notEqual(fnv1a('planets'), fnv1a('planots'));
  assert.match(RULESET_HASH, /^[0-9a-f]{8}$/);
});

check('save round-trips run state and rehydrates relics from the pool', () => {
  const run = freshRun();
  const decoded = decodeSave(encodeSave(run));
  assert.equal(decoded.ok, true);
  const r = decoded.run;
  assert.equal(r.seed, run.seed);
  assert.deepEqual(r.bag, run.bag);
  assert.deepEqual(r.rack, run.rack);
  assert.equal(r.score, run.score);
  assert.deepEqual(r.played, run.played);
  assert.deepEqual(relicList(r.inventory).map((x) => x.id), RELIC_IDS);
  assert.equal(r.boss, run.boss);
  assert.equal(r.gold, 7);
  assert.deepEqual(r.tileBonus, { s: 2 });
  assert.equal(typeof r.rng, 'function'); // rebuilt from seed, never serialized
});

check('save carries the pressure fields: modifiers, a pending draft, consumables, armed', () => {
  const run = freshRun();
  run.modifiers = ['lean'];
  run.draft = ['tithe', 'deep'];
  run.consumables = ['refresh'];
  run.armed = 'freeplay';
  run.bag.push('*');
  run.spent = ['q', 'z'];
  const r = decodeSave(encodeSave(run)).run;
  assert.deepEqual(r.modifiers, ['lean']);
  assert.deepEqual(r.draft, ['tithe', 'deep']);
  assert.deepEqual(r.consumables, ['refresh']);
  assert.equal(r.armed, 'freeplay');
  assert.equal(r.bag[r.bag.length - 1], '*');
  assert.deepEqual(r.spent, ['q', 'z']);
});

check('save carries the lane, a pending lane choice, and the route', () => {
  const run = freshRun();
  run.lane = 'elite';
  run.laneChoice = true;
  run.route = ['safe', 'elite'];
  const r = decodeSave(encodeSave(run)).run;
  assert.equal(r.lane, 'elite');
  assert.equal(r.laneChoice, true);
  assert.deepEqual(r.route, ['safe', 'elite']);
});

// Force the current round to clear and settle it.
function clearRound(run) {
  run.score = roundTarget(run);
  return endRound(run);
}

check('a share carries the route and a receiver walking the seed down it banks the same elite relic', () => {
  const run = freshRun();
  clearRound(run);
  const granted = pickLane(run, 'elite').relic;
  assert.ok(granted);
  clearRound(run);
  clearRound(run);
  const v = verifyShare(encodeShare(buildSharePayload(run)), dict);
  assert.equal(v.ok, true);
  assert.deepEqual(v.route, ['elite']);
  const replay = createRun(v.seed, { relics: RELIC_IDS.map((id) => POOL[id]) });
  clearRound(replay);
  assert.equal(pickLane(replay, v.route[0]).relic, granted);
  clearRound(replay);
  clearRound(replay);
  assert.equal(relicList(replay.inventory).map((x) => x.id).at(-1), granted);
  const p = buildSharePayload(run);
  delete p.route;
  assert.equal(decodeShare(encodeShare(p)), null);
});

check('a tampered blob fails the checksum as corrupt', () => {
  const blob = encodeSave(freshRun(42));
  const tampered = blob.replace('"seed":42', '"seed":43');
  assert.notEqual(tampered, blob);
  assert.deepEqual(decodeSave(tampered), { ok: false, reason: 'corrupt' });
});

check('a wrong schema version is rejected before the data is read', () => {
  const body = { v: 999, ruleset: RULESET_HASH, data: {} };
  const blob = JSON.stringify({ checksum: fnv1a(JSON.stringify(body)), ...body });
  assert.deepEqual(decodeSave(blob), { ok: false, reason: 'version' });
});

check('a foreign ruleset stamp is rejected rather than mis-scored', () => {
  const body = { v: SCHEMA_VERSION, ruleset: 'deadbeef', data: {} };
  const blob = JSON.stringify({ checksum: fnv1a(JSON.stringify(body)), ...body });
  assert.deepEqual(decodeSave(blob), { ok: false, reason: 'ruleset' });
});

check('commit/load over a key-value store swaps through temp and clears it', () => {
  const m = new Map();
  const store = { get: (k) => m.get(k) ?? null, set: (k, v) => m.set(k, v), del: (k) => m.delete(k) };
  assert.deepEqual(loadSave(store), { ok: false, reason: 'empty' });
  const run = freshRun();
  commitSave(store, run);
  assert.equal(m.has(KEYS.tmp), false); // temp cleared after the swap
  const loaded = loadSave(store);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.run.score, run.score);
});

check('an honest share re-scores to a match on the receiving engine', () => {
  const run = freshRun();
  const v = verifyShare(encodeShare(buildSharePayload(run)), dict);
  assert.equal(v.ok, true);
  assert.equal(v.rulesetMatches, true);
  assert.equal(v.verifiedTotal, run.score);
  assert.equal(v.matches, true);
});

check('a share that drops its tile upgrades fails to re-score', () => {
  const p = buildSharePayload(freshRun());
  p.tileBonus = {}; // 'planets' scored w/ s:2, so the honest total needs it
  const v = verifyShare(encodeShare(p), dict);
  assert.equal(v.ok, true);
  assert.equal(v.matches, false);
});

check('share encode/decode round-trips the payload', () => {
  const p = buildSharePayload(freshRun());
  assert.deepEqual(decodeShare(encodeShare(p)), p);
});

check('an inflated total is caught by re-scoring, not accepted', () => {
  const p = buildSharePayload(freshRun());
  p.total += 1000;
  const v = verifyShare(encodeShare(p), dict);
  assert.equal(v.ok, true);
  assert.equal(v.matches, false);
  assert.notEqual(v.verifiedTotal, p.total);
});

check('a share from a foreign ruleset degrades to no-compare', () => {
  const p = buildSharePayload(freshRun());
  p.ruleset = 'deadbeef';
  const v = verifyShare(encodeShare(p), dict);
  assert.equal(v.rulesetMatches, false);
  assert.equal(v.matches, false);
});

check('a fabricated word cannot post a score', () => {
  const p = buildSharePayload(freshRun());
  p.words = ['planets', 'zzzzzz'];
  const v = verifyShare(encodeShare(p), dict);
  assert.deepEqual(v, { ok: false, reason: 'invalid-word', word: 'zzzzzz' });
});

check('highscores keep the best per seed and flag improvement', () => {
  const board = makeScoreboard();
  assert.deepEqual(record(board, 42, 100), { improved: true, best: 100 });
  assert.deepEqual(record(board, 42, 80), { improved: false, best: 100 });
  assert.deepEqual(record(board, 42, 150), { improved: true, best: 150 });
  assert.equal(best(board, 42), 150);
  assert.equal(best(board, 99), null);
  record(board, 7, 300);
  assert.equal(bestOverall(board), 300);
  assert.deepEqual(makeScoreboard(toRows(board)), board); // rows round-trip
});

{
  const m = new Map();
  const storage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  const db = await initDb(storage);
  assert.deepEqual(await loadRun(db), { ok: false, reason: 'empty' });
  const run = freshRun();
  await saveRun(db, run);
  assert.equal(m.has(`wordsmith.${KEYS.tmp}`), false);
  const loaded = await loadRun(db);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.run.score, run.score);
  await recordHighScore(db, run.seed, run.score);
  await recordHighScore(db, run.seed, run.score - 1);
  assert.equal(best(await loadScoreboard(db), run.seed), run.score);
  await clearRun(db);
  assert.deepEqual(await loadRun(db), { ok: false, reason: 'empty' });
  pass++;
  console.log('ok - web store adapter round-trips a run, keeps the best per seed, and clears');
}

console.log(`\n${pass} passed`);
