# Wordsmith staged build plan (draft for Review)

Wordsmith is an offline word roguelike (Expo 51 / RN 0.74, `projects/wordsmith`).
Stages 2-6 are built as pure modules with passing tests but most of them are not
wired into the run loop or the UI. This plan sequences the remaining work into
stages with a verifiable exit each. The mechanics research log
(`design/roguelike-research.md`, 8 angles) is the candidate pool; each stage names
what it absorbs and what it defers. Review: argue the ordering, cut what does not
earn its slot, and flag any exit criterion that is not actually checkable.

## Stage 7. Close the engine loop

Goal: run.js owns round, act, boss, and loss so the UI stops composing rules.
- `endRound(state)`: checks `state.score` vs `roundTarget` after each shown play;
  under target with plays at 0 sets `state.lost` w/ the failing act, round, target,
  score, and boss captured (research: explicit loss state, failure-informed
  game-over).
- Act advance in run.js, not GameScreen. Score resets per round (the composed loop
  already did this at GameScreen.js `run.score = 0`; targets were tuned as per-round
  numbers) and the engine loop keeps that semantic.
- boss roll: the boss parameters thread through `roundTarget` (targetScale) and
  `playWord` (allows for word legality, plus the zeroTag and multScale debuffs that
  reach the relic set and the mult). run.js draws one boss per act from the seeded
  rng at run start and at each act advance, stores it on state, and applies it only
  in the boss round. Each entry carries a `minAct`, so `eligibleBossIds(act)` grows
  the pool as archetype-counter bosses unlock: minLength, noRepeatLong, and
  maxOneVowel from act 1, then vowelBlight (zeroes the vowel archetype for the
  round), flint (halves mult only, steel untouched), and noRepeatShape (bars a
  second word of the same bookend/palindrome/doubled shape in a row) from act 4.
  Telegraph on state from `TELEGRAPH_LEAD` rounds before the boss round (stage 3
  verdict: two rounds ahead).
- Wire bosses into GameScreen via the state, delete the composed loop.
Exit: run.test.js covers loss, advance, boss roll determinism per seed, and every
boss's scaled target at or above the act's round-3 target (maxOneVowel at 0.75
gave 158 under round 3's 160, so it moved to 0.8 = 168); GameScreen imports no
rule constants.
Deferred: dual-threshold rounds, stacked boss constraints, shrinking plays.

## Stage 8. Put the economy on the play path

Goal: gold, shop, and tile services are real between-round decisions.
- `state.gold`, `encounterReward` on round clear, `rollShop` on the state seed +
  round index so a daily reproduces.
- Implement `remove-tile` and `upgrade-tile` against `state.bag` (research: bag
  thinning, bag insurance). Sell-back at partial gold (research: economy angle).
- `inventory.js` replaces the bare `state.relics` array; uniqueness enforced at
  add, not only at the shelf.
- Shop screen in `src/ui/`, reachable after every non-boss round to start.
Exit: an integration test plays a seeded run through clear, shop buy, reroll,
tile removal, and asserts the bag and gold deltas; UI shows a shop w/ prices.
Deferred: vouchers / slot expansion, shop as a route node.
Status: DONE. `test/economy.test.js` (12 checks) covers the exit; shelf seed is
`fnv1a(seed:act:round:rerolls)`; prices relic 6 / remove 3 / upgrade 4 / sell 3
/ reroll 1 escalating; upgrade is per letter (+1 steel per copy played); save
schema v2 and the share payload carry `tileBonus` so re-scoring stays honest.
`src/ui/ShopScreen.js` parses as JSX; no device render yet (no node_modules).

## Stage 9. Relic depth

Goal: the pool has texture, drafting has tradeoffs.
- Rarity tag on every POOL entry, weighted `rollShop` (research: 4-tier weighted
  odds, rarity shown on the shelf label). Legendary tier: 0 shop weight, event-only.
- Widen the hook ctx to `{ word, state, relics }` so cross-relic and per-run
  conditionals are expressible. Per-relic state slot on the inventory entry now
  that hooks fire once (stage 4 double-invocation risk is closed).
- Add 3-5 drawback relics and 2-3 escalating relics; keep order independence
  (order-dependent stacking is deferred, it rewrites the scoring contract).
Exit: a pool audit test asserts archetype split and rarity weights; every hook runs
against a fixed word fixture w/ no NaN and no unread declared fields.
Deferred: retrigger relics, anti-synergy pairs, order-dependent stacking.
Status: DONE. `test/relics.test.js` (12 checks) covers the exit; pool is 49
(16 common / 20 uncommon / 12 rare / 1 legendary, weights 60/30/10/0), prices
tier 5/7/10/15 w/ `miser` marking up. Open question 3 resolved narrower than
`{ word, state, relics }`: ctx is `{ word, played, relics, self }`, since the
share payload has no run state and re-scoring must replay from words alone.
Escalators keep their count in `self` and advance it in `onPlay` (fired once per
committed play by `settlePlay`), never in the hook, so the presenter's timeline
preview and the committed score agree; GameScreen builds the preview before
`playWord` for the same reason. Save schema v3 carries `relicState`. The `rarity`
relic id is now `hoard`. `verifyShare` filters to hook-bearing relics (an econ
id in a payload used to throw).

## Stage 10. Run pressure

Goal: a run can go wrong in ways the player has to answer.
- Curse tiles: a 0-value tile injected into the bag on a boss near-miss or as a
  cheap-relic tax; cleared only by draw-and-exchange or the remove-tile service.
- Act-entry modifier draft: choose 1 of 2 permanent run modifiers per act
  (rack -1 / score +15%, etc.), replacing the free ride into act N.
- Consumables: 1-2 slot inventory of single-use items (refresh rack, force vowel),
  bought in shop, spent on one `playWord`.
Exit: run.test.js covers curse injection and clearance, modifier persistence across
acts, consumable single-fire; balance smoke script runs 200 seeded runs w/ a greedy
bot and reports clear rate per act.
Deferred: within-act compounding targets, boss-specific curse relics.
Status: DONE. `test/run.test.js` (31 checks) covers the exit; open question 4
resolved as both in one stage, since consumables and curses share the exchange
path. Curse tile is `*` in `bag.js`: seeded in by a boss near-miss
(`NEAR_MISS_SCALE`), the `hexed` modifier, or the common-relic tax in `shop.js`;
cleared by `exchangeTiles` / `exchangeCurses` (one play) or the remove-tile
service. Modifiers are `modifiers.js`, six entries, drafted 1-of-2 on every act
advance through `run.draft` and `pickModifier`; every effect lands on the run
frame (rack, plays, target mults, clear gold, curses), none on `score()`, so a
share still re-scores from words. Consumables are `consumables.js`, two slots,
one rolled per shop after the relics: `refresh` and `vowel` fire on use, `freeplay`
arms and is spent by the next `playWord`. Played and exchanged letters wait in
`run.spent` and reshuffle into the bag on a round clear; the bag ran dry inside
act 2 without it. Save schema v4 carries modifiers, draft, consumables, armed,
exchange. `npm run smoke` is the greedy-bot harness, baseline in
`design/balance-baseline.md` (act 8 clear 33/500 after stage 11; safe-lane
losses almost all on the boss round, elite losses split across rounds 2-3 and
the boss). Open question 6: the harness lands here, stages 7-9 have no baseline.

## Stage 11. Route

Goal: one route decision per act. Smallest version that is a real choice.
- Two lanes per act after round 1: elite (stricter constraint, guaranteed relic)
  vs safe (flat target). Shop access is lane-gated.
- Event node with unseen payoff is optional; ship only if the lane split lands.
Exit: route is seeded and serializes into the save; a run can be replayed from a
share payload including lane picks.
Review question: does route earn its UI cost in a word game, or does the act-entry
modifier draft in stage 10 already cover the agency gap.
Status: DONE, event node not shipped. A round-1 clear returns `outcome: 'lane'`
and `pickLane` (`LANES`, `LANE_ROUND`) blocks play until picked. Picking elite
grants one relic on the spot (`grantEliteRelic`, its id returned as `relic` in
the pick result), runs the act's boss rule from round 2 at `ELITE_TARGET_SCALE`
(0.75) on the non-boss rounds, skips the round-2 shop, and opens the one
pre-boss shop on the round-3 clear. Picking safe opens the shop the round-1
clear withheld and keeps flat targets and both shops. The relic is seeded off
`fnv1a(seed:act:elite)` through `rollShop` so the lane never moves the boss or
draft draws. Save schema v5 carries `lane`, `laneChoice`, `route`; the share
payload carries `route`, and `persistence.test.js` replays a seed down the
shared route to the same granted relic. `test/run.test.js` (34 checks).
Smoke (`npm run smoke -- 500 8`, full table in `design/balance-baseline.md`):
mixed (elite on odd acts) clears act 8 11/250 at mean act 2.99, safe 22/250 at
3.92, so the lane is still a trap for the greedy bot. The grant sits on the pick
rather than the round-3 clear because the smoke put most elite deaths in rounds
2-3, nearly all under `maxOneVowel`, before a round-3 relic could pay; moving it
cut those deaths from 135 to 96 over 500 runs and pushed the survivors to the
elite boss round, where `maxOneVowel` now kills 37/81 (0.46) against 139/393
(0.35) on safe. Rejected lever: `ELITE_TARGET_SCALE` on the elite boss round,
since 210*0.8*0.75 = 126 drops under the round-3 floor `run.test.js` asserts and
makes safe the dominated pick. Open lever: the `maxOneVowel` boss itself, which
is the top killer on both lanes. The review question stands.

## Stage 12. Persistence and meta wired in

Goal: what stage 6 built reaches the player.
- `commitSave` on every state change through `src/ui/db.js`, `loadSave` on launch,
  ruleset hash guard.
- Highscores per seed, share encode/verify UI, ascension picker (`ASCENSION`).
- Meta unlocks: a gated slice of POOL opens on named conditions (first act 2 boss
  clear, win w/ zero relics). Meta-currency shop is deferred until unlock gating is
  played.
Exit: persistence.test.js covers save/load/share round trip through the UI store
adapter; kill-and-relaunch mid-run restores state on device.

## Open questions for Review

1. Stage 7 vs 8 order: loss state first so the economy has stakes, or economy first
   so there is something to lose.
2. Score carry across rounds within an act (current behaviour) vs reset per round
   (Balatro model). Targets were tuned assuming carry.
3. Stage 9 ctx widening: `{ word, state, relics }` vs a narrower `{ word, played,
   held }` to keep hooks testable without a full run state.
4. Stage 10 scope: curse tiles and consumables together, or one per stage.
5. Stage 11: keep, cut, or merge the elite lane into a boss-round option.
6. Balance harness: the greedy-bot smoke script in stage 10 is the first automated
   balance check; should it land in stage 7 instead so every later stage has a
   baseline.
