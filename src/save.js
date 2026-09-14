import { RULESET_HASH } from './letters.js';
import { fnv1a } from './hash.js';
import { mulberry32 } from './rng.js';
import { POOL } from './relics.js';
import { createInventory, relicList } from './inventory.js';

// A save is a versioned JSON blob guarded three ways: a schema version so an old
// save is rejected rather than misread, the ruleset hash so a retuned build
// refuses a stale run instead of scoring it wrong, and a checksum so a torn or
// tampered write is caught. The rng is never serialized — the current engine
// consumes the seed only at fill time, so seed plus the drawn bag/rack fully
// capture the run, and rng is rebuilt from seed on load. Relics persist as ids
// and rehydrate from the POOL, so a hook function never has to be serialized;
// their per-run slots (escalating counts) travel as relicState. Curse tiles ride
// inside bag and rack as ordinary entries; the drafted modifiers, a pending
// draft, held consumables, and an armed one are their own fields, as are the
// act's lane, a pending lane choice, and the route of lane picks so far.
export const SCHEMA_VERSION = 7;
export const KEYS = { main: 'run', tmp: 'run.tmp' };

function bodyOf(run) {
  return {
    v: SCHEMA_VERSION,
    ruleset: RULESET_HASH,
    data: {
      seed: run.seed,
      bag: run.bag,
      rack: run.rack,
      act: run.act,
      round: run.round,
      plays: run.plays,
      score: run.score,
      total: run.total,
      played: run.played,
      boss: run.boss,
      gold: run.gold,
      tileBonus: run.tileBonus,
      relicIds: relicList(run.inventory).map((r) => r.id),
      relicState: run.inventory.state,
      modifiers: run.modifiers,
      draft: run.draft,
      consumables: run.consumables,
      armed: run.armed,
      spent: run.spent,
      lane: run.lane,
      laneChoice: run.laneChoice,
      route: run.route,
    },
  };
}

export function encodeSave(run) {
  const body = bodyOf(run);
  const checksum = fnv1a(JSON.stringify(body));
  return JSON.stringify({ checksum, ...body });
}

export function decodeSave(str, pool = POOL) {
  let parsed;
  try {
    parsed = JSON.parse(str);
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
  if (!parsed || typeof parsed !== 'object' || typeof parsed.checksum !== 'string') {
    return { ok: false, reason: 'corrupt' };
  }
  const { checksum, ...body } = parsed;
  if (fnv1a(JSON.stringify(body)) !== checksum) return { ok: false, reason: 'corrupt' };
  if (body.v !== SCHEMA_VERSION) return { ok: false, reason: 'version' };
  if (body.ruleset !== RULESET_HASH) return { ok: false, reason: 'ruleset' };

  const d = body.data;
  const relics = d.relicIds.map((id) => pool[id]).filter(Boolean);
  const run = {
    seed: d.seed,
    rng: mulberry32(d.seed),
    bag: d.bag,
    rack: d.rack,
    act: d.act,
    round: d.round,
    plays: d.plays,
    score: d.score,
    total: d.total,
    played: d.played,
    boss: d.boss,
    gold: d.gold,
    tileBonus: d.tileBonus,
    inventory: createInventory(relics, d.relicState),
    shop: null,
    lost: null,
    modifiers: d.modifiers,
    draft: d.draft,
    consumables: d.consumables,
    armed: d.armed,
    spent: d.spent,
    lane: d.lane,
    laneChoice: d.laneChoice,
    route: d.route,
  };
  return { ok: true, run };
}

// Write-temp-then-swap over a key/value store ({ get, set, del }): the temp key
// takes the full blob first, then main is overwritten, then temp is cleared, so
// a crash mid-write leaves either the prior main intact or a complete temp to
// recover. The store's own atomicity (a SQLite transaction) backs this; the
// ordering here is what makes that guarantee usable.
export function commitSave(store, run) {
  const blob = encodeSave(run);
  store.set(KEYS.tmp, blob);
  store.set(KEYS.main, blob);
  store.del(KEYS.tmp);
}

export function loadSave(store, pool = POOL) {
  const blob = store.get(KEYS.main) ?? store.get(KEYS.tmp);
  if (!blob) return { ok: false, reason: 'empty' };
  return decodeSave(blob, pool);
}
