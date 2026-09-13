import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { FONT, HEADING, BUTTON, BUTTON_TEXT, roman } from './theme.js';

// Glanceable top readout: where the run stands and what this round needs. The
// score-to-target relationship is the number the resolution animation flies its
// total up to, so it lives here, big and always visible. HELP opens the
// explainer, MENU the run menu.
export default function TopReadout({ theme, act, round, score, target, plays, gold, onMenu, onHelp }) {
  return (
    <View style={[styles.row, { borderColor: theme.border, backgroundColor: theme.surface }]}>
      <View style={styles.cell}>
        <Text style={[styles.label, { color: theme.subtle }]}>ACT {roman(act)} · ROUND {roman(round)}</Text>
        <Text style={[styles.plays, { color: theme.ink }]}>
          {plays} {plays === 1 ? 'play' : 'plays'} · <Text style={{ color: theme.gold }}>{gold} gold</Text>
        </Text>
      </View>
      <View style={[styles.cell, styles.scoreCell]}>
        <Text style={[styles.score, { color: theme.ink }]}>{score}</Text>
        <Text style={[styles.target, { color: theme.subtle }]}>/ {target}</Text>
      </View>
      <View style={styles.buttons}>
        <Pressable onPress={onHelp} style={[styles.btn, BUTTON, { borderColor: theme.border }]}>
          <Text style={[BUTTON_TEXT, styles.btnText, { color: theme.ink }]}>HELP</Text>
        </Pressable>
        <Pressable onPress={onMenu} style={[styles.btn, BUTTON, { borderColor: theme.border }]}>
          <Text style={[BUTTON_TEXT, styles.btnText, { color: theme.ink }]}>MENU</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 3 },
  cell: { justifyContent: 'center' },
  buttons: { gap: 4 },
  btn: { paddingVertical: 4, paddingHorizontal: 8 },
  btnText: { fontSize: 11, letterSpacing: 1 },
  scoreCell: { flexDirection: 'row', alignItems: 'baseline' },
  label: { ...HEADING, fontSize: 11 },
  plays: { fontFamily: FONT.display, fontSize: 14, fontWeight: '700', marginTop: 3 },
  score: { fontFamily: FONT.display, fontSize: 34, fontWeight: '900' },
  target: { fontFamily: FONT.display, fontSize: 17, fontWeight: '700', marginLeft: 6 },
});
