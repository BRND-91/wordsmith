import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, Image, Pressable, StyleSheet, Platform } from 'react-native';
import { BOSS_SPRITES } from './sprites.js';
import { saveRun, clearRun, recordHighScore, loadScoreboard } from './db';
import { best } from '../highscores.js';
import { buildSharePayload, encodeShare } from '../share.js';
import {
  createRun, playWord, playCtx, endRound, roundTarget, activeBoss, telegraph,
  exchangeTiles, pickModifier, useItem, pickLane, BOSS_RULES, ROUNDS_PER_ACT,
} from '../run.js';
import { createSelection, pickTile, pickLetter, unpickTile, selectedWord, canSubmit, resolveTimeline } from '../presenter.js';
import { POOL } from '../relics.js';
import { MODIFIERS } from '../modifiers.js';
import { relicList, scoringRelics } from '../inventory.js';
import { FONT, HEADING, BODY, PANEL, BUTTON, BUTTON_TEXT, roman } from './theme.js';
import TopReadout from './TopReadout.js';
import ShopScreen from './ShopScreen.js';
import HelpScreen from './HelpScreen.js';
import BagPanel from './BagPanel.js';
import TileRack from './TileRack.js';
import WordStrip from './WordStrip.js';
import RelicTray from './RelicTray.js';
import ResolutionOverlay from './ResolutionOverlay.js';

const STARTER_RELICS = [POOL.longhand, POOL.vowelMult, POOL.bookend];

function freshRun(seed) {
  return createRun(seed, { relics: STARTER_RELICS });
}

// Front end over the engine: run.js owns round, act, boss, and loss, and this
// screen only plays words and settles rounds through it. The run object is
// mutated in place, so it lives in a ref and a fresh seed swaps it; setState
// drives redraws off it. A saved run from launch takes the ref first.
export default function GameScreen({ theme, dict, db, saved }) {
  const [seed, setSeed] = useState(saved.ok ? saved.run.seed : 1);
  const runRef = useRef(null);
  if (!runRef.current) runRef.current = saved.ok ? saved.run : freshRun(seed);
  if (runRef.current.seed !== seed) runRef.current = freshRun(seed);
  const run = runRef.current;

  const [sel, setSel] = useState(() => createSelection(run.rack));
  const [timeline, setTimeline] = useState(null);
  const [rejected, setRejected] = useState(null);
  const [cleared, setCleared] = useState(null);
  const [confirmExchange, setConfirmExchange] = useState(false);
  const [endStats, setEndStats] = useState(null);
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [tick, force] = useState(0);
  const rerender = () => force((n) => n + 1);

  // Every engine mutation ends in rerender, so the tick is the save clock. A
  // lost run leaves storage and posts its total, so a relaunch after a loss
  // opens on a fresh run instead of the game-over screen.
  useEffect(() => {
    if (!run.lost) {
      saveRun(db, run);
      return;
    }
    clearRun(db)
      .then(() => recordHighScore(db, run.seed, run.score))
      .then(() => loadScoreboard(db))
      .then((board) => setEndStats({ best: best(board, run.seed), share: encodeShare(buildSharePayload(run)) }));
  }, [tick, seed, run, db]);

  const word = selectedWord(sel);
  const target = roundTarget(run);
  const boss = activeBoss(run);
  const warning = telegraph(run);

  const onSubmit = useCallback(() => {
    // Timeline first: playWord advances escalating relics, so a preview built
    // after it would show the next play's numbers.
    const steps = resolveTimeline(word, scoringRelics(run.inventory), run.tileBonus, playCtx(run));
    const res = playWord(run, word, dict);
    if (!res.ok) {
      setRejected(res.reason);
      return;
    }
    // A boss-blocked word has no score to animate: settle the round now and say
    // what it cost, so a spent play never reads as a silent no-op.
    if (res.blocked) {
      setRejected(`${word.toUpperCase()} breaks the boss rule (${res.blocked}): 0 points, play spent`);
      endRound(run);
      setSel(createSelection(run.rack));
      rerender();
      return;
    }
    setRejected(null);
    setTimeline(steps);
  }, [word, run, dict]);

  // Web keyboard: a letter key spells with the rack directly, Backspace drops the
  // last letter, Enter plays, Escape opens the menu. Registered on the document
  // so no textbox is needed; idle while the scoring overlay or any non-play
  // screen is up.
  const playing = !run.shop && !run.lost && !run.draft && !run.laneChoice && !timeline && !menu && !help;
  const submittable = canSubmit(word, dict);
  useEffect(() => {
    if (Platform.OS !== 'web' || !playing) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        setMenu(true);
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        pick((s) => pickLetter(s, e.key));
      } else if (e.key === 'Backspace') {
        pick((s) => unpickTile(s, s.picked.length - 1));
      } else if (e.key === 'Enter' && submittable) {
        onSubmit();
      } else {
        return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, submittable, onSubmit]);

  // A clearing play resets the score and, on the elite road, opens no shop, so
  // without this line the readout snaps to 0 / next target and the play reads
  // as scoring nothing.
  const onResolved = useCallback(() => {
    setTimeline(null);
    const scored = run.score;
    const wanted = roundTarget(run);
    const label = `Round ${roman(run.round)}`;
    const r = endRound(run);
    if (r.outcome === 'round' || r.outcome === 'act' || r.outcome === 'lane') {
      setCleared(`${label} cleared: ${scored} / ${wanted}, +${r.gold} gold`);
    }
    setSel(createSelection(run.rack));
    rerender();
  }, [run]);

  // Any rack change outside playWord drops the selection: its indices point at
  // tiles that may have left. The vowel item swaps the first picked tile.
  const apply = (fn) => {
    const r = fn();
    setRejected(r.ok ? null : r.reason);
    if (r.ok) setSel(createSelection(run.rack));
    setConfirmExchange(false);
    setCleared(null);
    rerender();
  };
  // Exchanging a selection that spells a playable word costs the play and scores
  // nothing, so it takes a second tap; the status line names the outcome either
  // way so a lost play never reads as a zero-point word.
  const onDiscard = () => {
    if (submittable && !confirmExchange) {
      setConfirmExchange(true);
      setRejected(`${word.toUpperCase()} is playable: exchange scores 0 & spends a play, tap again to exchange`);
      return;
    }
    const n = sel.picked.length;
    apply(() => exchangeTiles(run, sel.picked));
    setRejected(`exchanged ${n} tiles, 0 points`);
  };
  const pick = (fn) => { setConfirmExchange(false); setCleared(null); setSel(fn); };
  const onItem = (id) => apply(() => useItem(run, id, sel.picked[0] ?? -1));
  const onDraft = (id) => apply(() => pickModifier(run, id));
  const onLane = (lane) => apply(() => pickLane(run, lane));

  const restart = () => {
    const next = seed + 1;
    runRef.current = freshRun(next);
    setSel(createSelection(runRef.current.rack));
    setRejected(null);
    setEndStats(null);
    setMenu(false);
    setConfirmNew(false);
    setSeed(next);
  };
  const closeMenu = () => { setMenu(false); setConfirmNew(false); };

  const primary = [BUTTON, styles.wide, { backgroundColor: theme.accent, borderColor: theme.gold }];
  const secondary = [BUTTON, styles.wide, { backgroundColor: theme.surface, borderColor: theme.border }];

  if (help) {
    return <HelpScreen theme={theme} onBack={() => setHelp(false)} />;
  }

  // The menu is the one place a live run can be abandoned, so NEW RUN takes a
  // second tap; the first names what it throws away.
  if (menu) {
    return (
      <View style={[styles.end, { backgroundColor: theme.bg }]}>
        <Text style={[styles.endTitle, { color: theme.ink }]}>MENU</Text>
        <Text style={[styles.endDetail, { color: theme.subtle }]}>
          Seed {run.seed} · Act {roman(run.act)} · Round {roman(run.round)} · {run.gold} gold
        </Text>
        <Pressable onPress={closeMenu} style={primary}>
          <Text style={[BUTTON_TEXT, { color: theme.accentInk }]}>RESUME</Text>
        </Pressable>
        <Pressable onPress={() => { setMenu(false); setHelp(true); }} style={secondary}>
          <Text style={[BUTTON_TEXT, { color: theme.ink }]}>HOW TO PLAY</Text>
        </Pressable>
        <Pressable
          onPress={() => (confirmNew ? restart() : setConfirmNew(true))}
          style={[BUTTON, styles.wide, { backgroundColor: confirmNew ? theme.bad : theme.surface, borderColor: confirmNew ? theme.gold : theme.border }]}
        >
          <Text style={[BUTTON_TEXT, { color: confirmNew ? theme.accentInk : theme.ink }]}>
            {confirmNew ? 'ABANDON THIS RUN?' : 'NEW RUN'}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (run.shop) {
    return <ShopScreen theme={theme} run={run} onLeave={rerender} />;
  }

  if (run.lost) {
    const { act, round, score, target: failed, bossLabel } = run.lost;
    return (
      <View style={[styles.end, { backgroundColor: theme.bg }]}>
        <Text style={[styles.endTitle, { color: theme.bad }]}>FALLEN</Text>
        <Text style={[styles.endDetail, { color: theme.ink }]}>
          Act {roman(act)} · Round {roman(round)}: {score} / {failed}
        </Text>
        {bossLabel && <Text style={[styles.endDetail, { color: theme.subtle }]}>Boss: {bossLabel}</Text>}
        {endStats && (
          <>
            <Text style={[styles.endDetail, { color: theme.ink }]}>
              Best on seed {run.seed}: {endStats.best}
            </Text>
            <Text style={[styles.shareLabel, { color: theme.subtle }]}>SHARE CODE</Text>
            <Text selectable style={[styles.share, PANEL, { color: theme.subtle, borderColor: theme.border, backgroundColor: theme.surface }]}>
              {endStats.share}
            </Text>
          </>
        )}
        <Pressable onPress={restart} style={primary}>
          <Text style={[BUTTON_TEXT, { color: theme.accentInk }]}>NEW RUN</Text>
        </Pressable>
      </View>
    );
  }

  if (run.draft) {
    return (
      <View style={[styles.end, { backgroundColor: theme.bg }]}>
        <Text style={[styles.endTitle, { color: theme.ink }]}>ACT {roman(run.act)}</Text>
        <Text style={[styles.endDetail, { color: theme.subtle }]}>Pick one. It stays for the run.</Text>
        {run.draft.map((id) => (
          <Pressable
            key={id}
            onPress={() => onDraft(id)}
            style={[styles.draftCard, PANEL, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Text style={[styles.draftLabel, { color: theme.ink }]}>{MODIFIERS[id].label}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  if (run.laneChoice) {
    const cards = [
      ['elite', `${BOSS_RULES[run.boss].label} from now on. A free relic now. One shop, right before the boss.`],
      ['safe', 'Flat targets. Shops open.'],
    ];
    return (
      <View style={[styles.end, { backgroundColor: theme.bg }]}>
        <Text style={[styles.endTitle, { color: theme.ink }]}>ACT {roman(run.act)} ROAD</Text>
        {cards.map(([lane, detail]) => (
          <Pressable
            key={lane}
            onPress={() => onLane(lane)}
            style={[styles.draftCard, PANEL, { backgroundColor: theme.surface, borderColor: lane === 'elite' ? theme.accent : theme.border }]}
          >
            <Text style={[styles.draftTitle, { color: lane === 'elite' ? theme.accent : theme.ink }]}>{lane.toUpperCase()}</Text>
            <Text style={[styles.endDetail, { color: theme.subtle }]}>{detail}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  const bossRound = run.round >= ROUNDS_PER_ACT;
  const picked = sel.picked.length;
  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <TopReadout
        theme={theme} act={run.act} round={run.round} score={run.score} target={target} plays={run.plays} gold={run.gold}
        onMenu={() => setMenu(true)} onHelp={() => setHelp(true)}
      />
      {warning && (
        <View style={styles.bossRow}>
          <Image source={BOSS_SPRITES[run.boss]} style={[styles.bossIcon, { opacity: boss ? 1 : 0.55 }]} />
          <Text style={[styles.boss, { color: boss ? theme.bad : theme.subtle }]}>
            {boss ? (bossRound ? 'BOSS' : 'ELITE') : 'NEXT BOSS'}: {warning}
          </Text>
        </View>
      )}
      <RelicTray theme={theme} relics={relicList(run.inventory)} />
      {run.modifiers.length > 0 && (
        <Text style={[styles.mods, { color: theme.subtle }]}>
          {run.modifiers.map((id) => MODIFIERS[id].label).join(' · ')}
        </Text>
      )}
      <BagPanel theme={theme} bag={run.bag} spent={run.spent} />
      <View style={styles.spacer} />
      <View style={styles.bottom}>
        {cleared && <Text style={[styles.cleared, { color: theme.good }]}>{cleared}</Text>}
        {rejected && <Text style={[styles.rejected, { color: theme.bad }]}>{rejected}</Text>}
        <View style={styles.actions}>
          <Pressable
            disabled={!!timeline || picked === 0}
            onPress={onDiscard}
            style={[BUTTON, styles.action, { backgroundColor: theme.surface, borderColor: confirmExchange ? theme.bad : theme.border, opacity: picked ? 1 : 0.4 }]}
          >
            <Text style={[BUTTON_TEXT, styles.actionText, { color: confirmExchange ? theme.bad : theme.ink }]}>
              {confirmExchange ? `EXCHANGE ${picked}?` : `EXCHANGE${picked ? ` ${picked}` : ''}`}
            </Text>
          </Pressable>
          {run.consumables.map((id, i) => (
            <Pressable
              key={`${id}${i}`}
              disabled={!!timeline}
              onPress={() => onItem(id)}
              style={[BUTTON, styles.action, { backgroundColor: theme.surface, borderColor: theme.gold }]}
            >
              <Text style={[BUTTON_TEXT, styles.actionText, { color: theme.gold }]}>{id.toUpperCase()}</Text>
            </Pressable>
          ))}
          {run.armed && <Text style={[styles.armed, { color: theme.good }]}>{run.armed.toUpperCase()} ARMED</Text>}
        </View>
        <WordStrip
          theme={theme}
          letters={word.split('')}
          canSubmit={!timeline && canSubmit(word, dict)}
          onRemove={(pos) => pick((s) => unpickTile(s, pos))}
          onSubmit={onSubmit}
        />
        <TileRack theme={theme} rack={run.rack} pickedIndices={sel.picked} onPick={(i) => pick((s) => pickTile(s, i))} />
      </View>
      {timeline && <ResolutionOverlay theme={theme} steps={timeline} onDone={onResolved} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  spacer: { flex: 1 },
  bottom: { paddingBottom: 24 },
  bossRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingTop: 10 },
  bossIcon: { width: 24, height: 24 },
  boss: { ...HEADING, fontSize: 11, letterSpacing: 1, flexShrink: 1 },
  rejected: { ...BODY, fontSize: 14, textAlign: 'center', paddingBottom: 8, paddingHorizontal: 14 },
  cleared: { ...HEADING, fontSize: 12, letterSpacing: 1, textAlign: 'center', paddingBottom: 8, paddingHorizontal: 14 },
  mods: { ...BODY, fontSize: 13, paddingHorizontal: 18, paddingTop: 6, fontStyle: 'italic' },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
  action: { paddingVertical: 5, paddingHorizontal: 10 },
  actionText: { fontSize: 11, letterSpacing: 1 },
  armed: { ...HEADING, fontSize: 11, letterSpacing: 1 },
  wide: { minWidth: 220 },
  draftCard: { width: '80%', padding: 18, alignItems: 'center', gap: 6 },
  draftTitle: { ...HEADING, fontSize: 18 },
  draftLabel: { ...BODY, fontSize: 17, textAlign: 'center' },
  end: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 16 },
  endTitle: { fontFamily: FONT.display, fontSize: 34, fontWeight: '900', letterSpacing: 4 },
  endDetail: { ...BODY, fontSize: 17, textAlign: 'center' },
  shareLabel: { ...HEADING, fontSize: 11, letterSpacing: 1 },
  share: { fontFamily: 'monospace', fontSize: 10, width: '80%', padding: 10 },
});
