# Nav map (wordsmith)

Symbol->line index for /opt/brendbot/projects/wordsmith. Grep the symbol here,
then Read the file with offset near that line and a tight limit; never open a
big file whole. Line numbers drift on edit: treat as "grep near here" and
confirm with a targeted Grep on the symbol before reading. Rebuild with
`npm run navmap`.

A `TABLE.key` entry is a 2-space-indented object key inside that top-level
const (a relic in POOL, a boss in BOSS_RULES, a modifier in MODIFIERS).

## test/run.test.js (612 lines)
`pass`:47 `check`:48 `clearRound`:55

## src/relics.js (457 lines)
`ARCHETYPES`:6 `RARITY`:16 `RARITY_WEIGHT`:23 `RARE_TILES`:30 `countVowels`:32 `countConsonants`:38 `distinctVowels`:42 `distinctRareTiles`:48 `noRepeatedLetters`:54 `hasDoubleLetter`:58 `isPalindrome`:63 `POOL`:83 `POOL.longhand`:85 `POOL.vowelMult`:86 `POOL.bookend`:87 `POOL.ballast`:90 `POOL.foundation`:97 `POOL.polysyllable`:104 `POOL.keystone`:111 `POOL.novella`:118 `POOL.marathoner`:125 `POOL.tally`:132 `POOL.prospector`:141 `POOL.vein`:148 `POOL.highroller`:155 `POOL.numismatist`:163 `POOL.smelter`:171 `POOL.goldrush`:178 `POOL.aria`:188 `POOL.cascade`:195 `POOL.diphthong`:202 `POOL.sonorant`:209 `POOL.chorus`:216 `POOL.staccato`:225 `POOL.cadence`:232 `POOL.symmetry`:239 `POOL.lexicographer`:248 `POOL.consonance`:255 `POOL.jeweler`:262 `POOL.hoard`:272 `POOL.gambit`:280 `POOL.ascetic`:288 `POOL.temperance`:295 `POOL.mirror`:304 `POOL.crucible`:311 `POOL.prism`:318 `POOL.merchant`:327 `POOL.tycoon`:334 `POOL.appraiser`:341 `POOL.speculator`:348 `POOL.coupon`:355 `POOL.haggler`:362 `POOL.anchor`:371 `POOL.glasscannon`:378 `POOL.hermit`:385 `POOL.taxman`:392 `POOL.miser`:400 `POOL.momentum`:409 `POOL.collector`:416 `POOL.whetstone`:429 `POOL.philosopher`:441 `poolByTag`:450 `poolByRarity`:454

## src/run.js (428 lines)
`RACK_SIZE`:18 `PLAYS_PER_ROUND`:19 `ROUNDS_PER_ACT`:20 `TELEGRAPH_LEAD`:22 `NEAR_MISS_SCALE`:26 `NEAR_MISS_CURSES`:27 `ACT1_TARGETS`:33 `ACT1_BOSS`:34 `ACT_BREAK_SCALE`:35 `actTargets`:37 `countVowels`:45 `hasDoubleLetter`:51 `wordShape`:59 `SHAPE_LOCKS`:66 `BOSS_RULES`:74 `BOSS_RULES.minLength`:75 `BOSS_RULES.noRepeatLong`:81 `BOSS_RULES.maxOneVowel`:92 `BOSS_RULES.vowelBlight`:106 `BOSS_RULES.flint`:117 `BOSS_RULES.noRepeatShape`:127 `LANES`:146 `LANE_ROUND`:147 `ELITE_TARGET_SCALE`:151 `eligibleBossIds`:155 `drawBoss`:161 `createRun`:166 `recycleBag`:186 `handSize`:191 `playsPerRound`:195 `takeFromRack`:201 `refill`:211 `activeBoss`:218 `telegraph`:225 `roundTarget`:229 `playCtx`:243 `playWord`:247 `commitPlay`:279 `exchangeTiles`:294 `exchangeCurses`:316 `useItem`:325 `pickModifier`:335 `pickLane`:350 `grantEliteRelic`:364 `endRound`:382

## src/ui/GameScreen.js (370 lines)
`STARTER_RELICS`:25 `freshRun`:27 `GameScreen`:35 `styles`:346

## test/economy.test.js (233 lines)
`pass`:29 `check`:30 `STARTERS`:36 `clearRound`:40

## test/persistence.test.js (223 lines)
`pass`:14 `check`:15 `WORDS`:21 `dict`:22 `RELIC_IDS`:23 `freshRun`:25 `clearRound`:87

## src/shop.js (209 lines)
`CLEAR_BOUNTY`:11 `OVERFLOW_STEP`:12 `OVERFLOW_BAND`:13 `overflowBands`:15 `encounterReward`:22 `REROLL_BASE`:35 `REROLL_STEP`:36 `rerollCost`:38 `SHOP_SIZE`:44 `weightedIndex`:48 `rollShop`:63 `RELIC_PRICE`:84 `REMOVE_PRICE`:85 `UPGRADE_PRICE`:86 `UPGRADE_STEP`:87 `SELL_RATE`:88 `CONSUMABLE_PRICE`:89 `CHEAP_RELIC_TIER`:92 `CHEAP_RELIC_CURSES`:93 `relicPrice`:95 `sellPrice`:101 `shopSeed`:107 `ownedIds`:111 `openShop`:115 `spend`:124 `rerollShop`:130 `buyRelic`:141 `buyConsumable`:155 `sellRelic`:166 `removeTile`:177 `upgradeTile`:188 `leaveShop`:198 `ASCENSION`:204

## src/ui/ShopScreen.js (206 lines)
`SERVICE`:24 `ShopScreen`:33 `styles`:179

## tools/balance-smoke.mjs (186 lines)
`RUNS`:23 `MAX_ACT`:24 `STARTERS`:25 `MAX_WORD`:27 `dict`:29 `anagrams`:33 `candidates`:42 `bestPlay`:60 `shopPolicy`:70 `playRun`:78 `t0`:124 `results`:125 `ms`:127 `pad`:129 `finished`:140 `stuck`:141 `meanRelics`:142 `meanCurses`:143 `picks`:144 `visits`:160

## test/relics.test.js (175 lines)
`pass`:12 `check`:13 `HOOKED`:19 `OUTPUT_KEYS`:20 `FIXTURE`:24

## src/ui/HelpScreen.js (152 lines)
`BAG_TOTAL`:19 `NEAR_MISS_PCT`:20 `ELITE_PCT`:21 `LENGTHS`:22 `valueGroups`:24 `SECTIONS`:30 `HelpScreen`:119 `styles`:142

## test/meta.test.js (148 lines)
`pass`:22 `check`:23

## src/presenter.js (126 lines)
`createSelection`:15 `pickTile`:19 `unpickTile`:25 `pickLetter`:34 `selectedWord`:40 `canSubmit`:48 `STEP`:52 `LEN_STEP1`:63 `LEN_STEP2`:64 `LEN_FIRST_INDEX`:65 `LEN_STEP2_INDEX`:66 `resolveTimeline`:74 `timelineTotal`:120

## src/save.js (119 lines)
`SCHEMA_VERSION`:18 `KEYS`:19 `bodyOf`:21 `encodeSave`:51 `decodeSave`:57 `commitSave`:107 `loadSave`:114

## src/ui/ResolutionOverlay.js (108 lines)
`STEP_MS`:6 `XMULT_MS`:7 `ResolutionOverlay`:13 `round2`:71 `displaySteel`:75 `displayMult`:80 `caption`:85 `styles`:97

## src/ui/theme.js (89 lines)
`SHAPES`:7 `SHAPES.steel`:8 `SHAPES.mult`:9 `MULT_GLYPH`:12 `FONT`:19 `PANEL`:27 `BUTTON`:28 `BUTTON_TEXT`:29 `HEADING`:30 `BODY`:31 `palette`:36 `palette.light`:37 `palette.dark`:54 `themeFor`:73 `ROMAN`:77 `roman`:81

## App.js (88 lines)
`openStore`:24 `DUMP_MODE`:31 `SaveDump`:33 `App`:49 `styles`:82

## test/presenter.test.js (87 lines)
`pass`:18 `check`:19 `WORDS`:25 `dict`:26

## src/share.js (86 lines)
`b64urlEncode`:17 `b64urlDecode`:21 `buildSharePayload`:27 `encodeShare`:39 `decodeShare`:43 `verifyShare`:61

## src/scoring.js (82 lines)
`RELICS`:15 `RELICS.vowelMult`:16 `RELICS.bookend`:25 `RELICS.longhand`:31 `freshPlay`:40 `slot`:44 `hookCtx`:48 `score`:54 `settlePlay`:76

## tools/gen-nav-map.mjs (77 lines)
`ROOT`:9 `OUT`:10 `DIRS`:11 `EXT`:12 `HEADER`:14 `TOP`:27 `KEY`:29 `index`:31 `files`:49 `parts`:60 `indexed`:61 `entries`:62

## src/modifiers.js (73 lines)
`DRAFT_SIZE`:8 `MODIFIERS`:10 `MODIFIERS.lean`:11 `MODIFIERS.deep`:17 `MODIFIERS.tithe`:23 `MODIFIERS.hexed`:29 `MODIFIERS.bulwark`:35 `MODIFIERS.gauntlet`:41 `IDS`:49 `drawDraft`:53 `sumField`:62 `productField`:68

## test/dictionary.test.js (72 lines)
`pass`:12 `check`:13 `WORDS`:19 `RANKS`:20

## src/ui/BagPanel.js (70 lines)
`LETTERS`:7 `BagPanel`:14 `styles`:57

## src/ui/db.js (70 lines)
`RUN_MAIN`:11 `RUN_TMP`:12 `initDb`:14 `saveRun`:25 `loadRun`:34 `clearRun`:41 `recordHighScore`:45 `loadScoreboard`:53 `getMeta`:58 `setMeta`:63

## src/consumables.js (68 lines)
`CONSUMABLE_SLOTS`:8 `toBottom`:11 `CONSUMABLES`:15 `CONSUMABLES.refresh`:16 `CONSUMABLES.vowel`:26 `CONSUMABLES.freeplay`:42 `CONSUMABLE_IDS`:49 `useConsumable`:54

## src/ui/TileRack.js (65 lines)
`IRON_EDGE`:8 `IRON_LIGHT`:9 `IRON_SHADE`:10 `IRON_INK`:11 `BONE_LIGHT`:12 `Tile`:18 `TileRack`:46 `styles`:57

## src/ui/sprites.js (65 lines)
`RELIC_SPRITES`:3 `BOSS_SPRITES`:55 `CURSE_SPRITE`:64

## src/bag.js (61 lines)
`DISTRIBUTION`:8 `makeBag`:14 `fillBag`:22 `countTiles`:27 `removeOne`:34 `CURSE`:44 `isCurse`:46 `addCurses`:50 `countCurses`:56

## tools/build-dictionary.mjs (56 lines)
`RANK_CAP`:12 `WORDS_OUT`:16 `RANKS_OUT`:17 `alphaOnly`:19 `buildWords`:21 `buildRanks`:32 `words`:48 `ranks`:51

## src/ui/db.web.js (52 lines)
`PREFIX`:9 `BOARD_KEY`:10 `META_PREFIX`:11 `initDb`:13 `saveRun`:21 `loadRun`:25 `clearRun`:29 `recordHighScore`:34 `loadScoreboard`:40 `getMeta`:45 `setMeta`:49

## src/ui/RelicIcon.js (51 lines)
`RelicIcon`:9 `RelicCaption`:27 `styles`:45

## src/ui/RelicTray.js (51 lines)
`RelicTray`:9 `styles`:44

## test/scoring.test.js (50 lines)
`pass`:5 `check`:6

## src/frequency.js (47 lines)
`loadRanks`:10 `makeRanks`:22 `rankOf`:26 `byCommonness`:32 `isCommonEnough`:42

## src/ui/TopReadout.js (46 lines)
`TopReadout`:9 `styles`:34

## src/inventory.js (41 lines)
`createInventory`:10 `addRelic`:16 `removeRelic`:23 `relicList`:28 `scoringRelics`:34 `econRelics`:38

## src/letters.js (41 lines)
`TILE_VALUES`:3 `VOWELS`:9 `LEN_TIER1`:14 `LEN_TIER2`:15 `lengthBonus`:17 `tileSum`:25 `RULESET_STRING`:36 `RULESET_HASH`:40

## src/ui/WordStrip.js (39 lines)
`WordStrip`:10 `styles`:33

## src/highscores.js (36 lines)
`makeScoreboard`:5 `record`:14 `best`:23 `bestOverall`:27 `toRows`:33

## src/ui/assets.js (35 lines)
`readAsset`:11 `loadGameData`:18

## src/dictionary.js (31 lines)
`MIN_LEN`:3 `loadDictionary`:8 `makeDictionary`:18 `isValid`:27

## src/rng.js (26 lines)
`mulberry32`:6 `shuffle`:18

## src/hash.js (16 lines)
`FNV_OFFSET`:5 `FNV_PRIME`:6 `fnv1a`:8
