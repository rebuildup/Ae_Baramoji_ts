# ADR 0001 — TypeScript を source of truth にする

- status: accepted
- date: 2026-09-09
- supersedes: なし
- superseded-by: なし

## Context

`rebuildup/Ae_Baramoji` リポジトリは After Effects の ExtendScript (.jsx) を
配布する。現状 7 本の .jsx を手書きで保守しており、次の問題がある:

1. 型がないためリファクタが怖い
2. lint / type-check / build 検証ができない
3. エントリ間でロジックの重複が避けられない
4. 配布リポへの取り込み手順が手動で、再現性が低い

## Decision

TypeScript を source of truth にする新しいリポジトリ `rebuildup/Ae_Baramoji_ts` を
作成し、既存の `.jsx` を TypeScript からビルドする。配布リポ
`rebuildup/Ae_Baramoji` は submodule として自動同期される artifact mirror に
役割変更する。

採用する方針:

- TS 5.3.2 (固定) + `target: ES3` + `noLib: true` (`target: ES3` 警告抑制目的で
  `ignoreDeprecations: "5.0"` 付与)
- Rollup 4 を IIFE ビルダとして使用
- `types-for-adobe@^7` を After Effects 型として参照、足りない API は
  `src/types/extendscript-shims.d.ts` で augmentation
- 配布リポへの配布は `scripts/sync-submodule.mjs` 経由のみ
- 公開 I/F (UI / ファイル名 / 出力) は後方互換維持
- 役割移行 (3 phase):
  1. Phase 0: scaffoling (config / types / scripts / CI) ✓
  2. Phase 1: literal port (エントリ 7 本を実装、build / verify green) ✓
  3. Phase 2: 共有抽出 (エントリの重複を `src/core/` へ集約)
  4. Phase 3: 厳格化 (`: any` を絞る、lint ルール強化) — 任意

## Consequences

### positive

- 7 本の .jsx すべてを TS から生成し、再現性が確保される
- build / verify / lint / type-check が CI で自動実行される
- 配布リポへの同期が push 1 回で済む
- Phase 2 以降で重複削減と型強化が安全にできる

### negative / risk

- ビルド出力の可読性が下がる (IIFE ラッパ + 型注釈で 1.2-1.5 倍の行数)
- submodule push に `secrets.GH_PAT` が必要
- `types-for-adobe` の型カバレッジ不足分は `extendscript-shims.d.ts` で
  メンテし続ける必要がある
- 既存利用者が手動編集した .jsx は submodule update で消える

## Alternatives considered

- **JSR-223 Kotlin 系 / Groovy 系**: ExtendScript 互換外
- **Babel + ES3 preset**: 既存 `.jsx` がすでに ES3 前提なので TS 経由と差がない
- **直接 JSX 維持 + 共通化のみ**: Phase 2 以降に型がないため属人性が高い
- **build artifact を releases に attach するだけ (submodule 化しない)**:
  配布リポ README とリリース物が乖離するリスクがある
