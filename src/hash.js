// FNV-1a, 32-bit. A small dependency-free hash for two jobs: the ruleset stamp
// that lets a share payload know it was scored under the same rules, and the
// save-blob checksum that catches a torn or tampered write. Returned as an
// 8-char lowercase hex string so it reads cleanly in a payload and a DB cell.
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function fnv1a(str) {
  let h = FNV_OFFSET;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
