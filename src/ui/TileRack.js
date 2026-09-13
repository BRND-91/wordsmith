import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { TILE_VALUES } from '../letters.js';
import { isCurse } from '../bag.js';
import { CURSE_SPRITE } from './sprites.js';
import { FONT } from './theme.js';

const IRON_EDGE = '#111111';
const IRON_LIGHT = '#6a6a6e';
const IRON_SHADE = '#1a1a1c';
const IRON_INK = '#9a9a9e';
const BONE_LIGHT = '#fff8e6';

// A single bone tile: square-cut, oak-edged, with a bevel drawn as a light line
// along the top and a shade band along the bottom so it reads as a carved piece
// rather than a flat chip. Shared by the rack and the word strip. A curse tile
// is the same cut in iron.
export function Tile({ theme, letter, size, dim, onPress, disabled }) {
  const curse = isCurse(letter);
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.tile,
        { width: size, height: size * 1.15, backgroundColor: curse ? theme.iron : theme.tile, borderColor: curse ? IRON_EDGE : theme.tileEdge, opacity: dim ? 0.3 : 1 },
      ]}
    >
      <View style={[styles.bevelTop, { backgroundColor: curse ? IRON_LIGHT : BONE_LIGHT }]} />
      <View style={[styles.bevelBottom, { backgroundColor: curse ? IRON_SHADE : theme.tileShade }]} />
      {curse ? (
        <Image source={CURSE_SPRITE} style={{ width: size * 0.7, height: size * 0.7 }} />
      ) : (
        <Text style={[styles.letter, { color: theme.tileInk, fontSize: size * 0.52 }]}>{letter.toUpperCase()}</Text>
      )}
      <Text style={[styles.value, { color: curse ? IRON_INK : theme.subtle, fontSize: Math.max(9, size * 0.2) }]}>{TILE_VALUES[letter] ?? 0}</Text>
    </Pressable>
  );
}

// The rack, in the bottom thumb zone. Tap-to-select only: a tap picks the tile
// into the word; an already-picked tile dims and stops responding so the same
// physical tile can't be played twice. No drag — one input model on device.
// A curse tile stays pickable so it can be selected for EXCHANGE; it reads as a
// struck slot and a word holding it can never submit.
export default function TileRack({ theme, rack, pickedIndices, onPick }) {
  return (
    <View style={styles.rack}>
      {rack.map((letter, i) => {
        const used = pickedIndices.includes(i);
        return <Tile key={i} theme={theme} letter={letter} size={52} dim={used} disabled={used} onPress={() => onPick(i)} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rack: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  tile: { borderRadius: 3, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bevelTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, opacity: 0.9 },
  bevelBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4 },
  letter: { fontFamily: FONT.display, fontWeight: '700' },
  value: { fontFamily: FONT.display, fontWeight: '700', position: 'absolute', bottom: 5, right: 5 },
});
