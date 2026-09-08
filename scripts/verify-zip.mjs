// Verify a Baramoji download against a checksums.txt (sha256sum-compatible).
//
// Usage:
//   node scripts/verify-zip.mjs <checksums.txt> [base-dir]
//
// The base-dir defaults to the current working directory. Every file
// referenced in the checksum file is read relative to base-dir.
//
// For users who downloaded `Baramoji.zip` and `checksums.txt` from a GitHub
// release into the same folder, paths in checksums.txt should match
// directly — but `checksums.mjs` currently writes project-root-relative
// paths (for in-repo CI verification). Re-run from the project root, or
// pass the appropriate base-dir.
//
// Exit code 0 on success, 1 on mismatch, 2 on missing files.

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('usage: node scripts/verify-zip.mjs <checksums.txt> [base-dir]');
  process.exit(2);
}

const checksumsPath = resolve(args[0]);
const baseDir = resolve(args[1] || '.');

if (!existsSync(checksumsPath)) {
  console.error(`verify-zip: ${checksumsPath} not found`);
  process.exit(2);
}

const text = readFileSync(checksumsPath, 'utf8');
const lines = text.split('\n').filter((l) => l.length > 0);

let failures = 0;
let checked = 0;

for (const line of lines) {
  // Format: "<sha256> " (two spaces, sha256sum convention).
  const m = line.match(/^([0-9a-fA-F]{64})\s+(.+)$/);
  if (!m) {
    console.error(`verify-zip: malformed line: ${line}`);
    failures += 1;
    continue;
  }
  const expected = m[1].toLowerCase();
  const relPath = m[2].trim();
  const absPath = join(baseDir, relPath);
  if (!existsSync(absPath)) {
    console.error(`verify-zip: MISSING  ${relPath}`);
    failures += 1;
    continue;
  }
  const got = createHash('sha256').update(readFileSync(absPath)).digest('hex');
  checked += 1;
  if (got !== expected) {
    console.error(`verify-zip: MISMATCH ${relPath}`);
    console.error(`  expected: ${expected}`);
    console.error(`  got:      ${got}`);
    failures += 1;
  } else {
    console.log(`verify-zip: OK       ${relPath}`);
  }
}

if (failures > 0) {
  console.error(`verify-zip: ${failures} failure(s) out of ${checked} checked`);
  process.exit(1);
}
console.log(`verify-zip: all ${checked} file(s) match`);
