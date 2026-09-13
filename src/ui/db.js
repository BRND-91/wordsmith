import * as SQLite from 'expo-sqlite';
import { encodeSave, decodeSave } from '../save.js';
import { makeScoreboard } from '../highscores.js';

// The persistence layer: expo-sqlite backing the pure save/highscore modules. The
// in-progress run is one versioned blob (from save.js) held in a single-row
// table; meta and per-seed high scores get real columns. run_save keeps two rows
// — id 1 main, id 2 temp — so the write-temp-then-swap runs inside one
// transaction: temp takes the blob, main is overwritten, temp is cleared, and a
// torn write leaves the prior main recoverable.
const RUN_MAIN = 1;
const RUN_TMP = 2;

export async function initDb() {
  const db = await SQLite.openDatabaseAsync('wordsmith.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS run_save (id INTEGER PRIMARY KEY, blob TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS highscores (seed INTEGER PRIMARY KEY, best INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  return db;
}

export async function saveRun(db, run) {
  const blob = encodeSave(run);
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT OR REPLACE INTO run_save (id, blob) VALUES (?, ?)', RUN_TMP, blob);
    await db.runAsync('INSERT OR REPLACE INTO run_save (id, blob) VALUES (?, ?)', RUN_MAIN, blob);
    await db.runAsync('DELETE FROM run_save WHERE id = ?', RUN_TMP);
  });
}

export async function loadRun(db) {
  const main = await db.getFirstAsync('SELECT blob FROM run_save WHERE id = ?', RUN_MAIN);
  const row = main ?? (await db.getFirstAsync('SELECT blob FROM run_save WHERE id = ?', RUN_TMP));
  if (!row) return { ok: false, reason: 'empty' };
  return decodeSave(row.blob);
}

export async function clearRun(db) {
  await db.runAsync('DELETE FROM run_save');
}

export async function recordHighScore(db, seed, total) {
  await db.runAsync(
    'INSERT INTO highscores (seed, best) VALUES (?, ?) ON CONFLICT(seed) DO UPDATE SET best = MAX(best, excluded.best)',
    seed,
    total,
  );
}

export async function loadScoreboard(db) {
  const rows = await db.getAllAsync('SELECT seed, best FROM highscores');
  return makeScoreboard(rows);
}

export async function getMeta(db, key) {
  const row = await db.getFirstAsync('SELECT value FROM meta WHERE key = ?', key);
  return row ? row.value : null;
}

export async function setMeta(db, key, value) {
  await db.runAsync(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}
