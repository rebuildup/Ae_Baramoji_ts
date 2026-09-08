// Rebuild release/Ae_Baramoji/Baramoji.zip from the seven .jsx files in
// dist/. Uses the archiver npm package for cross-platform zip creation
// (system `zip` is not always available on Windows).
//
// Usage: node scripts/release-zip.mjs [output-path]
//        Default output: release/Ae_Baramoji/Baramoji.zip

import { createWriteStream, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import archiver from 'archiver';

const DIST = resolve('dist');
const DEFAULT_TARGET = resolve('release/Ae_Baramoji/Baramoji.zip');
const TARGET = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_TARGET;

const expected = [
  'Baramoji.jsx',
  'Baramoji_txt.jsx',
  'Baramoji_txt_win.jsx',
  'Baramoji_shape.jsx',
  'Baramoji_shape_win.jsx',
  'Baramoji_part.jsx',
  'Baramoji_part_win.jsx',
];

function listJsx() {
  const present = readdirSync(DIST).filter((f) => f.endsWith('.jsx'));
  return present.sort();
}

function main() {
  const files = listJsx();
  if (files.length === 0) {
    console.error(`release-zip: no .jsx files found in ${DIST}; run npm run build first`);
    process.exit(1);
  }
  const missing = expected.filter((e) => !files.includes(e));
  if (missing.length) {
    console.error(`release-zip: expected files missing from dist/: ${missing.join(', ')}`);
    process.exit(1);
  }

  const output = createWriteStream(TARGET);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise((resolveP, rejectP) => {
    output.on('close', () => {
      console.log(`release-zip: wrote ${TARGET} (${archive.pointer()} bytes, ${files.length} files)`);
      resolveP(undefined);
    });
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') console.warn(`release-zip: warning ${err.message}`);
      else rejectP(err);
    });
    archive.on('error', rejectP);
    archive.pipe(output);

    for (const f of files) {
      archive.file(join(DIST, f), { name: f });
    }
    archive.finalize();
  });
}

main().catch((err) => {
  console.error('release-zip failed:', err);
  process.exit(1);
});