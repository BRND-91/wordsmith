import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Tile } from './TileRack.js';
import { PANEL, BUTTON, BUTTON_TEXT, BODY } from './theme.js';

// The current word, directly above the rack. Each letter is its own tap-to-remove
// target. The submit button gates live: the parent recomputes canSubmit on every
// tap, so a non-word can never be submitted and the player is never bounced past
// the scoring animation. Disabled submit reads by opacity plus a static label.
export default function WordStrip({ theme, letters, canSubmit, onRemove, onSubmit }) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.strip, PANEL, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        {letters.length === 0 ? (
          <Text style={[styles.hint, { color: theme.subtle }]}>tap tiles to spell a word</Text>
        ) : (
          letters.map((letter, pos) => (
            <Tile key={pos} theme={theme} letter={letter} size={34} onPress={() => onRemove(pos)} />
          ))
        )}
      </View>
      <Pressable
        disabled={!canSubmit}
        onPress={onSubmit}
        style={[styles.submit, BUTTON, { backgroundColor: theme.accent, borderColor: theme.gold, opacity: canSubmit ? 1 : 0.35 }]}
      >
        <Text style={[BUTTON_TEXT, { color: theme.accentInk }]}>STRIKE</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginBottom: 14 },
  strip: { flex: 1, minHeight: 56, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, padding: 8 },
  hint: { ...BODY, fontSize: 15, fontStyle: 'italic' },
  submit: { height: 56, paddingHorizontal: 16 },
});
