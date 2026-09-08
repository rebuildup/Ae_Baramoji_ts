# Architecture — Ae_Baramoji_ts

このドキュメントは project の canonical architecture と invariant を定義する。
実装変更時は dependency direction を崩さないこと。

## 1. 役割

`Ae_Baramoji_ts` は **Ae_Baramoji の source-of-truth** リポジトリである。
After Effects 上で動作する ExtendScript (`.jsx`) を TypeScript から生成し、
配布リポジトリ `rebuildup/Ae_Baramoji` へ自動的に同期する。

旧リポジトリ `rebuildup/Ae_Baramoji` は **distribution repository** に役割変更済み。
直接編集禁止。すべての成果物は本リポジトリのビルド経由で配布される。

## 2. Source / Work SoT

| 区分 | 場所 | 役割 |
|---|---|---|
| released source | `main` branch | リリース済みの正本 |
| active sprint | `release-x-y-z` branch | target version の統合先 |
| ticket branch | `<issue-number>` のみ | 単一 Issue 単位の実装 |
| durable work item | GitHub Issue | 受入条件・依存・target version |
| kanban / status | GitHub Project | `Backlog → Ready → In Progress → In Review → Done` |
| source code | TypeScript (`src/`) | ExtendScript はコンパイル出力 |
| build artifact | `dist/*.jsx` (gitignore) | 中間生成物 |
| 配布成果物 | `release/Ae_Baramoji/*.jsx` + `Baramoji.zip` | 配布リポジトリへサブモジュール経由で同期 |
| canonical docs | `docs/` | AGENTS.md から progressive disclosure |
| Agent Skill | `skills/` | project-local な guidance |

会話履歴・private memory・Supervisor hidden DB・session ID は SoT にしない。

## 3. Repository 構造

```
Ae_Baramoji_ts/
├── AGENTS.md                 # root dispatcher (fresh agent 入口)
├── README.md                 # 1 ページ要約
├── LICENSE                   # MIT
├── package.json              # scripts / deps
├── tsconfig.json             # ES3 / noLib / types-for-adobe
├── rollup.config.mjs         # 7 entry → 7 dist/*.jsx
├── eslint.config.mjs         # TS lint
├── .gitignore                # node_modules / dist / .tmp 等
├── .gitmodules               # release/Ae_Baramoji submodule
├── .github/
│   ├── workflows/
│   │   ├── ci.yml            # PR/push: type-check + lint + build + verify
│   │   └── release.yml       # v* tag: build + sync + GitHub Release
│   └── ISSUE_TEMPLATE/
│       ├── bug.yml
│       ├── feature.yml
│       └── security.yml
├── docs/                     # canonical project knowledge (日本語)
│   ├── architecture.md       # このファイル
│   ├── development.md
│   ├── release.md
│   ├── security.md
│   ├── recovery.md
│   ├── troubleshooting.md
│   ├── quality-profile.md
│   └── decisions/
│       └── 0001-typescript-source-of-truth.md
├── scripts/
│   ├── verify-build.mjs      # dist/*.jsx 検証
│   ├── release-zip.mjs       # 7 dist → Baramoji.zip
│   └── sync-submodule.mjs    # submodule への sync (idempotent)
├── src/
│   ├── init.ts               # ES3 polyfill (Array.indexOf 等)
│   ├── core/                 # 共有ロジック (Phase 2 でさらに集約)
│   ├── entries/              # 7 エントリ IIFE シェル
│   └── types/                # ExtendScript shims + types-for-adobe 参照
├── skills/                   # project-local Agent Skills (Phase B)
├── release/
│   └── Ae_Baramoji/          # submodule (配布リポジトリ)
└── dist/                     # Rollup 出力 (gitignore)
```

## 4. Build pipeline

```
src/entries/*.ts
       │ rollup -c (IIFE)
       ▼
dist/*.jsx  (7 files)
       │ npm run release:zip
       ▼
release/Ae_Baramoji/Baramoji.zip
       │ npm run release:sync (submodule commit + parent pointer bump)
       ▼
rebuildup/Ae_Baramoji (配布リポ)
```

エントリの compile 後、各 `.jsx` は次の順で verify される:

1. `node --check` 構文 OK
2. 先頭行が MIT ヘッダ
3. 末尾 IIFE invocation を持つ
4. 内部に `=>` / ` const ` / ` let ` / バッククォート / スプレッド構文を含まない (ES3 互換)

ES3 互換は ExtendScript の制約に由来する。詳細は `docs/decisions/0001-`。

## 5. Dependency direction

```
src/entries/*.ts  →  src/core/*.ts  →  src/types/*.d.ts  →  types-for-adobe
       ↓                   ↓
   rollup -c          eslint --resolve
       ↓
   dist/*.jsx  →  scripts/sync-submodule  →  release/Ae_Baramoji
```

- entries → core → types の依存は単方向。
- core → types-for-adobe の直接依存は禁止。ExtendScript 固有の拡張は
  `src/types/extendscript-shims.d.ts` の `declare global` で行う。
- 配布リポへの書き込みは submodule sync 経由のみ。

## 6. 7 エントリ契約

| 出力 `.jsx` | 役割 | ScriptUI |
|---|---|---|
| `Baramoji.jsx` | 統合 palette (Texts / Shapes / Parts ボタン) | あり |
| `Baramoji_txt.jsx` | テキスト分解 (per-character text layer) | なし |
| `Baramoji_txt_win.jsx` | 同上 + progress dialog | あり (progress) |
| `Baramoji_shape.jsx` | テキスト→シェイプ分解 | なし |
| `Baramoji_shape_win.jsx` | 同上 + progress dialog | あり (progress) |
| `Baramoji_part.jsx` | テキスト→パーツ分解 (SVG path 統合) | なし |
| `Baramoji_part_win.jsx` | 同上 + progress dialog | あり (progress) |

公開 I/F (UI / file 名 / 動作) は phase をまたいで維持する。Phase 2 以降のリファクタで
公開 I/F を変更する場合は `docs/decisions/` に ADR を残す。

## 7. Submodule sync invariant

`release/Ae_Baramoji/` は read-only な配布リポ mirror として扱う。

- submodule 内は直接 push しない。`scripts/sync-submodule.mjs` のみが書き込む。
- submodule 側で起きうる手元差分は `git -C release/Ae_Baramoji reset --hard HEAD`
  する。
- submodule の upstream `main` 取り込みは Phase 4 以降に検討 (現状は自動 push のみ)。
- 配布リポ README.md の先頭 1 行は冪等に prepend される。

## 8. 拡張時のチェックリスト

新機能 / リファクタを実装する前に:

- [ ] `docs/decisions/` に ADR 起票するか確認
- [ ] 公開 I/F (エントリ名 / UI / 出力) を変更しないか確認
- [ ] `npm run type-check && npm run lint && npm run build && npm run verify`
      すべて green
- [ ] CI (`.github/workflows/ci.yml`) の step と一致
