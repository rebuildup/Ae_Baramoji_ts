// Compute SHA-256 checksums for build artifacts, emitting a manifest in
// `sha256sum -c` compatible text format.
//
// Two outputs are supported:
//
//   node scripts/checksums.mjs                       # public manifest (default)
//   node scripts/checksums.mjs --internal            # also write internal manifest
//   node scripts/checksums.mjs [output-path]         # override public output path
//
// The PUBLIC manifest lists only the artifacts that ship in the GitHub Release
// (`Baramoji.zip`) and records them by their published basename, so users can
// download `Baramoji.zip` + `checksums.txt` into the same folder and verify
// with either `sha256sum -c checksums.txt` or `node scripts/verify-zip.mjs`.
//
// The INTERNAL manifest records every built .jsx file in dist/ with paths
// relative to the project root, so `sha256sum -c dist/checksums-internal.txt`
// works from the repo root in CI.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, resolve, basename } from 'node:path';

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

// Repo-root-relative paths for the internal manifest so plain
// `sha256sum -c dist/checksums-internal.txt` works from the repo root.
const INTERNAL_FILES = FILES.map((f) => ({
  rel: relative(ROOT, join(DIST, f)),
  abs: join(DIST, f),
}));
const INTERNAL_ZIP = {
  rel: relative(ROOT, ZIP_PATH),
  abs: ZIP_PATH,
};

// The PUBLIC manifest records the ZIP by its published basename so users can
// download `Baramoji.zip` + `checksums.txt` into one folder and verify.
const PUBLIC_ZIP = { rel: 'Baramoji.zip', abs: ZIP_PATH };

// Parse argv explicitly: separate flags from positional args, validate that
// the positional is well-formed.
function parseArgs(argv) {
  const positional = [];
  let internal = false;
  for (const a of argv) {
    if (a === '--internal') internal = true;
    else if (a.startsWith('--')) {
      throw new Error(`unknown flag: ${a}`);
    } else positional.push(a);
  }
  if (positional.length > 1) {
    throw new Error(
      `unexpected extra arguments: ${positional.slice(1).join(' ')} (expected at most one output path)`,
    );
  }
  return { internal, outPath: positional[0] };
}

function hashFile(absPath) {
  const buf = readFileSync(absPath);
  return createHash('sha256').update(buf).digest('hex');
}

function ensureFile(absPath) {
  if (!existsSync(absPath)) {
    console.error(`checksums: missing ${absPath}`);
    process.exit(1);
  }
}

function writeManifest(targetPath, entries, kind) {
  if (entries.length === 0) {
    console.error(`checksums: refusing to write empty manifest to ${targetPath}`);
    process.exit(1);
  }
  const lines = entries.map((e) => `${e.hash}  ${e.rel}`);
  writeFileSync(targetPath, lines.join('\n') + '\n');
  // Tag each line so log scrapers can attribute it to the right manifest.
  console.log(`# ${kind}: ${targetPath}`);
  for (const e of entries) console.log(`${e.hash}  ${e.rel}`);
  console.log(`checksums: wrote ${basename(targetPath)} (${lines.length} entries)`);
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`checksums: ${e.message}`);
    process.exit(2);
  }
  const outPath = args.outPath || join(DIST, 'checksums.txt');
  const internalOutPath = join(DIST, 'checksums-internal.txt');

  if (!existsSync(DIST)) {
    console.error(`checksums: ${DIST} does not exist; run \`bun run build\` first`);
    process.exit(1);
  }

  // Public manifest: only the published Baramoji.zip, recorded by basename.
  ensureFile(PUBLIC_ZIP.abs);
  writeManifest(
    outPath,
    [{ rel: PUBLIC_ZIP.rel, hash: hashFile(PUBLIC_ZIP.abs) }],
    'public',
  );

  if (args.internal) {
    // Internal manifest: every .jsx build artifact + the ZIP, paths relative
    // to project root so `sha256sum -c` works from the repo root.
    const internalEntries = [];
    for (const entry of [...INTERNAL_FILES, INTERNAL_ZIP]) {
      ensureFile(entry.abs);
      internalEntries.push({ rel: entry.rel, hash: hashFile(entry.abs) });
    }
    writeManifest(internalOutPath, internalEntries, 'internal');
  }
}

main();