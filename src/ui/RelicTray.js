import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import RelicIcon, { RelicCaption } from './RelicIcon.js';
import { HEADING } from './theme.js';

// Relics owned this run, icons only. Hovering or tapping a badge puts its effect
// in the caption line; tap again to clear on touch. Expanded by default so a new
// player sees the badges before the first one fires.
export default function RelicTray({ theme, relics }) {
  const [open, setOpen] = useState(true);
  const [hover, setHover] = useState(null);
  const [pinned, setPinned] = useState(null);
  const focus = hover ?? pinned;
  const shown = focus && relics.find((r) => r.id === focus);
  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.header}>
        <Text style={[styles.title, { color: theme.subtle }]}>RELICS ({relics.length})</Text>
        <Text style={[styles.chevron, { color: theme.subtle }]}>{open ? '▾' : '▸'}</Text>
      </Pressable>
      {open && (
        <>
          <View style={styles.list}>
            {relics.map((r) => (
              <RelicIcon
                key={r.id}
                theme={theme}
                relic={r}
                size={24}
                active={focus === r.id}
                onFocus={setHover}
                onBlur={() => setHover(null)}
                onPress={(id) => setPinned((p) => (p === id ? null : id))}
              />
            ))}
          </View>
          <RelicCaption theme={theme} relic={shown} prompt="hover or tap a relic to read it" />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  title: { ...HEADING, fontSize: 12 },
  chevron: { fontSize: 14 },
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
});
