import { score, settlePlay } from './scoring.js';
import { isValid } from './dictionary.js';
import { RULESET_HASH } from './letters.js';
import { POOL } from './relics.js';
import { createInventory, relicList, scoringRelics } from './inventory.js';

// A share is a self-contained base64url payload: seed, ruleset stamp, relic ids,
// tile upgrades, the route of lane picks, the ordered words played, and the
// sender's claimed total. The receiving device trusts none of the sender's
// arithmetic — it re-scores the decoded words through its own engine and
// compares. That makes the "leaderboard" an honest local per-seed table plus
// paste-to-compare, the ceiling reachable without a backend. The route is
// carried so a receiver can walk the seed down the same lanes; it never enters
// the re-score, since no lane effect touches score().
// The payload is pure ASCII (numbers, hex, lowercase letters), so btoa/atob need
// no UTF-8 handling.
function b64urlEncode(s) {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s) {
  const pad = s.length % 4;
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + (pad ? '='.repeat(4 - pad) : '');
  return atob(b64);
}

export function buildSharePayload(run) {
  return {
    seed: run.seed,
    ruleset: RULESET_HASH,
    relicIds: relicList(run.inventory).map((r) => r.id),
    tileBonus: run.tileBonus,
    route: run.route,
    words: run.played,
    total: run.score,
  };
}

export function encodeShare(payload) {
  return b64urlEncode(JSON.stringify(payload));
}

export function decodeShare(str) {
  try {
    const p = JSON.parse(b64urlDecode(str));
    if (!p || !Array.isArray(p.words) || !Array.isArray(p.relicIds)) return null;
    if (!p.tileBonus || typeof p.tileBonus !== 'object') return null;
    if (!Array.isArray(p.route)) return null;
    return p;
  } catch {
    return null;
  }
}

// Re-score the shared words locally. Every word must be a real dictionary word
// and the recomputed total must equal the claimed one under a matching ruleset;
// any mismatch is reported rather than silently accepted, so an inflated total or
// a fabricated word cannot post a score. The words replay in order through a
// fresh inventory so escalating relics rebuild their counts from nothing, the
// same way the sender's run did; the payload never carries relic state.
export function verifyShare(str, dict, pool = POOL) {
  const p = decodeShare(str);
  if (!p) return { ok: false, reason: 'corrupt' };
  const inv = createInventory(p.relicIds.map((id) => pool[id]).filter(Boolean));
  const relics = scoringRelics(inv);
  const play = { played: [], relicState: inv.state };
  let verifiedTotal = 0;
  for (const word of p.words) {
    if (!isValid(word, dict)) return { ok: false, reason: 'invalid-word', word };
    verifiedTotal += score(word, relics, p.tileBonus, play).total;
    settlePlay(word, relics, play);
    play.played.push(word);
  }
  const rulesetMatches = p.ruleset === RULESET_HASH;
  return {
    ok: true,
    seed: p.seed,
    route: p.route,
    words: p.words,
    claimedTotal: p.total,
    verifiedTotal,
    rulesetMatches,
    matches: rulesetMatches && verifiedTotal === p.total,
  };
}
