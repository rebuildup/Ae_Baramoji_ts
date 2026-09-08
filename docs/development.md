# Development — Ae_Baramoji_ts

実装着手前に必ず `docs/architecture.md` を読む。

## 1. 必要環境

- Bun >= 1.4 (`/home/basic/.bun/bin/bun`) — package manager、build runner、Skill CLI
- git >= 2.30 (`submodules: recursive` 対応)
- Node.js は Bun 内に同梱されていれば十分 (CI は `oven-sh/setup-bun@v2` で固定)
- macOS / Linux / WSL2 のいずれか

ExtendScript 実機検証は After Effects が必要 (任意)。

## 2. Bootstrap

```bash
git clone --recurse-submodules https://github.com/rebuildup/Ae_Baramoji_ts.git
cd Ae_Baramoji_ts
bun install --frozen-lockfile
git submodule update --init --recursive
```

`bun.lock` は commit する。再現性のため lockfile 更新は CI で検出する。

submodule は配布リポ `rebuildup/Ae_Baramoji` を参照する。
配布リポへの push 権限が必要な場合は `secrets.GH_PAT` (両方リポに write) を使う。
詳細は `docs/security.md` を参照。

## 3. Scripts

| script | 用途 | CI 対応 |
|---|---|---|
| `bun run build` | `dist/*.jsx` 7本生成 | ✓ |
| `bun run watch` | rollup watch mode | - |
| `bun run type-check` | `tsc --noEmit` | ✓ |
| `bun run lint` | `eslint src/**/*.ts` | ✓ |
| `bun run test` | `vitest run` (unit tests for `src/core/`) | ✓ |
| `bun run test:watch` | `vitest` (watch mode) | - |
| `bun run format` | `prettier --check` | - |
| `bun run clean` | `rimraf dist` | - |
| `bun run verify` | 出力 .jsx の構文 / ES3 / IIFE / ヘッダ検査 | ✓ |
| `bun run verify:zip` | `dist/checksums.txt` に対して release artifact を SHA-256 検証 | - |
| `bun run release:zip` | 7 .jsx → `Baramoji.zip` | ✓ (release workflow) |
| `bun run release:checksums` | `dist/checksums.txt` を生成 (sha256sum 互換) | ✓ (release workflow) |
| `bun run release:sync` | 配布 submodule へ sync | ✓ (release workflow) |
| `bun run release` | clean → build → verify → sync | - |

`release` workflow は CI 専用。ローカルの動作確認には `release:zip` / `release:sync` を
個別に使う。`release:sync` には `--dry-run` フラグあり。

## 4. Validation entry point (canonical)

```bash
bun install --frozen-lockfile
bun run type-check
bun run lint
bun run test
bun run build
bun run verify
```

6 コマンドすべて green で「worker gate 通過」とみなす。
CI (`ci.yml`) も同じ順で実行される。

CI とローカルの差は:

- CI: Linux + Bun 1.4.2 固定
- local: macOS / WSL / native Linux

entry point を変えない (policy §21: local と CI で同じ deterministic entry point)。

## 5. Working rules

- ticket branch は `<issue-number>` のみ。`issue/123-feat-...` のような命名は禁止。
- 1 sprint = 1 target version。`release-x-y-z` branch を main から作成。
- Draft PR は meaningful な最初の commit の直後に target を `release-x-y-z` として出す。
- merge 条件は `docs/release.md` の release gate に従う。
- commit message は英語 (`<prefix>: <title>` 形)。prefix は `feat`, `fix`,
  `chore`, `docs`, `refactor`, `test`, `build` のいずれか。
- 1 commit = 1 intent。mid-state を commit しない。
- `dist/` は commit しない (`.gitignore` で除外済み)。
- `bun.lock` は commit する (再現性のため)。

## 6. 推奨ツール

- text search: `rg` / `rg --files`
- package manager: Bun (`bun install`, `bun run`, `bunx skills`)
- validator: `node --check` (構文) + `scripts/verify-build.mjs` (ES3 / IIFE)
  - `scripts/*.mjs` は Bun 内蔵 JS runtime で実行されるが、外部依存がないため Node.js でも動く
- Skill discovery: `bunx skills list`

## 7. ローカルで submodule を触りたい場合

submodule 内 (`release/Ae_Baramoji/`) は直接編集禁止。
どうしても見る必要がある場合:

```bash
git -C release/Ae_Baramoji log --oneline -5
```

変更が必要なら本リポ側でビルドし直すこと。
dry-run で動作確認する場合は `bun run release:sync -- --dry-run`。
