// Verify a Baramoji download against a checksums.txt (sha256sum-compatible).
//
// Usage:
//   node scripts/verify-zip.mjs <checksums.txt> [base-dir]
//
// The base-dir defaults to the directory that contains checksums.txt itself.
// If a referenced file is not found under that base-dir, the script tries
// the cwd and the parent of the checksums directory (covers in-repo
// invocations where the manifest records repo-root-relative paths but the
// user is at the project root). If those still don't resolve, the entry is
// reported as MISSING — the script does NOT fall through to a basename scan
// of sibling directories, because such a scan could mask a missing-file error
// by passing verification against an unrelated same-named file in a sibling
// folder. An explicit base-dir argument lets the caller point at any layout.
//
// Exit codes:
//   0 — all entries matched
//   1 — verification failure: mismatch, missing file, malformed line, or
//       empty manifest
//   2 — usage error or the manifest file itself is missing / unreadable
//       (Note: this is intentional. A missing referenced file is a
//       verification failure — exit 1 — not a usage error. Exit 2 means
//       the user invoked the script incorrectly or the manifest itself
//       could not be opened.)

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('usage: node scripts/verify-zip.mjs <checksums.txt> [base-dir]');
  process.exit(2);
}

const checksumsPath = resolve(args[0]);
const explicitBaseDir = args[1];

if (!existsSync(checksumsPath)) {
  console.error(`verify-zip: ${checksumsPath} not found`);
  process.exit(2);
}

const text = readFileSync(checksumsPath, 'utf8');
const lines = text.split('\n').filter((l) => l.length > 0);

// sha256sum-compatible regex. Two output formats are recognised:
//   text    : "<64 hex><space><space><filename>"
//   binary  : "<64 hex><space>*<filename>"   (from `sha256sum -b`)
// The optional `*` is a binary-mode marker; we MUST consume it explicitly
// (otherwise the `*` ends up captured as part of the filename and the
// file goes missing).
const LINE_RE = /^([0-9a-fA-F]{64})(?: {2}| \*)(\S.*|)$/;

if (lines.length === 0) {
  console.error('verify-zip: manifest is empty; nothing to verify (exit 1)');
  process.exit(1);
}

const checksumsDir = dirname(checksumsPath);
const cwd = process.cwd();
const defaultBaseDir = explicitBaseDir
  ? resolve(explicitBaseDir)
  : checksumsDir;

// Additional base-dir candidates for in-repo usage: when the manifest lives
// in `dist/` and records repo-root-relative paths, the user-friendly default
// is the current working directory (the project root).
const altBaseDirs = explicitBaseDir
  ? []
  : [cwd, resolve(checksumsDir, '..')].filter((d) => d !== defaultBaseDir);

// Memoize existsSync results across the lifetime of this invocation. Each
// manifest entry repeats the same basename lookups for default + alt +
// sibling base-dirs; without memoisation we'd touch the filesystem O(N × M)
// times where N is the entry count and M is the base-dir count. The cache
// is invalidated when the script exits — entries that don't exist stay
// absent for the duration of the run.
const existsCache = new Map();
function cachedExists(absPath) {
  if (!existsCache.has(absPath)) {
    existsCache.set(absPath, existsSync(absPath));
  }
  return existsCache.get(absPath);
}

function resolvePath(relPath) {
  if (isAbsolute(relPath)) return relPath;
  if (relPath === '') return null;
  // Resolve against the default base-dir (the directory that contains
  // checksums.txt), then fall back to any additional base-dirs (cwd + parent
  // of checksumsDir for in-repo usage). If none of those resolve, return the
  // direct path so the caller's existence check produces a clear MISSING —
  // never silently fall through to a sibling-dir scan (CodeRabbit #3:
  // such a scan could pass verification against an unrelated same-named
  // file in a sibling folder, which is a security smell).
  const direct = join(defaultBaseDir, relPath);
  if (cachedExists(direct)) return direct;
  for (const alt of altBaseDirs) {
    const candidate = join(alt, relPath);
    if (cachedExists(candidate)) return candidate;
  }
  return direct;
}

let failures = 0;
let checked = 0;
let malformed = 0;

for (const line of lines) {
  const m = line.match(LINE_RE);
  if (!m) {
    console.error(`verify-zip: malformed line: ${line}`);
    failures += 1;
    malformed += 1;
    continue;
  }
  const expected = m[1].toLowerCase();
  const relPath = m[2].trim();
  if (relPath === '') {
    console.error(`verify-zip: empty filename in line: ${line}`);
    failures += 1;
    malformed += 1;
    continue;
  }
  const absPath = resolvePath(relPath);
  if (!absPath || !existsSync(absPath)) {
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
  const malformedNote = malformed > 0 ? ` (${malformed} malformed)` : '';
  const checkedNote = checked > 0 ? ` out of ${checked} checked` : '';
  console.error(`verify-zip: ${failures} failure(s)${checkedNote}${malformedNote}`);
  process.exit(1);
}
console.log(`verify-zip: all ${checked} file(s) match`);