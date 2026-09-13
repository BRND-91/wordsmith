import { Platform } from 'react-native';

// Steel and mult are told apart by shape and position, never hue alone, so the
// readout survives light/dark mode and color-vision deficits (council ruling).
// Steel read as square tile-like blocks on the left; mult reads as a rounded
// badge on the right with a leading multiplication glyph.
export const SHAPES = {
  steel: { borderRadius: 3 },
  mult: { borderRadius: 999 },
};

export const MULT_GLYPH = '×'; // × prefixes every mult value

// Two OFL variable faces, served from public/fonts and registered by the
// @font-face block App.js injects on web. Fraunces (a wonky old-style display
// serif) carries every title, button, and number; Instrument Sans carries every
// sentence. Native has no loader wired, so it falls to the platform faces.
export const FONT = {
  display: Platform.OS === 'web' ? 'Fraunces, serif' : 'serif',
  body: Platform.OS === 'web' ? '"Instrument Sans", sans-serif' : 'sans-serif',
};

// Chrome is square-cornered and double-ruled: a panel reads as a plank or a
// parchment leaf, a button as a stamped plate. One definition site so the
// screens share a silhouette.
export const PANEL = { borderWidth: 2, borderRadius: 4 };
export const BUTTON = { borderWidth: 2, borderRadius: 3, paddingVertical: 10, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' };
export const BUTTON_TEXT = { fontFamily: FONT.display, fontSize: 14, fontWeight: '700', letterSpacing: 1 };
export const HEADING = { fontFamily: FONT.display, fontWeight: '700', letterSpacing: 1 };
export const BODY = { fontFamily: FONT.body };

// Heraldic palette: parchment and oak by day, torchlit stone by night. accent is
// gules (the red of a heater shield), gold the metal, iron the steel readout.
// Tiles stay bone-coloured in both schemes so a rack reads as the same pieces.
export const palette = {
  light: {
    bg: '#e4d3ae',
    surface: '#f3e8cf',
    ink: '#2b1d10',
    subtle: '#6f5537',
    accent: '#8a1c1c',
    accentInk: '#f6e7c4',
    gold: '#a9781f',
    iron: '#4a4a4c',
    tile: '#f6ecd2',
    tileInk: '#2b1d10',
    tileEdge: '#6b4a2b',
    tileShade: '#cdbb90',
    good: '#3f6b2b',
    bad: '#8a1c1c',
    border: '#8c6a44',
  },
  dark: {
    bg: '#191310',
    surface: '#261c15',
    ink: '#ead9b6',
    subtle: '#a88c66',
    accent: '#a12626',
    accentInk: '#f6e7c4',
    gold: '#d2a43a',
    iron: '#8a8c90',
    tile: '#e7d7ad',
    tileInk: '#2b1d10',
    tileEdge: '#4a3320',
    tileShade: '#b9a67c',
    good: '#7fb35c',
    bad: '#e05a4a',
    border: '#5a4630',
  },
};

export function themeFor(scheme) {
  return palette[scheme === 'dark' ? 'dark' : 'light'];
}

const ROMAN = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];

// Acts and rounds are numbered in Roman numerals across the UI; the engine's
// integers are untouched.
export function roman(n) {
  let out = '';
  let rest = n;
  for (const [value, glyph] of ROMAN) {
    while (rest >= value) { out += glyph; rest -= value; }
  }
  return out;
}
