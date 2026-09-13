import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import RelicIcon, { RelicCaption } from './RelicIcon.js';
import { countTiles } from '../bag.js';
import { relicList, econRelics } from '../inventory.js';
import {
  buyRelic,
  sellRelic,
  rerollShop,
  removeTile,
  upgradeTile,
  leaveShop,
  rerollCost,
  relicPrice,
  sellPrice,
  buyConsumable,
  REMOVE_PRICE,
  UPGRADE_PRICE,
  CONSUMABLE_PRICE,
} from '../shop.js';
import { CONSUMABLES, CONSUMABLE_SLOTS } from '../consumables.js';
import { FONT, HEADING, BODY, PANEL, BUTTON, BUTTON_TEXT } from './theme.js';

const SERVICE = {
  'remove-tile': { title: 'REMOVE A TILE', price: REMOVE_PRICE, act: removeTile },
  'upgrade-tile': { title: 'UPGRADE A LETTER', price: UPGRADE_PRICE, act: upgradeTile },
};

// Between-round shop over the run state. Every action mutates the run through
// shop.js and the screen redraws off it; a tile service is a two-tap flow, pick
// the service then pick the letter, since the bag has up to 26 letters and a
// per-letter button row per service would not fit a phone.
export default function ShopScreen({ theme, run, onLeave }) {
  const [, force] = useState(0);
  const [service, setService] = useState(null);
  const [notice, setNotice] = useState(null);
  // One focus shared by the shelf and the owned row; a relic id is unique across
  // both, and the caption under the owned row doubles as the sell control.
  const [hover, setHover] = useState(null);
  const [pinned, setPinned] = useState(null);
  const focus = hover ?? pinned;
  const iconProps = {
    theme,
    onFocus: setHover,
    onBlur: () => setHover(null),
    onPress: (id) => setPinned((p) => (p === id ? null : id)),
  };
  const apply = (fn) => {
    const r = fn();
    // The cheap-relic tax is the one purchase that lands a downside, so it is
    // the one success that gets a notice.
    setNotice(r.ok ? (r.cursed ? 'a curse tile joined the bag' : null) : r.reason);
    force((n) => n + 1);
    return r;
  };

  const shop = run.shop;
  const econ = econRelics(run.inventory);
  const reroll = rerollCost(shop.rerolls, econ);
  const tiles = countTiles(run.bag);
  const owned = relicList(run.inventory);
  const ownedFocus = focus ? owned.find((r) => r.id === focus) : null;
  const btn = (enabled) => [BUTTON, styles.btn, { backgroundColor: enabled ? theme.accent : theme.surface, borderColor: enabled ? theme.gold : theme.border, opacity: enabled ? 1 : 0.5 }];
  const btnText = (enabled) => [BUTTON_TEXT, styles.btnText, { color: enabled ? theme.accentInk : theme.subtle }];

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <View style={[styles.head, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <Text style={[styles.title, { color: theme.ink }]}>MARKET</Text>
        <Text style={[styles.gold, { color: theme.gold }]}>{run.gold} gold</Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {notice && <Text style={[styles.notice, { color: theme.bad }]}>{notice}</Text>}

        <View style={styles.sectionHead}>
          <Text style={[styles.section, { color: theme.subtle }]}>RELICS</Text>
          <Pressable onPress={() => apply(() => rerollShop(run))} style={btn(run.gold >= reroll)}>
            <Text style={btnText(run.gold >= reroll)}>REROLL {reroll}g</Text>
          </Pressable>
        </View>
        {shop.shelf.map((r) => {
          const can = run.gold >= relicPrice(r, econ);
          return (
            <View key={r.id} style={[styles.card, PANEL, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <RelicIcon {...iconProps} relic={r} size={40} active={focus === r.id} />
              <View style={styles.cardText}>
                <Text style={[styles.cardLabel, { color: focus === r.id ? theme.ink : theme.subtle, fontStyle: focus === r.id ? 'normal' : 'italic' }]}>
                  {focus === r.id ? r.label : 'hover or tap to read'}
                </Text>
                <Text style={[styles.cardTag, { color: theme.subtle }]}>{r.rarity} · {r.tag}</Text>
              </View>
              <Pressable onPress={() => apply(() => buyRelic(run, r.id))} style={btn(can)}>
                <Text style={btnText(can)}>BUY {relicPrice(r, econ)}g</Text>
              </Pressable>
            </View>
          );
        })}
        {shop.shelf.length === 0 && <Text style={[styles.empty, { color: theme.subtle }]}>shelf empty</Text>}

        <Text style={[styles.section, { color: theme.subtle }]}>ITEM · {run.consumables.length}/{CONSUMABLE_SLOTS} HELD</Text>
        {shop.consumable ? (
          <View style={[styles.card, PANEL, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: theme.ink }]}>{shop.consumable.toUpperCase()}</Text>
              <Text style={[styles.cardTag, { color: theme.subtle }]}>{CONSUMABLES[shop.consumable].label}</Text>
            </View>
            <Pressable
              onPress={() => apply(() => buyConsumable(run))}
              style={btn(run.gold >= CONSUMABLE_PRICE && run.consumables.length < CONSUMABLE_SLOTS)}
            >
              <Text style={btnText(run.gold >= CONSUMABLE_PRICE && run.consumables.length < CONSUMABLE_SLOTS)}>BUY {CONSUMABLE_PRICE}g</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={[styles.empty, { color: theme.subtle }]}>sold out</Text>
        )}

        <Text style={[styles.section, { color: theme.subtle }]}>TILE SERVICES</Text>
        <View style={styles.services}>
          {shop.services.map((s) => {
            const def = SERVICE[s.type];
            const on = service === s.type;
            return (
              <Pressable
                key={s.type}
                onPress={() => setService(on ? null : s.type)}
                style={[BUTTON, styles.service, { backgroundColor: on ? theme.accent : theme.surface, borderColor: on ? theme.gold : theme.border }]}
              >
                <Text style={[BUTTON_TEXT, styles.serviceText, { color: on ? theme.accentInk : theme.ink }]}>{def.title} {def.price}g</Text>
              </Pressable>
            );
          })}
        </View>
        {service && (
          <View style={styles.grid}>
            {tiles.map(({ letter, count }) => {
              const bonus = run.tileBonus[letter] ?? 0;
              return (
                <Pressable
                  key={letter}
                  onPress={() => apply(() => SERVICE[service].act(run, letter))}
                  style={[styles.pill, { backgroundColor: theme.tile, borderColor: theme.tileEdge }]}
                >
                  <Text style={[styles.chipLetter, { color: theme.tileInk }]}>{letter.toUpperCase()}</Text>
                  <Text style={[styles.chipCount, { color: theme.subtle }]}>×{count}{bonus ? ` +${bonus}` : ''}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <Text style={[styles.section, { color: theme.subtle }]}>OWNED</Text>
        <View style={styles.ownedRow}>
          {owned.map((r) => (
            <RelicIcon key={r.id} {...iconProps} relic={r} size={24} active={focus === r.id} />
          ))}
        </View>
        <RelicCaption theme={theme} relic={ownedFocus} prompt={owned.length ? 'hover or tap a relic to read it, then sell' : 'none owned'}>
          {ownedFocus && (
            <Pressable
              onPress={() => { setPinned(null); apply(() => sellRelic(run, ownedFocus.id)); }}
              style={btn(true)}
            >
              <Text style={btnText(true)}>SELL {sellPrice(ownedFocus)}g</Text>
            </Pressable>
          )}
        </RelicCaption>
      </ScrollView>
      <Pressable
        onPress={() => { leaveShop(run); onLeave(); }}
        style={[BUTTON, styles.leave, { backgroundColor: theme.accent, borderColor: theme.gold }]}
      >
        <Text style={[BUTTON_TEXT, { color: theme.accentInk, fontSize: 16 }]}>NEXT ROUND</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 3 },
  title: { ...HEADING, fontSize: 20, letterSpacing: 4 },
  gold: { fontFamily: FONT.display, fontSize: 18, fontWeight: '700' },
  body: { padding: 16, gap: 10 },
  notice: { ...BODY, fontSize: 14, textAlign: 'center' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: { ...HEADING, fontSize: 12, marginTop: 6 },
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, gap: 10 },
  cardText: { flex: 1 },
  cardTitle: { ...HEADING, fontSize: 13, letterSpacing: 1 },
  cardLabel: { ...BODY, fontSize: 14, minHeight: 18 },
  cardTag: { ...BODY, fontSize: 12, marginTop: 2 },
  empty: { ...BODY, fontSize: 14, fontStyle: 'italic' },
  btn: { paddingHorizontal: 12, paddingVertical: 7 },
  btnText: { fontSize: 11, letterSpacing: 1 },
  services: { flexDirection: 'row', gap: 8 },
  service: { flex: 1, paddingVertical: 10, paddingHorizontal: 6 },
  serviceText: { fontSize: 11, letterSpacing: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { width: 44, borderWidth: 2, borderRadius: 3, alignItems: 'center', paddingVertical: 4 },
  chipLetter: { fontFamily: FONT.display, fontSize: 16, fontWeight: '700' },
  chipCount: { fontFamily: FONT.display, fontSize: 10, fontWeight: '700' },
  ownedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  leave: { margin: 16, paddingVertical: 14 },
});
