// The local per-seed high-score table behind the honest leaderboard: one best
// total per seed, so a daily's seed compares against your own prior runs and
// against a pasted share of the same seed. Kept as pure Map logic; the SQLite
// layer persists toRows()/makeScoreboard() to a real per-seed column table.
export function makeScoreboard(rows = []) {
  const board = new Map();
  for (const r of rows) {
    const [seed, best] = Array.isArray(r) ? r : [r.seed, r.best ?? r.total];
    board.set(seed, best);
  }
  return board;
}

export function record(board, seed, total) {
  const prev = board.has(seed) ? board.get(seed) : -Infinity;
  if (total > prev) {
    board.set(seed, total);
    return { improved: true, best: total };
  }
  return { improved: false, best: prev };
}

export function best(board, seed) {
  return board.has(seed) ? board.get(seed) : null;
}

export function bestOverall(board) {
  let top = null;
  for (const v of board.values()) if (top === null || v > top) top = v;
  return top;
}

export function toRows(board) {
  return [...board.entries()].map(([seed, best]) => ({ seed, best }));
}
