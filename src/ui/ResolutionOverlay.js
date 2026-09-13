import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { STEP } from '../presenter.js';
import { SHAPES, MULT_GLYPH, FONT, HEADING, PANEL } from './theme.js';

const STEP_MS = 340;
const XMULT_MS = 620; // the rare beat holds longer than an additive tick

// Plays the resolveTimeline steps in order at the word strip: the per-letter steel
// run, additive relic ticks, a distinct scale pulse for the xMult beat, then the
// total flying up toward the target. Steel sit left as a square block, mult sits
// right as a rounded ×badge — shape and position carry the distinction, not hue.
export default function ResolutionOverlay({ theme, steps, onDone }) {
  const [i, setI] = useState(0);
  const pulse = useRef(new Animated.Value(1)).current;
  const fly = useRef(new Animated.Value(0)).current;

  const step = steps[i];
  const isXMult = step && step.kind === STEP.XMULT;
  const isTotal = step && step.kind === STEP.TOTAL;

  useEffect(() => {
    if (!step) return undefined;
    if (isXMult) {
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.5, duration: XMULT_MS / 2, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: XMULT_MS / 2, useNativeDriver: true }),
      ]).start();
    }
    if (isTotal) {
      Animated.timing(fly, { toValue: 1, duration: 700, useNativeDriver: true }).start(() => {
        const t = setTimeout(onDone, 200);
        return () => clearTimeout(t);
      });
      return undefined;
    }
    const t = setTimeout(() => setI((n) => n + 1), isXMult ? XMULT_MS : STEP_MS);
    return () => clearTimeout(t);
  }, [i]);

  if (!step) return null;
  const steel = displaySteel(steps, i);
  const mult = displayMult(steps, i);

  return (
    <View style={[styles.overlay, PANEL, { backgroundColor: theme.surface, borderColor: theme.gold }]}>
      <Text style={[styles.caption, { color: theme.subtle }]}>{caption(step)}</Text>
      <View style={styles.readout}>
        <View style={[styles.steelBox, SHAPES.steel, { backgroundColor: theme.iron, borderColor: theme.tileEdge }]}>
          <Text style={[styles.steelText, { color: theme.accentInk }]}>{steel}</Text>
        </View>
        <Text style={[styles.times, { color: theme.subtle }]}>{MULT_GLYPH}</Text>
        <Animated.View style={[styles.multBox, SHAPES.mult, { backgroundColor: theme.accent, borderColor: theme.gold, transform: [{ scale: pulse }] }]}>
          <Text style={[styles.multText, { color: theme.accentInk }]}>{MULT_GLYPH}{round2(mult)}</Text>
        </Animated.View>
      </View>
      {isTotal && (
        <Animated.Text
          style={[
            styles.total,
            { color: theme.good, opacity: fly.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }), transform: [{ translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [0, -120] }) }] },
          ]}
        >
          +{step.total}
        </Animated.Text>
      )}
    </View>
  );
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function displaySteel(steps, i) {
  for (let k = i; k >= 0; k--) if (steps[k].steel !== undefined) return steps[k].steel;
  return 0;
}

function displayMult(steps, i) {
  for (let k = i; k >= 0; k--) if (steps[k].mult !== undefined) return steps[k].mult;
  return 1;
}

function caption(step) {
  switch (step.kind) {
    case STEP.TILE: return `${step.letter.toUpperCase()} +${step.value}`;
    case STEP.LENGTH: return `+${step.add} length`;
    case STEP.RELIC_STEEL: return `${step.relicId} +${step.add}`;
    case STEP.RELIC_MULT: return `${step.relicId} +${step.add}${MULT_GLYPH}`;
    case STEP.XMULT: return `${step.relicId} ${MULT_GLYPH}${step.factor}`;
    case STEP.TOTAL: return 'total';
    default: return '';
  }
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 14, right: 14, bottom: 0, padding: 16, alignItems: 'center' },
  caption: { ...HEADING, fontSize: 12, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  readout: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  steelBox: { minWidth: 64, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center', borderWidth: 2 },
  steelText: { fontFamily: FONT.display, fontSize: 26, fontWeight: '900' },
  times: { fontFamily: FONT.display, fontSize: 20, fontWeight: '700' },
  multBox: { minWidth: 52, paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center', borderWidth: 2 },
  multText: { fontFamily: FONT.display, fontSize: 22, fontWeight: '900' },
  total: { position: 'absolute', top: -10, fontFamily: FONT.display, fontSize: 30, fontWeight: '900' },
});
