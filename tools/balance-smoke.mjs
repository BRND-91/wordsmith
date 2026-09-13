// Balance smoke: play N seeded runs with a greedy bot and report the clear rate
// per act. The bot always plays the highest-scoring legal word it holds, buys
// the priciest relic it can afford, picks the first draft option, and burns
// consumables as soon as it has them, so the numbers are a floor for a player
// who plans and a ceiling for one who cannot find words. Odd seeds alternate
// lanes (elite on odd acts, so the banked gold meets a shop the act after) and
// even seeds stay safe, so the report splits the two policies.
//
//   node tools/balance-smoke.mjs [runs=200] [maxAct=8]
import { fileURLToPath } from 'node:url';
import { loadDictionary } from '../src/dictionary.js';
import { score } from '../src/scoring.js';
import { POOL } from '../src/relics.js';
import { scoringRelics, econRelics, relicList } from '../src/inventory.js';
import { isCurse, countCurses } from '../src/bag.js';
import {
  createRun, playWord, endRound, playCtx, exchangeCurses, exchangeTiles, pickModifier, useItem,
  pickLane, ROUNDS_PER_ACT,
} from '../src/run.js';
import { buyRelic, buyConsumable, leaveShop, relicPrice } from '../src/shop.js';

const [runsArg = '200', maxActArg = '8'] = process.argv.slice(2);
const RUNS = Number(runsArg);
const MAX_ACT = Number(maxActArg);
const STARTERS = [POOL.longhand, POOL.vowelMult, POOL.bookend];
// The largest rack a modifier allows; longer words can never be held.
const MAX_WORD = 10;

const dict = loadDictionary(fileURLToPath(new URL('../assets/words.txt', import.meta.url)));

// Sorted letters -> words, so a rack's 2^n letter subsets resolve to every
// playable word in n*2^n map hits instead of a dictionary scan per play.
const anagrams = new Map();
for (const w of dict) {
  if (w.length > MAX_WORD) continue;
  const key = [...w].sort().join('');
  const list = anagrams.get(key);
  if (list) list.push(w);
  else anagrams.set(key, [w]);
}

function candidates(rack) {
  const letters = rack.filter((t) => !isCurse(t));
  const n = letters.length;
  const seen = new Set();
  const out = [];
  for (let mask = 1; mask < 1 << n; mask++) {
    const sub = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) sub.push(letters[i]);
    const key = sub.sort().join('');
    if (seen.has(key)) continue;
    seen.add(key);
    const words = anagrams.get(key);
    if (words) out.push(...words);
  }
  return out;
}

// Highest-scoring word the engine accepts (boss rules reject down the list).
function bestPlay(state) {
  const relics = scoringRelics(state.inventory);
  const play = playCtx(state);
  const ranked = candidates(state.rack)
    .map((w) => ({ w, t: score(w, relics, state.tileBonus, play).total }))
    .sort((a, b) => b.t - a.t);
  for (const { w } of ranked) if (playWord(state, w, dict).ok) return w;
  return null;
}

function shopPolicy(state) {
  const econ = econRelics(state.inventory);
  const shelf = [...state.shop.shelf].sort((a, b) => relicPrice(b, econ) - relicPrice(a, econ));
  for (const r of shelf) if (buyRelic(state, r.id).ok) break;
  buyConsumable(state);
  leaveShop(state);
}

function playRun(seed) {
  const state = createRun(seed, { relics: STARTERS });
  const policy = seed % 2 ? 'mixed' : 'safe';
  let stuck = false;
  // One entry per boss round reached: the lane that carried the act into it,
  // gold in rack on entry, and whether the run died there.
  const bossVisits = [];
  while (!state.lost && state.act <= MAX_ACT) {
    if (state.round === ROUNDS_PER_ACT && bossVisits.at(-1)?.act !== state.act) {
      bossVisits.push({ act: state.act, lane: state.lane, boss: state.boss, gold: state.gold, died: false });
    }
    if (state.draft) pickModifier(state, state.draft[0]);
    if (state.laneChoice) pickLane(state, policy === 'mixed' && state.act % 2 ? 'elite' : 'safe');
    if (state.shop) shopPolicy(state);
    if (countCurses(state.rack) >= 2 && state.plays >= 2) exchangeCurses(state);
    if (state.consumables.includes('freeplay') && !state.armed) useItem(state, 'freeplay');
    if (!bestPlay(state)) {
      if (state.consumables.includes('refresh')) {
        useItem(state, 'refresh');
        continue;
      }
      // No legal word: exchange the whole rack for a play while one is left to
      // play after it; on the last play the round is forfeit.
      if (state.plays >= 2) {
        exchangeTiles(state, state.rack.map((_, i) => i));
        continue;
      }
      state.plays = 0;
      stuck = true;
    }
    endRound(state);
  }
  if (state.lost && state.lost.round === ROUNDS_PER_ACT) bossVisits.at(-1).died = true;
  return {
    reached: state.act,
    lost: state.lost,
    policy,
    stuck,
    bossVisits,
    lostLane: state.lost ? state.lane : null,
    relics: relicList(state.inventory).length,
    curses: countCurses(state.bag) + countCurses(state.rack),
    modifiers: state.modifiers,
  };
}

const t0 = Date.now();
const results = [];
for (let seed = 1; seed <= RUNS; seed++) results.push(playRun(seed));
const ms = Date.now() - t0;

const pad = (v, w) => String(v).padStart(w);
console.log(`runs=${RUNS} maxAct=${MAX_ACT} dict=${dict.size} ${ms}ms`);
console.log(`act  entered  cleared   rate   lost r1  r2  r3 boss`);
for (let act = 1; act <= MAX_ACT; act++) {
  const entered = results.filter((r) => r.reached >= act).length;
  const cleared = results.filter((r) => r.reached > act).length;
  const lostHere = results.filter((r) => r.lost && r.lost.act === act);
  const byRound = [1, 2, 3, ROUNDS_PER_ACT].map((rd) => lostHere.filter((r) => r.lost.round === rd).length);
  const rate = entered ? (cleared / entered).toFixed(2) : '   -';
  console.log(`${pad(act, 3)}  ${pad(entered, 7)}  ${pad(cleared, 7)}  ${pad(rate, 5)}       ${byRound.map((n) => pad(n, 3)).join(' ')}`);
}
const finished = results.filter((r) => !r.lost).length;
const stuck = results.filter((r) => r.stuck).length;
const meanRelics = (results.reduce((s, r) => s + r.relics, 0) / RUNS).toFixed(1);
const meanCurses = (results.reduce((s, r) => s + r.curses, 0) / RUNS).toFixed(2);
const picks = {};
for (const r of results) for (const m of r.modifiers) picks[m] = (picks[m] ?? 0) + 1;
console.log(`cleared act ${MAX_ACT}: ${finished}/${RUNS}  stuck (no word): ${stuck}  mean relics: ${meanRelics}  mean curses held at end: ${meanCurses}`);
console.log(`draft picks: ${Object.entries(picks).map(([k, v]) => `${k}=${v}`).join(' ')}`);
for (const policy of ['mixed', 'safe']) {
  const runs = results.filter((r) => r.policy === policy);
  const done = runs.filter((r) => !r.lost).length;
  const relics = (runs.reduce((s, r) => s + r.relics, 0) / runs.length).toFixed(1);
  const meanAct = (runs.reduce((s, r) => s + r.reached, 0) / runs.length).toFixed(2);
  const laneStuck = runs.filter((r) => r.stuck).length;
  const lostBy = {};
  for (const r of runs) if (r.lost) lostBy[r.lost.boss ?? 'plain'] = (lostBy[r.lost.boss ?? 'plain'] ?? 0) + 1;
  console.log(`lane policy ${policy}: cleared act ${MAX_ACT} ${done}/${runs.length}  mean act reached ${meanAct}  mean relics ${relics}  stuck ${laneStuck}  lost under: ${Object.entries(lostBy).map(([k, v]) => `${k}=${v}`).join(' ')}`);
}
// Conditional boss-round death rate by lane: of acts that reached round 4 down
// each lane, how many ended the run there, split by boss.
const visits = results.flatMap((r) => r.bossVisits);
console.log(`boss round by lane (entered/died/rate, mean gold on entry)`);
for (const lane of ['elite', 'safe']) {
  const v = visits.filter((x) => x.lane === lane);
  const died = v.filter((x) => x.died).length;
  const gold = v.length ? (v.reduce((s, x) => s + x.gold, 0) / v.length).toFixed(1) : '-';
  const perBoss = {};
  for (const x of v) {
    const p = (perBoss[x.boss] ??= { n: 0, d: 0 });
    p.n += 1;
    p.d += x.died ? 1 : 0;
  }
  const bossCols = Object.entries(perBoss)
    .map(([k, p]) => `${k}=${p.d}/${p.n} (${(p.d / p.n).toFixed(2)})`)
    .join('  ');
  console.log(`  ${lane.padEnd(5)} ${died}/${v.length} (${v.length ? (died / v.length).toFixed(2) : '-'})  gold ${gold}  ${bossCols}`);
}
// Where each lane's deaths land: round 1 precedes the lane pick, so it is null.
console.log(`deaths by lane and round (r2 r3 boss)`);
for (const lane of ['elite', 'safe']) {
  const dead = results.filter((r) => r.lost && r.lostLane === lane);
  const byRound = [2, 3, ROUNDS_PER_ACT].map((rd) => dead.filter((r) => r.lost.round === rd).length);
  const byBoss = {};
  for (const r of dead) if (r.lost.round < ROUNDS_PER_ACT) byBoss[r.lost.boss ?? 'plain'] = (byBoss[r.lost.boss ?? 'plain'] ?? 0) + 1;
  console.log(`  ${lane.padEnd(5)} ${byRound.map((n) => pad(n, 4)).join(' ')}  pre-boss under: ${Object.entries(byBoss).map(([k, v]) => `${k}=${v}`).join(' ')}`);
}
