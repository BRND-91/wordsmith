import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { RELIC_SPRITES } from './sprites.js';
import { BODY } from './theme.js';

// Icon-only relic badge. In the round tray, hover (web) and press (touch) both
// report the relic to the parent, which owns the single caption line under the
// row; a per-badge bubble would clip on a phone where the last badge in a row
// sits at the edge. The market passes no handlers: it prints each description
// beside its badge, so the badge is static there.
export default function RelicIcon({ theme, relic, size, active, onFocus, onBlur, onPress }) {
  return (
    <Pressable
      onHoverIn={onFocus && (() => onFocus(relic.id))}
      onHoverOut={onBlur}
      onPress={onPress && (() => onPress(relic.id))}
      style={[
        styles.badge,
        { width: size + 10, height: size + 10, backgroundColor: theme.surface, borderColor: active ? theme.gold : theme.border },
      ]}
    >
      <Image source={RELIC_SPRITES[relic.id]} style={{ width: size, height: size }} />
    </Pressable>
  );
}

// Caption under an icon row: the focused relic's effect, or a prompt until the
// player has touched one. Fixed minHeight so the row above never jumps.
export function RelicCaption({ theme, relic, prompt, children }) {
  return (
    <View style={styles.caption}>
      {relic ? (
        <View style={styles.captionRow}>
          <Text style={[styles.captionText, { color: theme.ink }]}>
            {relic.label}
            <Text style={{ color: theme.subtle }}>  ·  {relic.rarity} · {relic.tag}</Text>
          </Text>
          {children}
        </View>
      ) : (
        <Text style={[styles.captionText, { color: theme.subtle, fontStyle: 'italic' }]}>{prompt}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderRadius: 3 },
  caption: { minHeight: 22, marginTop: 6, justifyContent: 'center' },
  captionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  captionText: { ...BODY, fontSize: 14, flexShrink: 1 },
});
