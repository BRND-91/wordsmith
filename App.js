import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, TextInput, ActivityIndicator, useColorScheme, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { loadGameData } from './src/ui/assets.js';
// Extensionless on purpose: Metro resolves db.web.js on web and db.js native
// only when the import carries no extension.
import { initDb, loadRun } from './src/ui/db';
import { themeFor, BODY } from './src/ui/theme.js';
import GameScreen from './src/ui/GameScreen.js';

// The two faces theme.js names, served out of public/fonts (copied to the site
// root by expo export). Registered once at module load so the first paint
// already has them.
if (Platform.OS === 'web') {
  const style = document.createElement('style');
  style.textContent = [
    "@font-face{font-family:'Cinzel';src:url('/fonts/Cinzel.ttf') format('truetype');font-weight:400 900;font-display:swap}",
    "@font-face{font-family:'IM Fell English';src:url('/fonts/IMFellEnglish-Regular.ttf') format('truetype');font-style:normal;font-display:swap}",
    "@font-face{font-family:'IM Fell English';src:url('/fonts/IMFellEnglish-Italic.ttf') format('truetype');font-style:italic;font-display:swap}",
  ].join('');
  document.head.appendChild(style);
}

async function openStore() {
  const db = await initDb();
  return { db, saved: await loadRun(db) };
}

// `?dump` shows the raw save blob as selectable text, for bug reports from a
// browser with no devtools reachable. Native has no `location`.
const DUMP_MODE = Boolean(globalThis.location && new URLSearchParams(globalThis.location.search).has('dump'));

function SaveDump({ theme, db }) {
  const blob = db.get('run') ?? db.get('run.tmp') ?? '(no saved run)';
  return (
    <View style={styles.dump}>
      <Text style={{ color: theme.subtle, marginBottom: 8 }}>Saved run. Tap the box, select all, copy.</Text>
      <TextInput
        multiline
        editable={false}
        selectTextOnFocus
        value={blob}
        style={[styles.dumpBox, { color: theme.ink, borderColor: theme.subtle }]}
      />
    </View>
  );
}

export default function App() {
  const scheme = useColorScheme();
  const theme = themeFor(scheme);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([loadGameData(), openStore()])
      .then(([game, store]) => setData({ ...game, ...store }))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {error ? (
        <View style={styles.center}>
          <Text style={[BODY, { color: theme.bad }]}>Failed to load word list: {error}</Text>
        </View>
      ) : data && DUMP_MODE ? (
        <SaveDump theme={theme} db={data.db} />
      ) : data ? (
        <GameScreen theme={theme} dict={data.dict} db={data.db} saved={data.saved} />
      ) : (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} />
          <Text style={[BODY, { color: theme.subtle, marginTop: 12 }]}>Loading dictionary…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dump: { flex: 1, padding: 16 },
  dumpBox: { flex: 1, borderWidth: 1, borderRadius: 6, padding: 8, fontFamily: 'monospace', fontSize: 12 },
});
