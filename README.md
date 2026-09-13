# Wordsmith

Word-building roguelike. Spell words from a letter bag, score them through relics and modifiers, beat boss rounds, spend coin in the shop. Headless game core in plain JS with an Expo/React Native shell on top.

## Layout

- `src/` game core: `run.js` (round loop), `scoring.js`, `relics.js` (`POOL`), `modifiers.js`, `shop.js`, `bag.js`, `letters.js`, `dictionary.js`, `save.js`, `presenter.js`, `src/ui/` (RN screens)
- `test/` node tests, no framework, `npm test`
- `tools/` dictionary builder, balance smoke run, sprite generators, nav-map generator
- `design/` stage docs, balance baseline, research notes, sprite sheets
- `notes/nav-map.md` symbol-to-line index of the whole tree; grep it before opening a file
- `assets/` ENABLE word list, rank table, sprites, favicon

## Commands

```
npm install
npm test            # all unit tests
npm run smoke       # balance smoke: N seeded greedy-bot runs, clear rate per act (args: runs maxAct)
npm run build:dict  # regenerate assets/words.txt from ENABLE
npm run navmap      # regenerate notes/nav-map.md after adding symbols
npm start           # expo dev server (web/android/ios)
```

## Iterating

Read `notes/nav-map.md` first, then `design/balance-baseline.md` for the numbers the smoke run is held against. A relic change is a `POOL` entry in `src/relics.js` plus a case in `test/relics.test.js`; run `npm test` then `npm run smoke` and compare against the baseline before opening a PR.
