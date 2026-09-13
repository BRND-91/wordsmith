# Roguelike mechanics research (Wordsmith benchmark)

Cumulative log. Each cycle picks one angle not yet covered, argues where Wordsmith
falls short against it, and proposes concrete mechanics. Recommend only, never build.

## 2026-09-13 00:37 — Angle: boss/curse design and permanent run modifiers

Current state: `BOSS_RULES` (run.js) gives 3 static word-filter bosses plus a flat
`targetScale`; `actTargets` scales boss/round numbers by a constant 1.7x per act with
no per-run variance or lingering cost. No curse or negative-card equivalent exists
anywhere in relics.js.

- Curse tiles (Slay the Spire): a boss defeat or bad shop pick adds a dead/negative
  tile to the bag (0 steel value, or a `-mult` hook) that must be drawn and discarded
  before refilling clears it. Wordsmith's bag never carries dead weight — every tile
  is pure upside, so there's no tension in what you're forced to draw.
- Ante-style compounding target (Balatro): instead of a flat `ACT_BREAK_SCALE` per
  act, scale the target *within* an act too (each of the 4 rounds compounds off the
  last score, not a fixed table) so a slow round snowballs into an unrecoverable
  boss target. Current `ACT1_TARGETS` is a static array — no run-to-run pressure
  from a weak early round.
- Telegraphed run-modifier draft (Slay the Spire ascension / Inscryption sacrifice):
  at act start, offer a choice of 2 permanent modifiers (e.g. "hand size -1, +15%
  score" vs "no repeat letters this act, +1 relic slot") instead of the free ride
  into act N. Wordsmith has zero opt-in difficulty knobs; challenge is entirely
  fixed by act number.
- Boss-specific curse relics (Monster Train vertical escalation): a boss loss (or a
  near-miss) attaches a persistent negative relic hook for the rest of the run
  (e.g. `-1 steel per vowel`) that must be countered by a drafted relic, not just
  survived once. Current bosses are one-shot filters with no lasting consequence
  either way — win or lose, round 1 of the next act looks identical.
- Escalating stakes readout (Balatro ante clock): surface the boss's target *and*
  the act's compounding formula to the player before round 1, not just at boss
  entry, so the countdown pressure is visible the whole act instead of only the
  last round's telegraph line.

Sources: [Rogueliker — Roguelike Deckbuilders](https://rogueliker.com/roguelike-deckbuilders/), [Choost Games — Slay the Spire vs Balatro](https://choostgames.com/blog/slay-the-spire-vs-balatro/)

## 2026-09-13 06:37 — Angle: relic synergy and retrigger design

Current state: `score()` (scoring.js) maps each relic's `hook(ctx)` independently
over `{ word }` alone, then sums `addSteel`/`addMult`/`xMult` in fixed tiers — no
relic ever sees another relic's presence or output, and no retrigger or
per-relic-count scaling exists anywhere in relics.js or scoring.js.

- Retrigger relic (Balatro Mime/Hack): a relic hook that re-invokes another
  held relic's `hook(ctx)` a second time, doubling its yield without doubling
  its slot cost. Wordsmith's `results = relics.map((relic) => relic.hook(ctx))`
  invokes each hook exactly once by design — there's no seam for a relic to
  reference or re-fire a sibling's effect.
- Cross-relic conditional (Balatro Baron+King synergy): a relic whose `hook`
  reads `ctx.relics` (not just `ctx.word`) to scale off another relic's
  presence, e.g. "+1 xMult per other vowel-scoring relic held." Current `ctx`
  in `score()` is `{ word }` only — a relic hook has no visibility into the
  rest of the held set, so no relic can be built to reward a specific pairing.
- Escalating per-play relic (Balatro scaling jokers like Ride the Bus): a
  relic that mutates its own stored counter each `playWord` call and reads it
  back next play (e.g. `+1 permanent addMult per vowel-word played this run`).
  `relics.js`'s POOL entries are pure stateless functions of the current word;
  nothing persists relic-side across `state.played`, so no relic can reward a
  streak or punish a drought.
- Anti-synergy tension (Balatro build-around downside jokers): a relic with a
  real drawback baked into its hook (e.g. `-2 addMult` unless paired with a
  named counter-relic), forcing a keep-or-cut call at draft time. Every
  current POOL/RELICS entry (vowelMult, bookend, longhand) is pure upside with
  no embedded cost, so drafting is never a real tradeoff, only a strict
  improvement.
- Order-dependent stacking (Balatro left-to-right joker resolution): score
  relics in `relics` array order instead of the current tiered
  addSteel-then-addMult-then-xMult pass, so *where* a relic sits in the
  loadout changes its output and drafting order becomes a build decision.
  `score()`'s three separate `for` loops currently make relic order
  irrelevant — result is identical no matter how POOL entries are arranged.

Sources: [switchbladegaming.com — Balatro Best Joker Combos](https://www.switchbladegaming.com/strategy-games/balatro-best-joker-combos/), [technosports.co.in — Mastering Balatro Joker Synergy](https://technosports.co.in/balatro-joker-synergy-guide/)

## 2026-09-13 02:37 — Angle: path/route design (branching node map)

Current state: `createRun`/`playWord` (run.js) enforce a single fixed corridor —
round 1 to round 2 to round 3 to boss, every run, every act, zero player choice
of route. `relics.js` has 30+ POOL entries (ballast, foundation, jeweler,
merchant, gambit, etc.) but no draft or route ever exposes a subset of them as
a route-dependent reward; the only agency is which word to play inside a
locked sequence.

- Branching node map (Slay the Spire): before each act, offer 2-3 parallel
  paths of rounds (e.g. a high-target/high-relic-reward lane vs a
  low-target/safe lane) so route choice is a real decision made once per act,
  not per word. Wordsmith's `ROUNDS_PER_ACT` sequence is identical for every
  run with the same seed — no route variance exists to plan around.
- Elite/risk node (Slay the Spire elite fights): insert an optional harder
  round with a stricter `BOSS_RULES`-style constraint and a guaranteed relic
  payout, skippable for a safer flat-score round. Current `BOSS_RULES` only
  ever fires on round 4 (the boss); no optional early-risk node exists to
  bank a relic ahead of schedule.
- Rest-site tradeoff (Slay the Spire campfire): a between-round node that
  trades a turn's worth of score potential for either healing (restoring a
  spent `plays` count) or upgrading a held relic, forcing a spend-now-vs-
  save-for-later call. Wordsmith's `plays`/`PLAYS_PER_ROUND` never recovers
  mid-act and no upgrade path exists for a relic once drafted.
- Event node with a blind gamble (Slay the Spire `?` nodes): a route option
  that reveals its payoff only after commit — e.g. "gain a random POOL relic
  or lose 10% of banked score" — so route-picking carries real variance
  instead of the current model where every round's outcome is fully knowable
  from `roundTarget` before it starts.
- Shop-node placement as a route decision (Slay the Spire pathing): once an
  economy exists (see 01:37 entry), place shop access as a route-gated node
  rather than a between-round guarantee, so skipping a lane also means
  skipping the reroll/upgrade opportunity that lane held. Ties the two
  missing systems (path + shop) into one lever instead of two independent
  gaps.

Sources: [GlyphShuffle — Best Roguelike Deckbuilders Where Map Pathing Matters](https://glyphshuffle.com/blog/best-roguelike-deckbuilders-map-pathing), [Summer Engine — How to Make a Deckbuilder Like Slay the Spire](https://www.summerengine.com/blog/make-a-deckbuilder-like-slay-the-spire)

## 2026-09-13 01:37 — Angle: economy/shop tension

Current state: no shop, currency, or purchase mechanic exists anywhere in the repo.
`relics.js` defines a fixed `POOL`/`STARTER_RELICS` set carried into `createRun`
with no acquisition step; `run.js` has no between-round or between-act decision
point at all — round N always flows straight into round N+1 with zero player
agency over the build.

- Currency-per-word shop (Balatro): award steel-equivalent gold per round based on
  performance (plays remaining, score margin over target), spendable between
  rounds on relics, rerolls, or hand-size upgrades. Wordsmith's relic set is
  static from run start, so there's no build-crafting loop and no reward for
  overperforming a target beyond banked score.
- Reroll-cost tension (Slay the Spire card rewards): offer 3 relic choices post-
  boss with an escalating reroll price, so a bad draft is a real cost, not free
  browsing. Currently relics (grep: `POOL` in relics.js) are either fixed
  starters or presumably free/random — no economic decision ever forces a
  keep-or-pay call.
- Vouchers / permanent shop upgrades (Balatro): a rare purchasable that
  permanently discounts future purchases or unlocks a second relic slot,
  creating a meta-decision of spend-now-for-a-worse-hand vs save-for-a-power-
  spike. Wordsmith's relic slots (STARTER_RELICS) are fixed for the whole run
  with no expansion path to buy into.
- Risk-reward bag insurance (Monster Train blight-vs-reward gambles): let the
  player pay gold to remove a specific low-value tile from the bag before a
  round, trading currency for a thinner, higher-average draw. Currently
  `dealBag`/`refill` in run.js give the player zero control over bag contents at
  any price — the draw is pure rng with no economic lever.
- Sell-back liquidity (Slay the Spire relic/card removal services): let a relic
  be sold back for partial gold if a build pivot is needed after a boss rule
  invalidates it (e.g. `maxOneVowel` zeroing vowelMult). Right now a bad relic
  fit (BOSS_RULES in run.js) has no recovery path — it's dead weight for the
  rest of the run with no currency system to buy out of it.

Sources: [Rogueliker — Roguelike Deckbuilders](https://rogueliker.com/roguelike-deckbuilders/), [Choost Games — Slay the Spire vs Balatro](https://choostgames.com/blog/slay-the-spire-vs-balatro/)

## 2026-09-13 07:37 — Angle: cross-run meta-progression

Current state: `createRun(seed, { relics = [] })` (run.js) takes a fresh seed and a
fixed starter relic list every call with zero persisted state between calls; no
save file, unlock table, or currency carries from one run's `state.score`/loss
into the next run's `createRun` args anywhere in the repo.

- Meta-currency unlock shop (Hades House Contractor): bank a fraction of each
  run's final `state.score` into a persistent currency spent between runs on
  permanent unlocks (new POOL relics, a starting hand-size bump). Wordsmith's
  `STARTER_RELICS` and `POOL` are the same fixed set on run 1 and run 100 — a
  loss returns nothing to build on next attempt.
- Pelt/trade unlock track (Inscryption): award a run-specific token on boss
  clear (not just score) redeemable for a new relic or hand slot at the next
  `createRun`, so clearing act 2's boss for the first time permanently expands
  what run 2 can draft from. Currently `BOSS_RULES` clears grant nothing beyond
  continuing to round 1 of the next act — no persistent trace of the win.
- Failure-informed knowledge loop (Inscryption puzzle carryover): surface the
  exact boss rule and target that ended the run on the game-over screen so the
  next `createRun` call can be seeded with that knowledge in mind, turning a
  loss into informed prep rather than a blind restart. Wordsmith currently has
  no game-over state capture at all — `playWord` just stops returning `ok`.
- Heat-style opt-in stakes (Hades Pact of Punishment): let a player raise
  `ACT_BREAK_SCALE` or shrink `HAND_SIZE` by choice before a run in exchange for
  a bigger unlock-currency payout, so a player who's outgrown the base curve
  has a lever instead of a flat wall. Both constants are hardcoded exports with
  no per-run override surface today.
- Narrative-gated relic reveal (Inscryption cabin unlocks): gate a subset of
  `POOL` behind a specific prior-run condition (e.g. win with zero relics, or
  clear the vowel-boss without vowelMult) rather than exposing the full pool
  from run 1, so mastery is rewarded with new toolkit pieces instead of only
  score. Every POOL entry is available to every run today regardless of history.

Sources: [Gamerant — Roguelite Games With The Best Progression Systems](https://gamerant.com/roguelite-games-with-best-progression-systems/), [Medium — Going Rogue: Inscryption](https://medium.com/@gwenckatz/going-rogue-inscryption-415a6a3a8358)

## 2026-09-13 08:37 — Angle: bag thinning, consumables, and explicit loss stakes

Current state: `dealBag`/`refill` (run.js) never remove a tile once dealt — the bag
only shrinks by draw and grows by nothing, no purchase or reward ever prunes a
weak tile out of circulation. `playWord` has no `state.lost`/game-over flag at
all; failing to hit `roundTarget` by round's end is never checked or recorded
anywhere in run.js, and no item exists outside the fixed `relics` array — no
one-shot consumable of any kind.

- Bag thinning as a reward (Slay the Spire card removal service): let a round
  win offer "permanently remove one tile from the bag" instead of only banking
  score, so the draw pool gets denser in good letters over a run. `dealBag`
  currently deals a static distribution with zero removal hook — bad tiles
  ride the whole run.
- One-shot consumables separate from relics (Slay the Spire potions / Balatro
  Tarot-Spectral cards): a small inventory of single-use items ("swap your
  hand for a fresh draw," "force a vowel tile into hand") spent on a single
  `playWord` call, distinct from the always-on `relics` array. Wordsmith has
  exactly one item class (permanent relics); no expendable, situational lever
  exists for a bad hand.
- Explicit loss/permadeath state (Slay the Spire death, Balatro blind failure):
  check `roundTarget` against `state.score` when `plays` hits 0 and set a real
  `state.lost = true` that halts the run, rather than `playWord` just running
  out of plays with no fail signal ever raised. Currently nothing in run.js
  reads `roundTarget` against banked score at all — there is no code path
  where a round can be lost.
- Randomized boss-order variance (Balatro random Boss Blind per ante): draw
  which `BOSS_RULES` entry fires each act from the pool at run start instead
  of a fixed/predictable assignment, so relic drafting has to hedge against
  unknown boss constraints. `BOSS_RULES` currently reads as a static keyed
  object with no per-run selection logic tying an entry to a given act.

Sources: [Rogueliker — Roguelike Deckbuilders](https://rogueliker.com/roguelike-deckbuilders/), [Summer Engine — Games Like Balatro](https://www.summerengine.com/blog/games-like-balatro)

## 2026-09-13 — Angle: relic rarity tiers and weighted draft pools

Current state: `relics.js`'s `POOL` is a flat, unweighted object (vowelMult, bookend,
longhand, ballast, foundation, jeweler, merchant, gambit, etc.) with no rarity
field or draw-weight anywhere; every entry is equally available every time a
relic is offered, and `STARTER_RELICS` hands the same fixed set to run 1 and
run 100. No POOL entry is flagged as scarce, build-defining, or improbable.

- Four-tier rarity with weighted odds (Balatro common/uncommon/rare/legendary,
  70/25/5% shop odds, legendary locked behind a separate unlock): tag each
  POOL entry with a rarity and roll offers off that weighting instead of a flat
  random pick. Wordsmith's undifferentiated POOL means a draft offer carries no
  anticipation curve — every relic feels the same weight walking in, so there's
  no "did I get the good pull" tension a rarity readout creates.
- Power-inverted rarity (Balatro's Cavendish/Vampire pattern — common relics
  that outperform rares): deliberately make one or two "common" POOL entries
  (e.g. longhand's flat +20 steel) stronger in practice than a flashier "rare"
  tag, so players learn to read hooks instead of chasing rarity color. Current
  POOL entries carry no rarity signal at all, so this contrarian-power pattern
  literally cannot exist yet — there's nothing to invert.
- High-risk/high-reward rare tier (Balatro rare-tier design: strong but harder
  to trigger): reserve a rarity band for relics whose `hook(ctx)` condition is
  materially harder to satisfy than bookend/vowelMult (e.g. requires a 9-letter
  word using every hand tile) in exchange for a bigger `xMult`. `score()`'s
  three-tier addSteel/addMult/xMult pass has room for this today but relics.js
  never builds toward it — every hook currently fires on a common, low-bar
  condition (any vowel, any palindrome-ish bookend).
- Build-defining legendary, drafted not shopped (Balatro Soul-card legendaries,
  0% normal shop odds): add a rarity tier that never appears in a normal relic
  offer and only surfaces via a specific triggered event (e.g. clearing a boss
  with zero relics held), designed to warp the rest of the run's build rather
  than incrementally improve it. `createRun`'s `relics` param and POOL today
  have no such gated, run-altering entry — the strongest available relic is
  reachable by the same random offer as the weakest.
- Rarity-as-telegraph on offer screens (Balatro's color-coded card back):
  surface each offered POOL entry's rarity tag alongside its `label` string
  at draft time, so a weak roll is legible before commit instead of every
  relic reading as equally plausible. `relics.js` labels (e.g. `'+1 mult per
  vowel'`) currently carry effect text only, with no scarcity or tier cue for
  the player to weigh against an unseen alternative.

Sources: [Balatro Wiki — Jokers rarity tiers](https://balatrogame.fandom.com/wiki/Jokers), [Balatro Wiki — Rare Jokers](https://balatrowiki.org/w/Rare_Jokers)

## 2026-09-13 — Angle: simultaneous multi-lane pressure (Monster Train's floors)

Current state: `roundTarget` (run.js) returns a single scalar per round, checked as
one number against `state.score`; `BOSS_RULES` applies exactly one constraint
object per boss encounter (`playWord`'s `boss.allows`/`boss.targetScale` take a
single entry); `PLAYS_PER_ROUND` is a flat 4 for every round in every act. Every
round is a single lane, single meter, single deadline — no round ever asks the
player to satisfy two independent pressures with the same hand of plays.

- Dual-threshold round (Monster Train's simultaneous floor defense): split
  `roundTarget` into two independent floors that must both clear by round end
  — e.g. a steel total AND a minimum distinct-letter-tile-used count — instead
  of the current single `Math.round(base * scale)` number. Wordsmith's round
  loss condition (once implemented) would otherwise stay a single meter, so a
  strong play on one axis can't paper over neglect of the other the way a
  Monster Train run can't win by defending only one floor.
- Stacked boss constraints (Monster Train multi-floor simultaneous threats):
  have a boss round apply two `BOSS_RULES` entries at once (e.g. `minLength`
  AND `maxOneVowel` together) rather than the current model where `playWord`
  only ever receives one `boss` object. `BOSS_RULES` today is a flat keyed
  object with callers passing a single entry — no stacking path exists, so
  boss rounds cap out at one constraint's worth of difficulty regardless of
  act depth.
- Split scoring lane per play (Monster Train's per-floor resource split, e.g.
  Pyregel/Vigor): route each `playWord` call's letters into two separate
  running totals — a "steel lane" (current `score()` output) and a "combo
  lane" (e.g. cumulative vowel count) that only pays off if it clears its own
  threshold by round end. `score()` currently produces one `total` consumed
  by one `state.score` — there's no second ledger a single play has to feed
  simultaneously, so hand-building only ever optimizes one number.
- Shrinking-lane play budget (Monster Train's floor collapse pressure): drop
  `PLAYS_PER_ROUND` by one for each round past the first within an act (4, 3,
  2 plays into the boss) instead of the current flat 4 every round, so late-
  act efficiency has to rise turn-over-turn the way a collapsing Monster
  Train floor forces tighter defense each stop. `PLAYS_PER_ROUND` is a single
  exported constant applied uniformly — no round-relative decay exists today.

Sources: [Digitally Downloaded — Monster Train Developer Q&A](https://www.digitallydownloaded.net/2020/02/developer-q-a-monster-train-a-deckbuilding-roguelike-with-a-hellish-theme.html), [TheBigBois — Monster Train 2: A Masterclass in Roguelike Design](https://thebigbois.com/strategy/monster-train-2-its-a-masterclass-in-roguelike-design/)

## 2026-09-13 — Angle: word-category leveling (Balatro poker-hand/planet-card design)

Current state: `score()` (scoring.js) treats every legal word identically — one
`tileSum(word) + lengthBonus(word)` steel base plus relic hooks, with no
categorization of *what kind* of word was played. `RELICS`/POOL entries key off
generic word properties (vowel count, first/last letter, length >= 7) but no
category ever levels up or persists a base-value table; a 7-letter word today
scores the same relative to a 3-letter word on run 1 as it does on run 50.

- Word-shape hand tiers with independent base tables (Balatro poker hands):
  define discrete categories (e.g. palindrome, all-consonant, double-letter,
  anagram-of-played, alphabetical-run) each with its own starting
  steel/mult pair, scored instead of (or alongside) the flat `tileSum` +
  `lengthBonus` in `score()`. Wordsmith's single steel formula means every
  word competes on the same axis; category tiers would give the player
  build identity in *what kind* of word to hunt for, not just letter value.
- Planet-card-style leveling per category (Balatro Planet cards): a rare
  drop that permanently bumps one category's base steel/mult by a flat
  amount and increments its level counter, so a run's mid-game strength is
  measured by which categories got leveled, not just which relics were
  drafted. `state.inventory`/`modifiers` (run.js) currently hold relics and
  draft modifiers only — no per-category persistent table exists to level.
- Rarity-scaled growth (Balatro's harder hands gain more per level): tie a
  category's per-level gain to its play-rate difficulty (a common shape
  like "ends in s" gains little per level, a rare shape like "palindrome"
  gains a lot), so chasing a leveled rare category becomes a real build
  payoff instead of every category being equally worth investing in.
  Nothing in `scoring.js` currently differentiates hook difficulty by payout
  scale — `bookend`'s x2 and `vowelMult`'s +1/vowel are hand-tuned constants,
  not part of a growable, comparably-scaled category system.
- Category discovery as a run reveal (Balatro hand types being visible from
  turn 1 but Planet cards being drop-gated): show all category definitions
  from run start but gate the *leveling* currency behind boss clears or
  shop buys, so early rounds are about learning which shapes exist and late
  rounds are about compounding the ones a build committed to. Wordsmith has
  no discovery curve at all today — the full relic POOL and scoring formula
  are static and fully known from the tutorial onward.

Sources: [Balatro Wiki — Poker Hands](https://balatrogame.fandom.com/wiki/Poker_Hands), [games.gg — Balatro Planet Cards Guide](https://games.gg/balatro/guides/balatro-planet-cards-guide/)

## 2026-09-13 13:38 — Angle: boss debuff variety as anti-overspecialization design

Current state: `BOSS_RULES` (run.js) holds exactly three entries — `minLength`,
`noRepeatLong`, `maxOneVowel` — all gating *which words are legal*, none touching
a held relic's output directly; `drawBoss` picks uniformly from those three per
act, so the pool repeats from act 4 with no growth. `score()` (scoring.js)
resolves `addSteel`/`addMult`/`xMult` from `RELICS`/POOL with no boss-side hook
that ever zeroes or debuffs a specific relic category (vowel-scoring,
length-scoring, xMult-scoring) the way a build can be punished for
overspecializing. A player who drafts three vowelMult-style relics never faces
a boss that targets that choice — only `maxOneVowel` brushes it, and only by
capping mult, not by disabling the relic outright.

- Category-targeted relic debuff (Balatro The Eye/Plant/Goad pattern — punish
  the build, not just the word): a boss rule that zeroes a relic's `hook`
  output for the round if its `id`/tag matches a targeted category (e.g. "vowel
  relics score nothing this boss"), read via `scoringRelics(state.inventory)`
  in `playWord`. Current `BOSS_RULES` entries only ever filter `allows(word)`;
  none ever reach into `relics` to disable a drafted choice, so overinvesting
  in one relic archetype (three vowelMult-family picks) carries zero
  additional boss risk today.
- Dual-stat debuff (Balatro The Flint — both chip and mult cut at once): a
  boss that scales down `steel` *and* `mult` simultaneously in `score()`
  rather than the current single-lever `targetScale` (which only discounts
  the target, never the scoring formula itself). `maxOneVowel`'s
  `targetScale: 0.8` softens the finish line; it never touches how
  `tileSum`/`lengthBonus`/relic mult actually compute, so no boss currently
  attacks the core formula.
- Rack-visibility debuff (Balatro The Fish — increasing face-down cards):
  a boss that hides or obscures `state.rack` tile values for the round
  (display only, letters still play) so hand-planning degrades under
  pressure instead of every rack tile being fully known at all times, as it
  is in every `refill()`/`playWord` call today.
- Anti-repeat-category boss (Balatro The Eye — no repeated hand type): extend
  `noRepeatLong`'s "no repeating a played word" idea to "no repeating a played
  word *shape*" (e.g. two bookend words in a row), forcing variety within a
  round rather than only across the whole run. Current `noRepeatLong` checks
  literal word repetition (`state.played.includes(word)`), not category
  repetition, so a build can lean on one winning shape all boss round with
  zero friction.
- Growing boss pool with thematic pairing (Balatro's ante-scaled boss variety
  vs Wordsmith's fixed 3-entry `BOSS_IDS`): add new `BOSS_RULES` entries as
  acts climb instead of cycling the same three from act 4 onward, each keyed
  to counter a specific relic archetype in `relics.js`/POOL by design (a
  "no addSteel relics" boss vs a "no xMult relics" boss) so late-run drafting
  has to hedge against boss variety the way `drawBoss`'s flat uniform pick
  over three IDs never requires.

Sources: [balatrocalculator.blog — Balatro Boss Blinds Guide](https://balatrocalculator.blog/blog/balatro-boss-blinds-guide/), [Balatro Wiki — Negative Effects](https://balatrowiki.org/w/Negative_Effects)
