#!/usr/bin/env node
// Regenerate notes/nav-map.md: symbol->line index of src/, src/ui/, test/, tools/, App.js.
// Run after any structural edit. Line numbers drift on smaller edits; the map
// header tells readers to re-grep before trusting one.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'notes', 'nav-map.md');
const DIRS = ['src', 'src/ui', 'test', 'tools'];
const EXT = /\.(js|mjs)$/;

const HEADER = `# Nav map (wordsmith)

Symbol->line index for /opt/brendbot/projects/wordsmith. Grep the symbol here,
then Read the file with offset near that line and a tight limit; never open a
big file whole. Line numbers drift on edit: treat as "grep near here" and
confirm with a targeted Grep on the symbol before reading. Rebuild with
\`npm run navmap\`.

A \`TABLE.key\` entry is a 2-space-indented object key inside that top-level
const (a relic in POOL, a boss in BOSS_RULES, a modifier in MODIFIERS).
`;

// Top-level declarations: exported or not, function/const/let/class/default.
const TOP = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/;
// One-level object key under a top-level const, e.g. `  vowelMult: {`.
const KEY = /^  ([A-Za-z_$][\w$]*)\s*:\s*\{/;

function index(text) {
  const rows = [];
  let table = null;
  text.split('\n').forEach((line, i) => {
    const n = i + 1;
    const top = TOP.exec(line);
    if (top) {
      rows.push([top[1], n]);
      table = /=\s*\{\s*$/.test(line) ? top[1] : null;
      return;
    }
    if (/^\S/.test(line)) table = null;
    const key = table && KEY.exec(line);
    if (key) rows.push([`${table}.${key[1]}`, n]);
  });
  return rows;
}

function files() {
  const out = [join(ROOT, 'App.js')];
  for (const d of DIRS) {
    for (const f of readdirSync(join(ROOT, d))) {
      const p = join(ROOT, d, f);
      if (EXT.test(f) && statSync(p).isFile()) out.push(p);
    }
  }
  return out;
}

const parts = [HEADER];
let indexed = 0;
const entries = files().map((p) => {
  const text = readFileSync(p, 'utf8');
  return { p, text, total: text.split('\n').length };
});
entries.sort((a, b) => b.total - a.total);
for (const { p, text, total } of entries) {
  const rows = index(text);
  if (!rows.length) continue;
  indexed += 1;
  parts.push(`\n## ${relative(ROOT, p)} (${total} lines)\n`);
  parts.push(rows.map(([name, n]) => `\`${name}\`:${n}`).join(' ') + '\n');
}
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, parts.join(''));
console.log(`${OUT}: ${indexed} files indexed`);
