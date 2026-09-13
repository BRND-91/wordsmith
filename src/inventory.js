// One copy of a relic per run: the inventory is keyed on relic.id, so a second
// add of the same id is refused. This is the control the score() engine lacks on
// its own — it iterates a plain array with no dedupe, and stacked duplicates of
// an unconditional flat-mult relic are the likeliest balance break.
//
// `state` holds one slot per relic id for escalating relics (scoring.js hook
// ctx `self`). It lives here rather than on the POOL entry so two runs never
// share a count, and it leaves with the relic on sell so a re-buy starts fresh.

export function createInventory(relics = [], state = {}) {
  const byId = new Map();
  for (const r of relics) byId.set(r.id, r);
  return { byId, state };
}

export function addRelic(inv, relic) {
  if (inv.byId.has(relic.id)) return { ok: false, reason: 'already owned' };
  inv.byId.set(relic.id, relic);
  inv.state[relic.id] = {};
  return { ok: true };
}

export function removeRelic(inv, id) {
  inv.byId.delete(id);
  delete inv.state[id];
}

export function relicList(inv) {
  return [...inv.byId.values()];
}

// Only hook-bearing relics reach score(); economy relics carry no hook and are
// consumed by the economy layer instead.
export function scoringRelics(inv) {
  return relicList(inv).filter((r) => typeof r.hook === 'function');
}

export function econRelics(inv) {
  return relicList(inv).filter((r) => r.econ);
}
