import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { DISTRIBUTION, countTiles, countCurses } from '../bag.js';
import { VOWELS, TILE_VALUES } from '../letters.js';
import { FONT, HEADING, BODY } from './theme.js';

const LETTERS = Object.keys(DISTRIBUTION).sort();

// The card-counter: what is still in the bag, letter by letter, plus the totals
// a player plans a round around. The header line alone carries the decision
// numbers (tiles, vowels, curses, spent); the grid opens on tap. Spent tiles
// come back when the round clears, so the bag only shrinks within a round and
// the spent count says how much of the pile is waiting to return.
export default function BagPanel({ theme, bag, spent }) {
  const [open, setOpen] = useState(false);
  const counts = Object.fromEntries(countTiles(bag).map(({ letter, count }) => [letter, count]));
  const curses = countCurses(bag);
  let vowels = 0;
  for (const t of bag) if (VOWELS.has(t)) vowels++;
  const letters = bag.length - curses;
  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.header}>
        <Text style={[styles.title, { color: theme.subtle }]}>BAG</Text>
        <Text style={[styles.stats, { color: theme.ink }]}>
          {letters} tiles · {vowels} vowels · {letters - vowels} consonants
          {curses > 0 ? ` · ${curses} cursed` : ''} · {spent.length} spent
        </Text>
        <Text style={[styles.chevron, { color: theme.subtle }]}>{open ? '▾' : '▸'}</Text>
      </Pressable>
      {open && (
        <>
          <View style={styles.grid}>
            {LETTERS.map((letter) => {
              const n = counts[letter] ?? 0;
              return (
                <View
                  key={letter}
                  style={[styles.cell, { backgroundColor: n ? theme.tile : theme.surface, borderColor: n ? theme.tileEdge : theme.border, opacity: n ? 1 : 0.45 }]}
                >
                  <Text style={[styles.cellLetter, { color: theme.tileInk }]}>{letter.toUpperCase()}</Text>
                  <Text style={[styles.cellCount, { color: n ? theme.ink : theme.subtle }]}>{n}</Text>
                  <Text style={[styles.cellValue, { color: theme.subtle }]}>{TILE_VALUES[letter]}</Text>
                </View>
              );
            })}
          </View>
          <Text style={[styles.note, { color: theme.subtle }]}>
            Count is copies still in the bag; the small number is the tile's steel. Played and exchanged tiles wait in the spent pile and return, shuffled, when the round clears.
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  title: { ...HEADING, fontSize: 12 },
  stats: { ...BODY, fontSize: 13, flex: 1 },
  chevron: { fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  cell: { width: 34, height: 40, borderWidth: 1, borderRadius: 2, alignItems: 'center', paddingTop: 3 },
  cellLetter: { fontFamily: FONT.display, fontSize: 14, fontWeight: '700' },
  cellCount: { fontFamily: FONT.display, fontSize: 12, fontWeight: '700' },
  cellValue: { fontFamily: FONT.display, fontSize: 8, position: 'absolute', bottom: 2, right: 3 },
  note: { ...BODY, fontSize: 12, marginTop: 6, fontStyle: 'italic' },
});
