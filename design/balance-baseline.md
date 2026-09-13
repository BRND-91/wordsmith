# Balance baseline

`npm run smoke -- 500 8`: 500 seeded runs, greedy bot (highest-scoring legal
word, priciest affordable relic, first draft option, consumables burned on
sight), 3 starter relics. Odd seeds run the mixed lane policy (elite on odd
acts, safe on even), even seeds stay safe every act. Elite grants its relic on
the lane pick, so it is held for rounds 2-3 under the boss rule. The act-4 pool
adds three debuff bosses (vowelBlight, flint, noRepeatShape) alongside the three
word-legality bosses, so the boss mix widens from act 4 on. Rerun after any
retune and diff against this table.

```
act  entered  cleared   rate   lost r1  r2  r3 boss
  1      500      403   0.81         2   8  20  67
  2      403      335   0.83         2   2  11  53
  3      335      272   0.81         5   6  19  33
  4      272      198   0.73         4  10  18  42
  5      198      134   0.68         3   9  21  31
  6      134       94   0.70         4   5   9  22
  7       94       67   0.71         1   9   7  10
  8       67       50   0.75         3   1   5   8
cleared act 8: 50/500  stuck (no word): 104  mean relics: 13.5  mean curses held at end: 1.92
draft picks: deep=223 lean=232 tithe=245 gauntlet=263 bulwark=236 hexed=237
lane policy mixed: cleared act 8 13/250  mean act reached 3.65  mean relics 11.0  stuck 59  lost under: noRepeatLong=7 plain=49 minLength=57 maxOneVowel=82 vowelBlight=22 flint=15 noRepeatShape=5
lane policy safe: cleared act 8 37/250  mean act reached 4.56  mean relics 15.9  stuck 45  lost under: flint=16 minLength=56 plain=58 maxOneVowel=52 vowelBlight=24 noRepeatLong=7
boss round by lane (entered/died/rate, mean gold on entry)
  elite 60/438 (0.14)  gold 66.9  minLength=18/120 (0.15)  maxOneVowel=33/117 (0.28)  noRepeatLong=5/159 (0.03)  noRepeatShape=0/22 (0.00)  flint=2/13 (0.15)  vowelBlight=2/7 (0.29)
  safe  206/1381 (0.15)  gold 81.3  minLength=72/380 (0.19)  noRepeatLong=8/366 (0.02)  maxOneVowel=69/378 (0.18)  noRepeatShape=2/84 (0.02)  vowelBlight=32/80 (0.40)  flint=23/93 (0.25)
deaths by lane and round (r2 r3 boss)
  elite   27   50   60  pre-boss under: minLength=23 maxOneVowel=32 vowelBlight=12 noRepeatShape=3 flint=6 noRepeatLong=1
  safe    23   60  206  pre-boss under: plain=83
```

Reading it:
- maxOneVowel now scores at 0.5 of target and sits at parity: safe boss rate 0.18
  vs minLength 0.19, elite 0.28 (elite plays the rule rounds 2-3, not just the
  boss). It no longer dominates the loss table on either lane, and acts 1-3 clear
  at 0.81-0.83 with the wall gone.
- Safe still dies at the boss: 206/(23+60+206)*100 = 71.28 percent of its deaths
  land on round 4. Rounds 1-3 stay a formality for the bot on flat targets.
- Elite still dies before the boss: (27+50)/(27+50+60)*100 = 56.20 percent of its
  deaths are rounds 2-3, and 32/77*100 = 41.56 percent of those are under
  minLength, now the harshest word-legality gate the elite lane carries early.
- vowelBlight is the new outlier on safe at 0.40 (32/80), with flint at 0.25. The
  act-4 debuff bosses are where the difficulty moved once maxOneVowel came down,
  so they are the next tuning lever, not maxOneVowel.
- The mixed policy clears act 8 13/250 against safe's 37/250, at a lower mean act
  (3.65 vs 4.56). The elite lane closed some of the gap but still trails, so the
  event node has no lane to live in yet.
- 104/500*100 = 20.80 percent of runs stuck with no legal word at least once;
  refresh and the whole-rack exchange recover most, the rest forfeit the round.
- Draft picks are flat because the bot takes option one; the counts show only
  that every modifier reaches the draft evenly.
