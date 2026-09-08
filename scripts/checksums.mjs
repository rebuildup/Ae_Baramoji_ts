// Compute SHA-256 checksums for the dist/*.jsx files plus Baramoji.zip,
// emitting sha256sum-compatible output. Used by the release workflow to
// attach a checksums.txt asset and to embed the hashes in the release body.
//
// Usage:
//   node scripts/checksums.mjs [output-path]   (default: dist/checksums.txt)
//
// The output format matches `sha256sum -c` input:
//   <hex_sha256>
// so users can verify with `sha256sum -c checksums.txt` or with
// `node scripts/verify-zip.mjs checksums.txt`.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

const ROOT = resolve('.');
const DIST = join(ROOT, 'dist');
const ZIP_PATH = join(ROOT, 'release', 'Ae_Baramoji', 'Baramoji.zip');

const FILES = [
  'Baramoji.jsx',
  'Baramoji_txt.jsx',
  'Baramoji_txt_win.jsx',
  'Baramoji_shape.jsx',
  'Baramoji_shape_win.jsx',
  'Baramoji_part.jsx',
  'Baramoji_part_win.jsx',
];

const DIST_FILES = FILES.map((f) => ({ rel: f, abs: join(DIST, f) }));
const ZIP_ENTRY = { rel: 'Baramoji.zip', abs: ZIP_PATH };

const outPath = process.argv[2] || join(DIST, 'checksums.txt');

function hashFile(absPath) {
  const buf = readFileSync(absPath);
  return createHash('sha256').update(buf).digest('hex');
}

function main() {
  if (!existsSync(DIST)) {
    console.error(`checksums: ${DIST} does not exist; run \`bun run build\` first`);
    process.exit(1);
  }
  const lines = [];
  for (const entry of [...DIST_FILES, ZIP_ENTRY]) {
    if (!existsSync(entry.abs)) {
      console.error(`checksums: missing ${entry.abs}`);
      process.exit(1);
    }
    // Write paths relative to project root so `sha256sum -c checksums.txt`
    // works when run from the repo root, regardless of whether the user
    // downloaded the assets together (one dir) or kept the repo layout.
    const relPath = entry.abs.startsWith(ROOT + '/')
      ? entry.abs.slice(ROOT.length + 1)
      : entry.rel;
    lines.push(hashFile(entry.abs) + '  ' + relPath);
  }
  const body = lines.join('\n') + '\n';
  writeFileSync(outPath, body);
  for (const line of lines) console.log(line);
  console.log(`checksums: wrote ${basename(outPath)} (${lines.length} entries)`);
}

main();
