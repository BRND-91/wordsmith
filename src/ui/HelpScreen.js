import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import {
  RACK_SIZE, PLAYS_PER_ROUND, ROUNDS_PER_ACT, TELEGRAPH_LEAD, NEAR_MISS_SCALE,
  ACT1_TARGETS, ACT1_BOSS, ELITE_TARGET_SCALE, LANE_ROUND, BOSS_RULES,
} from '../run.js';
import { TILE_VALUES, lengthBonus } from '../letters.js';
import { DISTRIBUTION } from '../bag.js';
import { MODIFIERS } from '../modifiers.js';
import { CONSUMABLES, CONSUMABLE_SLOTS } from '../consumables.js';
import {
  RELIC_PRICE, REMOVE_PRICE, UPGRADE_PRICE, UPGRADE_STEP, CONSUMABLE_PRICE,
  CHEAP_RELIC_TIER, CLEAR_BOUNTY, OVERFLOW_STEP, OVERFLOW_BAND,
} from '../shop.js';
import { FONT, HEADING, BODY, PANEL, BUTTON, BUTTON_TEXT, roman } from './theme.js';

// Every number here is read off the engine's constants, so the explainer can
// never drift from the rules it describes.
const BAG_TOTAL = Object.values(DISTRIBUTION).reduce((a, b) => a + b, 0);
const NEAR_MISS_PCT = Math.round((NEAR_MISS_SCALE - 1) * 100);
const ELITE_PCT = Math.round(ELITE_TARGET_SCALE * 100);
const LENGTHS = [4, 5, 6, 7, 8, 9];

function valueGroups() {
  const byValue = {};
  for (const [letter, v] of Object.entries(TILE_VALUES)) (byValue[v] ??= []).push(letter.toUpperCase());
  return Object.keys(byValue).map(Number).sort((a, b) => a - b).map((v) => `${v}: ${byValue[v].sort().join(' ')}`);
}

const SECTIONS = [
  {
    title: 'The goal',
    lines: [
      `Each round you have ${PLAYS_PER_ROUND} plays to score past the round's target. Score resets to zero every round.`,
      `Act I targets run ${ACT1_TARGETS.join(', ')}, then the boss at ${ACT1_BOSS}. Every act after is harder. Round ${roman(ROUNDS_PER_ACT)} of each act is the boss round.`,
      'Run out of plays while under the target and the run is over.',
    ],
  },
  {
    title: 'Scoring',
    lines: [
      'A word scores STEEL × MULT. Steel is the sum of its tile values, plus a length bonus, plus anything relics add. Mult starts at 1; relics add to it, and the rare ×mult relics multiply it last.',
      `Tile steel by letter. ${valueGroups().join(' · ')}.`,
      `Length bonus. ${LENGTHS.map((n) => `${n} letters +${lengthBonus('a'.repeat(n))}`).join(' · ')}. From the 8th letter on each letter is worth double the bonus of the 5th to 7th, so a long word is the main way up.`,
    ],
  },
  {
    title: 'Cursed tiles',
    lines: [
      'A cursed tile (the skull) is worth nothing and spells nothing. It sits in your rack taking a slot, and any word that holds it cannot be struck.',
      'To be rid of one: select it and EXCHANGE. That spends a play, but the curse leaves the run for good instead of returning to the bag. The shop can also remove a copy that is still in the bag.',
      `Curses enter the bag three ways. Clear a boss by less than ${NEAR_MISS_PCT}% over its target. Buy a ${CHEAP_RELIC_TIER} relic (its price includes a curse). Hold the modifier that adds one each act.`,
    ],
  },
  {
    title: 'The bag',
    lines: [
      `${BAG_TOTAL} tiles in the standard letter distribution, no blanks. One copy each of J, K, Q, X and Z, so a big letter is a draw, never a plan. The rack holds ${RACK_SIZE}.`,
      'The BAG line on the play screen counts what is still to be drawn: tiles, vowels, consonants, curses, and the spent pile. Tap it to see the count for every letter.',
      'Played and exchanged tiles go to the spent pile, not back into the bag. They return, shuffled, when the round clears. So within a round the bag only shrinks, and what you have already drawn tells you what is left.',
    ],
  },
  {
    title: 'Exchange',
    lines: [
      'Select tiles and tap EXCHANGE: they go to the spent pile and the rack refills. It costs one play and scores nothing.',
      'Exchanging a selection that already spells a word takes a second tap, so a play is never thrown away by accident.',
    ],
  },
  {
    title: 'Bosses and elites',
    lines: [
      `The act's boss is named ${TELEGRAPH_LEAD} rounds ahead. A word the boss forbids still spends the play and scores nothing, so read the rule before you strike.`,
      ...Object.values(BOSS_RULES).map((b) => `${b.label}${b.minAct > 1 ? ` (from act ${roman(b.minAct)})` : ''}.`),
    ],
  },
  {
    title: 'The route',
    lines: [
      `After round ${roman(LANE_ROUND - 1)} clears you choose the act's road.`,
      `ELITE: the boss rule is in force from round ${roman(LANE_ROUND)} onward and those rounds' targets drop to ${ELITE_PCT}%. You bank a free relic at once, and the one shop opens right before the boss.`,
      'SAFE: flat targets, a shop after every round.',
    ],
  },
  {
    title: 'Gold and the shop',
    lines: [
      `Clearing a round pays ${CLEAR_BOUNTY} gold, plus 1 for every ${OVERFLOW_STEP} points over the target, up to ${OVERFLOW_BAND} extra.`,
      `Relics: common ${RELIC_PRICE.common}, uncommon ${RELIC_PRICE.uncommon}, rare ${RELIC_PRICE.rare}, legendary ${RELIC_PRICE.legendary}. A ${CHEAP_RELIC_TIER} relic also seeds one curse into the bag.`,
      `Remove a tile (${REMOVE_PRICE} gold): one copy of a letter leaves the bag for the rest of the run. Upgrade a letter (${UPGRADE_PRICE} gold): every copy of it scores +${UPGRADE_STEP} steel for the rest of the run.`,
      `Items cost ${CONSUMABLE_PRICE} gold, ${CONSUMABLE_SLOTS} slots. ${Object.values(CONSUMABLES).map((c) => `${c.id.toUpperCase()}: ${c.label}`).join('. ')}.`,
      'Relics sell back for half. Reroll the shelf for 1 gold, rising by 1 each reroll within a shop.',
    ],
  },
  {
    title: 'Act modifiers',
    lines: [
      'Entering a new act you draft one of two. The pick is permanent.',
      ...Object.values(MODIFIERS).map((m) => `${m.id.toUpperCase()}: ${m.label}.`),
    ],
  },
  {
    title: 'Strategy',
    lines: [
      'Length beats letter value. A plain 8-letter word out-scores a short word built on a Q.',
      'Count vowels. When the BAG line shows few vowels left, exchange consonants before the round clears rather than after, since the reshuffle brings the vowels back anyway.',
      'A curse costs you a rack slot every play it sits there. Exchange it with your first weak rack rather than carrying it into the boss.',
      `Do not scrape a boss. Clearing by less than ${NEAR_MISS_PCT}% seeds a curse, so a boss round is the round to spend an item.`,
      'Steel relics pay early; mult relics pay once steel is high. Buy in that order.',
      'One shop on the elite road. Bank gold on the safe road early if you mean to go elite later.',
    ],
  },
  {
    title: 'Keyboard',
    lines: ['Type letters to spell from the rack. Backspace removes the last letter. Enter strikes. Escape opens the menu.'],
  },
];

export default function HelpScreen({ theme, onBack }) {
  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <View style={[styles.head, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <Text style={[styles.title, { color: theme.ink }]}>HOW TO PLAY</Text>
        <Pressable onPress={onBack} style={[BUTTON, styles.back, { borderColor: theme.border }]}>
          <Text style={[BUTTON_TEXT, { color: theme.ink, fontSize: 11 }]}>BACK</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {SECTIONS.map((s) => (
          <View key={s.title} style={[styles.section, PANEL, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.accent }]}>{s.title.toUpperCase()}</Text>
            {s.lines.map((line, i) => (
              <Text key={i} style={[styles.line, { color: theme.ink }]}>{line}</Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 3 },
  title: { ...HEADING, fontSize: 18 },
  back: { paddingVertical: 4, paddingHorizontal: 10 },
  body: { padding: 14, gap: 10, paddingBottom: 40 },
  section: { padding: 14, gap: 6 },
  sectionTitle: { fontFamily: FONT.display, fontSize: 13, fontWeight: '700', letterSpacing: 2, marginBottom: 2 },
  line: { ...BODY, fontSize: 15, lineHeight: 21 },
});
