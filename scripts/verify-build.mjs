// Verify that dist/*.jsx files exist, are syntactically valid, do not
// contain ES5+ syntax, and have the expected MIT header.
//
// We don't byte-compare against the originals because Rollup wraps entries
// in an outer IIFE; the user's plan accepts this since the goal is a single
// bundled .jsx, not byte equivalence.
//
// Usage: node scripts/verify-build.mjs

import { readdirSync, readFileSync, existsSync, mkdtempSync, writeFileSync, unlinkSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const DIST = resolve('dist');
const EXPECTED = [
  'Baramoji.jsx',
  'Baramoji_txt.jsx',
  'Baramoji_txt_win.jsx',
  'Baramoji_shape.jsx',
  'Baramoji_shape_win.jsx',
  'Baramoji_part.jsx',
  'Baramoji_part_win.jsx',
];

const HEADER_PREFIX = '// Baramoji — MIT License';

const FORBIDDEN_PATTERNS = [
  { name: 'arrow-function', re: /=>/g },
  { name: 'const-binding', re: /\bconst\s+[A-Za-z_$]/g },
  { name: 'let-binding', re: /\blet\s+[A-Za-z_$]/g },
  { name: 'template-literal', re: /`/g },
  { name: 'rest-spread', re: /\.\.\.\s*[A-Za-z_$]/g },
];

let failed = 0;

function listJsx() {
  if (!existsSync(DIST)) {
    console.error(`verify-build: ${DIST} does not exist; run npm run build first`);
    process.exit(1);
  }
  return readdirSync(DIST).filter((f) => f.endsWith('.jsx')).sort();
}

function checkExistence(files) {
  const missing = EXPECTED.filter((e) => !files.includes(e));
  if (missing.length) {
    console.error(`verify-build: missing expected files: ${missing.join(', ')}`);
    failed++;
  } else {
    console.log(`verify-build: ✓ all 7 expected files present`);
  }
}

function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

function checkSyntax(file) {
  const path = join(DIST, file);
  // node --check refuses unknown extensions; copy to a .js tempfile.
  const tmpdir_ = mkdtempSync(join(tmpdir(), 'baramoji-verify-'));
  const tmp = join(tmpdir_, file.replace(/\.jsx$/, '.js'));
  writeFileSync(tmp, readFileSync(path, 'utf8'));
  try {
    execFileSync('node', ['--check', tmp], { stdio: ['ignore', 'ignore', 'pipe'] });
    console.log(`verify-build: ✓ ${file} syntax OK`);
  } catch (err) {
    console.error(`verify-build: ✗ ${file} syntax error:\n${err.stderr.toString()}`);
    failed++;
  } finally {
    rmSync(tmpdir_, { recursive: true, force: true });
  }
}

function checkHeader(file) {
  const path = join(DIST, file);
  const head = readFileSync(path, 'utf8').split('\n', 1)[0];
  if (!head.startsWith(HEADER_PREFIX)) {
    console.error(`verify-build: ✗ ${file} first line is "${head}", expected "${HEADER_PREFIX}..."`);
    failed++;
  } else {
    console.log(`verify-build: ✓ ${file} header OK`);
  }
}

function checkIifePresent(file) {
  // Rollup wraps entries in an outer IIFE; the user's plan accepts this.
  // We just check that the file contains an IIFE invocation somewhere near
  // the end of the script body.
  const path = join(DIST, file);
  const src = readFileSync(path, 'utf8');
  const tail = src.trimEnd();
  const hasIife = /\}\)\s*\(\s*(this|undefined)?\s*\)\s*;?\s*$/.test(tail)
    || /\}\)\(\s*this\s*\)\s*;?\s*$/.test(tail)
    || /\}\)\(\)\s*;?\s*$/.test(tail);
  if (!hasIife) {
    console.error(`verify-build: ✗ ${file} does not end with an IIFE invocation`);
    failed++;
  } else {
    console.log(`verify-build: ✓ ${file} IIFE invocation present`);
  }
}

function checkNoEs5Plus(file) {
  const path = join(DIST, file);
  const lines = readFileSync(path, 'utf8').split('\n');
  const leaks = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line)) continue;
    for (const pat of FORBIDDEN_PATTERNS) {
      const m = pat.re.exec(line);
      if (m) leaks.push(`  line ${i + 1}: ${pat.name}: ${m[0]} — ${line.trim()}`);
    }
  }
  if (leaks.length) {
    console.error(`verify-build: ✗ ${file} contains ES5+ syntax:`);
    for (const l of leaks) console.error(l);
    failed++;
  } else {
    console.log(`verify-build: ✓ ${file} ES3-clean`);
  }
}

function main() {
  const files = listJsx();
  checkExistence(files);
  for (const f of files) {
    checkSyntax(f);
    checkHeader(f);
    checkIifePresent(f);
    checkNoEs5Plus(f);
  }
  if (failed > 0) {
    console.error(`\nverify-build: FAILED with ${failed} check failure(s)`);
    process.exit(1);
  }
  console.log(`\nverify-build: all checks passed for ${files.length} file(s)`);
}

main();