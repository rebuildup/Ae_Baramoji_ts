# Development — Ae_Baramoji_ts

実装着手前に必ず `docs/architecture.md` を読む。

## 1. 必要環境

- Node.js >= 20
- Bun (`/home/basic/.bun/bin/bun`) — Skill CLI に利用
- git >= 2.30 (`submodules: recursive` 対応)
- macOS / Linux / WSL2 のいずれか

ExtendScript 実機検証は After Effects が必要 (任意)。

## 2. Bootstrap

```bash
git clone --recurse-submodules https://github.com/rebuildup/Ae_Baramoji_ts.git
cd Ae_Baramoji_ts
npm ci
git submodule update --init --recursive
```

submodule は配布リポ `rebuildup/Ae_Baramoji` を参照する。
配布リポへの push 権限が必要な場合は `secrets.GH_PAT` (両方リポに write) を使う。
詳細は `docs/security.md` を参照。

## 3. Scripts

| script | 用途 | CI 対応 |
|---|---|---|
| `npm run build` | `dist/*.jsx` 7本生成 | ✓ |
| `npm run watch` | rollup watch mode | - |
| `npm run type-check` | `tsc --noEmit` | ✓ |
| `npm run lint` | `eslint src/**/*.ts` | ✓ |
| `npm run format` | `prettier --check` | - |
| `npm run clean` | `rimraf dist` | - |
| `npm run verify` | 出力 .jsx の構文 / ES3 / IIFE / ヘッダ検査 | ✓ |
| `npm run release:zip` | 7 .jsx → `Baramoji.zip` | ✓ (release workflow) |
| `npm run release:sync` | 配布 submodule へ sync | ✓ (release workflow) |
| `npm run release` | clean → build → verify → sync | - |

`release` workflow は CI 専用。ローカルの動作確認には `release:zip` / `release:sync` を
個別に使う。`release:sync` には `--dry-run` フラグあり。

## 4. Validation entry point (canonical)

```bash
npm ci            # 依存解決
npm run type-check
npm run lint
npm run build
npm run verify
```

5 コマンドすべて green で「worker gate 通過」とみなす。
CI (`ci.yml`) も同じ順で実行される。

CI とローカルの差は:

- CI: Linux + Node 20固定、キャッシュあり
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

## 6. 推奨ツール

- text search: `rg` / `rg --files`
- package manager: npm (Bun は Skill discovery のみ、ビルドは npm)
- validator: `node --check` (構文) + `scripts/verify-build.mjs` (ES3 / IIFE)
- Skill discovery: `bunx skills list`

## 7. ローカルで submodule を触りたい場合

submodule 内 (`release/Ae_Baramoji/`) は直接編集禁止。
どうしても見る必要がある場合:

```bash
git -C release/Ae_Baramoji log --oneline -5
```

変更が必要なら本リポ側でビルドし直すこと。
dry-run で動作確認する場合は `npm run release:sync -- --dry-run`。
