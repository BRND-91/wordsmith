import { commitSave, loadSave, KEYS } from '../save.js';
import { makeScoreboard, record, toRows } from '../highscores.js';

// Web twin of db.js with the same exported API over localStorage; Metro picks
// this file for the web platform and the sqlite one everywhere else. The save
// swap in save.js already runs on a { get, set, del } store, so the adapter is
// a key prefix around localStorage. The scoreboard is one JSON row list under
// its own key.
const PREFIX = 'wordsmith.';
const BOARD_KEY = 'highscores';
const META_PREFIX = 'meta.';

export async function initDb(storage = globalThis.localStorage) {
  return {
    get: (k) => storage.getItem(PREFIX + k),
    set: (k, v) => storage.setItem(PREFIX + k, v),
    del: (k) => storage.removeItem(PREFIX + k),
  };
}

export async function saveRun(db, run) {
  commitSave(db, run);
}

export async function loadRun(db) {
  return loadSave(db);
}

export async function clearRun(db) {
  db.del(KEYS.main);
  db.del(KEYS.tmp);
}

export async function recordHighScore(db, seed, total) {
  const board = await loadScoreboard(db);
  record(board, seed, total);
  db.set(BOARD_KEY, JSON.stringify(toRows(board)));
}

export async function loadScoreboard(db) {
  const raw = db.get(BOARD_KEY);
  return makeScoreboard(raw ? JSON.parse(raw) : []);
}

export async function getMeta(db, key) {
  return db.get(META_PREFIX + key);
}

export async function setMeta(db, key, value) {
  db.set(META_PREFIX + key, value);
}
