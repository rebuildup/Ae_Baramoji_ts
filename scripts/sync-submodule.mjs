// Sync the seven built .jsx files (plus Baramoji.zip) from dist/ into the
// release/Ae_Baramoji submodule, commit, and push both the submodule and the
// parent repo.
//
// Reads parent HEAD sha for the commit message. Uses git commands rather than
// git libraries so that pre-commit hooks / signing config are honored.
//
// Usage: node scripts/sync-submodule.mjs [--dry-run]
//
// Requires:
//   - git submodule at release/Ae_Baramoji pointing to the distribution repo
//   - write access to that distribution repo

import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve('.');
const DIST = join(ROOT, 'dist');
const SUBMODULE_DIR = join(ROOT, 'release', 'Ae_Baramoji');

const FILES = [
  'Baramoji.jsx',
  'Baramoji_txt.jsx',
  'Baramoji_txt_win.jsx',
  'Baramoji_shape.jsx',
  'Baramoji_shape_win.jsx',
  'Baramoji_part.jsx',
  'Baramoji_part_win.jsx',
];

const README_NOTICE = [
  '',
  '> This repository contains the distributed build of Ae_Baramoji_ts.',
  '> Development takes place in https://github.com/rebuildup/Ae_Baramoji_ts',
  '',
].join('\n');

const dryRun = process.argv.includes('--dry-run');

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', stdio: 'inherit', ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} exited ${r.status}`);
  return r;
}

function ensureSubmodule() {
  if (!existsSync(join(SUBMODULE_DIR, '.git'))) {
    throw new Error(
        `${SUBMODULE_DIR} is not a git submodule. Run:\n` +
          '  git submodule add https://github.com/rebuildup/Ae_Baramoji.git release/Ae_Baramoji'
      );
  }
}

function copyBuiltFiles() {
  for (const f of FILES) {
    const src = join(DIST, f);
    const dest = join(SUBMODULE_DIR, f);
    if (!existsSync(src)) throw new Error(`missing ${src}; run npm run build first`);
    copyFileSync(src, dest);
  }
  console.log(`sync-submodule: copied ${FILES.length} .jsx files into submodule`);
}

function ensureReadmeNotice() {
  const readme = join(SUBMODULE_DIR, 'README.md');
  let content = '';
  try {
    content = readFileSync(readme, 'utf8');
  } catch {
    content = '';
  }
  if (content.includes('rebuildup/Ae_Baramoji_ts')) return false;
  const updated = README_NOTICE + (content.startsWith('\n') ? '' : '\n') + content;
  writeFileSync(readme, updated);
  console.log('sync-submodule: prepended README notice');
  return true;
}

function commitAndPushSubmodule(parentSha) {
  const msg = `Sync from Ae_Baramoji_ts @ ${parentSha.slice(0, 7)}`;
  // The submodule is checked out in detached HEAD at the SHA recorded by the
  // parent pointer. If the previous release succeeded, the submodule's remote
  // main may have advanced past that SHA. We must fetch + rebase onto the
  // current remote main before adding our new commit, otherwise the push will
  // be a non-fast-forward.
  if (!dryRun) {
    run('git', ['-C', SUBMODULE_DIR, 'fetch', 'origin', 'main']);
    try {
      run('git', ['-C', SUBMODULE_DIR, 'rebase', 'FETCH_HEAD']);
    } catch (e) {
      console.error('sync-submodule: submodule rebase failed; non-fast-forward or conflict');
      throw e;
    }
  }
  run('git', ['-C', SUBMODULE_DIR, 'add', '--', ...FILES, 'README.md', 'Baramoji.zip']);
  if (dryRun) {
    console.log(`sync-submodule: [dry-run] would commit in submodule: ${msg}`);
    return;
  }
  run('git', ['-C', SUBMODULE_DIR, 'commit', '-m', msg]);
  // Push the current HEAD explicitly to the configured upstream branch instead
  // of relying on the current branch ref, which is undefined in detached HEAD.
  run('git', ['-C', SUBMODULE_DIR, 'push', 'origin', 'HEAD:main']);
  console.log(`sync-submodule: pushed submodule (${msg})`);
}

function bumpParentSubmodulePointer(childSha) {
  run('git', ['add', 'release/Ae_Baramoji']);
  if (dryRun) {
    console.log(`sync-submodule: [dry-run] would bump parent submodule pointer to ${childSha.slice(0, 7)}`);
    return;
  }
  run('git', ['commit', '-m', `chore(release): bump Ae_Baramoji submodule to ${childSha.slice(0, 7)}`]);
  // The CI runner checks out the tag in detached HEAD. The remote main may
  // have commits the runner does not (e.g. a manual fix pushed before the
  // tag-triggered run). Fetch and rebase to integrate remote-only commits,
  // then push with an explicit refspec.
  run('git', ['fetch', 'origin', 'main']);
  try {
    run('git', ['rebase', 'FETCH_HEAD']);
  } catch (e) {
    console.error('sync-submodule: rebase failed; non-fast-forward or conflict');
    throw e;
  }
  run('git', ['push', 'origin', 'HEAD:main']);
  console.log(`sync-submodule: bumped parent pointer to ${childSha.slice(0, 7)}`);
}

function parentSha() {
  return sh('git', ['rev-parse', 'HEAD']).trim();
}

function childSha() {
  return sh('git', ['-C', SUBMODULE_DIR, 'rev-parse', 'HEAD']).trim();
}

async function main() {
  ensureSubmodule();
  if (!existsSync(DIST)) {
    throw new Error(`dist/ does not exist; run npm run build first`);
  }
  if (!existsSync(SUBMODULE_DIR)) mkdirSync(SUBMODULE_DIR, { recursive: true });

  const sha = parentSha();
  copyBuiltFiles();
  ensureReadmeNotice();
  // Re-run release-zip inside the submodule so Baramooji.zip lives next to its files
  run('node', [join(ROOT, 'scripts', 'release-zip.mjs'), join(SUBMODULE_DIR, 'Baramoji.zip')]);
  commitAndPushSubmodule(sha);

  // After pushing the submodule, get its new HEAD sha and update the parent pointer.
  const cSha = childSha();
  bumpParentSubmodulePointer(cSha);
}

main().catch((err) => {
  console.error('sync-submodule failed:', err.message);
  process.exit(1);
});