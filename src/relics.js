import { RELICS as BASE } from './scoring.js';
import { VOWELS } from './letters.js';

// Five archetype tags the pool is balanced across (council split: ~55% additive
// steel, 20% conditional additive mult, 10% xMult, 15% economy/utility).
export const ARCHETYPES = {
  LENGTH: 'Length',
  RARE: 'Rare-Letter',
  VOWEL: 'Vowel',
  STRUCTURAL: 'Structural',
  ECONOMY: 'Economy',
};

// Four tiers. Shop odds are the weights below; legendary carries no shop weight
// and only reaches a run through an event, so the shelf never offers one.
export const RARITY = {
  COMMON: 'common',
  UNCOMMON: 'uncommon',
  RARE: 'rare',
  LEGENDARY: 'legendary',
};

export const RARITY_WEIGHT = {
  [RARITY.COMMON]: 60,
  [RARITY.UNCOMMON]: 30,
  [RARITY.RARE]: 10,
  [RARITY.LEGENDARY]: 0,
};

const RARE_TILES = new Set(['j', 'q', 'x', 'z']);

function countVowels(word) {
  let v = 0;
  for (const ch of word) if (VOWELS.has(ch)) v++;
  return v;
}

function countConsonants(word) {
  return word.length - countVowels(word);
}

function distinctVowels(word) {
  const seen = new Set();
  for (const ch of word) if (VOWELS.has(ch)) seen.add(ch);
  return seen.size;
}

function distinctRareTiles(word) {
  const seen = new Set();
  for (const ch of word) if (RARE_TILES.has(ch)) seen.add(ch);
  return seen.size;
}

function noRepeatedLetters(word) {
  return new Set(word).size === word.length;
}

function hasDoubleLetter(word) {
  for (let i = 1; i < word.length; i++) if (word[i] === word[i - 1]) return true;
  return false;
}

function isPalindrome(word) {
  return word.length > 2 && word === [...word].reverse().join('');
}

const { COMMON, UNCOMMON, RARE, LEGENDARY } = RARITY;

// Every mult-granting relic gates on a cost orthogonal to word length: length is
// the engine's primary skill axis (letters.js), so gating a mult on it would
// gate nothing. Gates used for mult are no-repeat, rare-tile presence/count,
// consonant load, and vowel count/spread. Additive-steel relics may gate on
// length freely, since a bigger steel base on a longer word rewards the same axis
// the player already leans on rather than double-taxing a scarce mult slot.
// Economy relics carry no scoring hook; the shop/economy layer reads their
// `econ` field and the inventory keeps them out of score(). Every econ field
// used here (clearBonus, overflowBonus, rerollDiscount, priceMarkup) is consumed
// in shop.js. A relic may carry both a hook and an econ block (taxman).
//
// Hook context is { word, played, relics, self } (scoring.js). Escalating relics
// keep their count in `self` and advance it in `onPlay`, never in the hook, so a
// timeline preview and the committed score read the same number.
export const POOL = {
  // --- base three, tagged ---
  longhand: { ...BASE.longhand, tag: ARCHETYPES.LENGTH, rarity: COMMON },
  vowelMult: { ...BASE.vowelMult, tag: ARCHETYPES.VOWEL, rarity: UNCOMMON },
  bookend: { ...BASE.bookend, tag: ARCHETYPES.STRUCTURAL, rarity: UNCOMMON },

  // --- Length / additive steel ---
  ballast: {
    id: 'ballast',
    label: '+8 steel on any word',
    tag: ARCHETYPES.LENGTH,
    rarity: COMMON,
    hook: () => ({ addSteel: 8 }),
  },
  foundation: {
    id: 'foundation',
    label: '+6 steel on words of 4+ letters',
    tag: ARCHETYPES.LENGTH,
    rarity: COMMON,
    hook: ({ word }) => (word.length >= 4 ? { addSteel: 6 } : {}),
  },
  polysyllable: {
    id: 'polysyllable',
    label: '+15 steel on words of 6+ letters',
    tag: ARCHETYPES.LENGTH,
    rarity: COMMON,
    hook: ({ word }) => (word.length >= 6 ? { addSteel: 15 } : {}),
  },
  keystone: {
    id: 'keystone',
    label: '+22 steel on words of 7+ letters',
    tag: ARCHETYPES.LENGTH,
    rarity: UNCOMMON,
    hook: ({ word }) => (word.length >= 7 ? { addSteel: 22 } : {}),
  },
  novella: {
    id: 'novella',
    label: '+45 steel on words of 8+ letters',
    tag: ARCHETYPES.LENGTH,
    rarity: RARE,
    hook: ({ word }) => (word.length >= 8 ? { addSteel: 45 } : {}),
  },
  marathoner: {
    id: 'marathoner',
    label: '+30 steel on a full 9-letter word',
    tag: ARCHETYPES.LENGTH,
    rarity: RARE,
    hook: ({ word }) => (word.length >= 9 ? { addSteel: 30 } : {}),
  },
  tally: {
    id: 'tally',
    label: '+3 steel per letter',
    tag: ARCHETYPES.LENGTH,
    rarity: COMMON,
    hook: ({ word }) => ({ addSteel: 3 * word.length }),
  },

  // --- Rare-Letter / additive steel ---
  prospector: {
    id: 'prospector',
    label: '+12 steel per distinct rare tile (j/q/x/z)',
    tag: ARCHETYPES.RARE,
    rarity: UNCOMMON,
    hook: ({ word }) => ({ addSteel: 12 * distinctRareTiles(word) }),
  },
  vein: {
    id: 'vein',
    label: '+15 steel if the word holds any rare tile',
    tag: ARCHETYPES.RARE,
    rarity: COMMON,
    hook: ({ word }) => (distinctRareTiles(word) ? { addSteel: 15 } : {}),
  },
  highroller: {
    id: 'highroller',
    label: '+25 steel if the word holds a q or z',
    tag: ARCHETYPES.RARE,
    rarity: UNCOMMON,
    hook: ({ word }) =>
      word.includes('q') || word.includes('z') ? { addSteel: 25 } : {},
  },
  numismatist: {
    id: 'numismatist',
    label: '+18 steel if the word holds a j or x',
    tag: ARCHETYPES.RARE,
    rarity: COMMON,
    hook: ({ word }) =>
      word.includes('j') || word.includes('x') ? { addSteel: 18 } : {},
  },
  smelter: {
    id: 'smelter',
    label: '+40 steel on 2+ distinct rare tiles',
    tag: ARCHETYPES.RARE,
    rarity: RARE,
    hook: ({ word }) => (distinctRareTiles(word) >= 2 ? { addSteel: 40 } : {}),
  },
  goldrush: {
    id: 'goldrush',
    label: '+50 steel if the word holds both a q and a z',
    tag: ARCHETYPES.RARE,
    rarity: RARE,
    hook: ({ word }) =>
      word.includes('q') && word.includes('z') ? { addSteel: 50 } : {},
  },

  // --- Vowel / additive steel ---
  aria: {
    id: 'aria',
    label: '+6 steel per vowel',
    tag: ARCHETYPES.VOWEL,
    rarity: COMMON,
    hook: ({ word }) => ({ addSteel: 6 * countVowels(word) }),
  },
  cascade: {
    id: 'cascade',
    label: '+8 steel if the word starts with a vowel',
    tag: ARCHETYPES.VOWEL,
    rarity: COMMON,
    hook: ({ word }) => (VOWELS.has(word[0]) ? { addSteel: 8 } : {}),
  },
  diphthong: {
    id: 'diphthong',
    label: '+10 steel on words with 3+ vowels',
    tag: ARCHETYPES.VOWEL,
    rarity: COMMON,
    hook: ({ word }) => (countVowels(word) >= 3 ? { addSteel: 10 } : {}),
  },
  sonorant: {
    id: 'sonorant',
    label: '+12 steel on 3+ distinct vowels',
    tag: ARCHETYPES.VOWEL,
    rarity: UNCOMMON,
    hook: ({ word }) => (distinctVowels(word) >= 3 ? { addSteel: 12 } : {}),
  },
  chorus: {
    id: 'chorus',
    label: '+20 steel on words with 4+ vowels',
    tag: ARCHETYPES.VOWEL,
    rarity: UNCOMMON,
    hook: ({ word }) => (countVowels(word) >= 4 ? { addSteel: 20 } : {}),
  },

  // --- Structural / additive steel ---
  staccato: {
    id: 'staccato',
    label: '+12 steel if no letter repeats',
    tag: ARCHETYPES.STRUCTURAL,
    rarity: COMMON,
    hook: ({ word }) => (noRepeatedLetters(word) ? { addSteel: 12 } : {}),
  },
  cadence: {
    id: 'cadence',
    label: '+16 steel if the word has a doubled letter',
    tag: ARCHETYPES.STRUCTURAL,
    rarity: COMMON,
    hook: ({ word }) => (hasDoubleLetter(word) ? { addSteel: 16 } : {}),
  },
  symmetry: {
    id: 'symmetry',
    label: '+25 steel on a palindrome',
    tag: ARCHETYPES.STRUCTURAL,
    rarity: UNCOMMON,
    hook: ({ word }) => (isPalindrome(word) ? { addSteel: 25 } : {}),
  },

  // --- conditional additive mult (gated off length) ---
  lexicographer: {
    id: 'lexicographer',
    label: '+3 mult if no letter repeats',
    tag: ARCHETYPES.STRUCTURAL,
    rarity: RARE,
    hook: ({ word }) => (noRepeatedLetters(word) ? { addMult: 3 } : {}),
  },
  consonance: {
    id: 'consonance',
    label: '+2 mult on 4+ consonants',
    tag: ARCHETYPES.STRUCTURAL,
    rarity: UNCOMMON,
    hook: ({ word }) => (countConsonants(word) >= 4 ? { addMult: 2 } : {}),
  },
  jeweler: {
    id: 'jeweler',
    label: '+2 mult per distinct rare tile',
    tag: ARCHETYPES.RARE,
    rarity: UNCOMMON,
    hook: ({ word }) => {
      const n = distinctRareTiles(word);
      return n ? { addMult: 2 * n } : {};
    },
  },
  hoard: {
    id: 'hoard',
    label: '+5 mult if the word holds a q or z',
    tag: ARCHETYPES.RARE,
    rarity: RARE,
    hook: ({ word }) =>
      word.includes('q') || word.includes('z') ? { addMult: 5 } : {},
  },
  gambit: {
    id: 'gambit',
    label: '+4 mult if the word holds a j or x',
    tag: ARCHETYPES.RARE,
    rarity: RARE,
    hook: ({ word }) =>
      word.includes('j') || word.includes('x') ? { addMult: 4 } : {},
  },
  ascetic: {
    id: 'ascetic',
    label: '+2 mult if the word has at most one vowel',
    tag: ARCHETYPES.STRUCTURAL,
    rarity: UNCOMMON,
    hook: ({ word }) => (countVowels(word) <= 1 ? { addMult: 2 } : {}),
  },
  temperance: {
    id: 'temperance',
    label: '+3 mult if the word has exactly two vowels',
    tag: ARCHETYPES.VOWEL,
    rarity: UNCOMMON,
    hook: ({ word }) => (countVowels(word) === 2 ? { addMult: 3 } : {}),
  },

  // --- xMult on genuinely rare word shapes (gated off length) ---
  mirror: {
    id: 'mirror',
    label: 'x3 on a palindrome',
    tag: ARCHETYPES.STRUCTURAL,
    rarity: RARE,
    hook: ({ word }) => (isPalindrome(word) ? { xMult: 3 } : {}),
  },
  crucible: {
    id: 'crucible',
    label: 'x2 on 2+ distinct rare tiles',
    tag: ARCHETYPES.RARE,
    rarity: RARE,
    hook: ({ word }) => (distinctRareTiles(word) >= 2 ? { xMult: 2 } : {}),
  },
  prism: {
    id: 'prism',
    label: 'x2 on 3+ distinct vowels',
    tag: ARCHETYPES.VOWEL,
    rarity: RARE,
    hook: ({ word }) => (distinctVowels(word) >= 3 ? { xMult: 2 } : {}),
  },

  // --- Economy / utility (no scoring hook) ---
  merchant: {
    id: 'merchant',
    label: '+2 gold each encounter cleared',
    tag: ARCHETYPES.ECONOMY,
    rarity: COMMON,
    econ: { clearBonus: 2 },
  },
  tycoon: {
    id: 'tycoon',
    label: '+5 gold each encounter cleared',
    tag: ARCHETYPES.ECONOMY,
    rarity: UNCOMMON,
    econ: { clearBonus: 5 },
  },
  appraiser: {
    id: 'appraiser',
    label: '+1 gold per capped overflow band',
    tag: ARCHETYPES.ECONOMY,
    rarity: COMMON,
    econ: { overflowBonus: 1 },
  },
  speculator: {
    id: 'speculator',
    label: '+2 gold per capped overflow band',
    tag: ARCHETYPES.ECONOMY,
    rarity: UNCOMMON,
    econ: { overflowBonus: 2 },
  },
  coupon: {
    id: 'coupon',
    label: 'shop rerolls cost 1 less',
    tag: ARCHETYPES.ECONOMY,
    rarity: COMMON,
    econ: { rerollDiscount: 1 },
  },
  haggler: {
    id: 'haggler',
    label: 'shop rerolls cost 2 less',
    tag: ARCHETYPES.ECONOMY,
    rarity: UNCOMMON,
    econ: { rerollDiscount: 2 },
  },

  // --- Drawback: a strong upside paid for on another axis ---
  anchor: {
    id: 'anchor',
    label: '+25 steel on words of 5 or fewer letters, -10 steel on longer',
    tag: ARCHETYPES.LENGTH,
    rarity: COMMON,
    hook: ({ word }) => (word.length <= 5 ? { addSteel: 25 } : { addSteel: -10 }),
  },
  glasscannon: {
    id: 'glasscannon',
    label: 'x2 on every word, -15 steel on every word',
    tag: ARCHETYPES.STRUCTURAL,
    rarity: RARE,
    hook: () => ({ addSteel: -15, xMult: 2 }),
  },
  hermit: {
    id: 'hermit',
    label: '+4 mult while it is your only scoring relic',
    tag: ARCHETYPES.STRUCTURAL,
    rarity: UNCOMMON,
    hook: ({ relics }) => (relics.length === 1 ? { addMult: 4 } : {}),
  },
  taxman: {
    id: 'taxman',
    label: '+30 steel on any word, -2 gold each encounter cleared',
    tag: ARCHETYPES.ECONOMY,
    rarity: UNCOMMON,
    hook: () => ({ addSteel: 30 }),
    econ: { clearBonus: -2 },
  },
  miser: {
    id: 'miser',
    label: '+4 gold each encounter cleared, relics cost 2 more',
    tag: ARCHETYPES.ECONOMY,
    rarity: UNCOMMON,
    econ: { clearBonus: 4, priceMarkup: 2 },
  },

  // --- Escalating: grows over the run ---
  momentum: {
    id: 'momentum',
    label: '+2 steel per word played this run',
    tag: ARCHETYPES.LENGTH,
    rarity: UNCOMMON,
    hook: ({ played }) => (played.length ? { addSteel: 2 * played.length } : {}),
  },
  collector: {
    id: 'collector',
    label: '+10 steel per distinct rare tile played so far this run',
    tag: ARCHETYPES.RARE,
    rarity: UNCOMMON,
    hook: ({ self }) => {
      const n = self.seen ? Object.keys(self.seen).length : 0;
      return n ? { addSteel: 10 * n } : {};
    },
    onPlay: ({ word, self }) => {
      for (const ch of word) if (RARE_TILES.has(ch)) (self.seen || (self.seen = {}))[ch] = true;
    },
  },
  whetstone: {
    id: 'whetstone',
    label: '+1 mult per 6+ letter word played this run',
    tag: ARCHETYPES.STRUCTURAL,
    rarity: RARE,
    hook: ({ self }) => (self.count ? { addMult: self.count } : {}),
    onPlay: ({ word, self }) => {
      if (word.length >= 6) self.count = (self.count || 0) + 1;
    },
  },

  // --- Legendary: event-only, never shelved ---
  philosopher: {
    id: 'philosopher',
    label: 'x2 on every word',
    tag: ARCHETYPES.STRUCTURAL,
    rarity: LEGENDARY,
    hook: () => ({ xMult: 2 }),
  },
};

export function poolByTag(tag) {
  return Object.values(POOL).filter((r) => r.tag === tag);
}

export function poolByRarity(rarity) {
  return Object.values(POOL).filter((r) => r.rarity === rarity);
}
