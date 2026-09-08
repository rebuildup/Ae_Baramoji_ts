# Quality profile — Ae_Baramoji_ts

policy §21 に従い、このプロジェクトの stack / risk / verification level を
compile した結果。固定 bundle ではなく project-specific。

## 1. Stack profile

| layer | 採用 | version | 由来 |
|---|---|---|---|
| runtime (target) | ExtendScript 3 (JS engine) | 24.x era | `types-for-adobe` |
| compiler | TypeScript | 5.3.2 固定 | ES3 非推奨警告抑制 |
| bundler | Rollup | 4 | ExtendScript IIFE 制御 |
| type | `types-for-adobe` | ^7 | After Effects 型 |
| package manager | Bun | 1.4.2 固定 | 標準、lockfile `bun.lock` 採用 |
| Skill CLI | bunx (Bun 同梱) | latest | `bunx skills` |
| linter | ESLint | 8 | `@typescript-eslint` |
| formatter | Prettier | 3 | standard |
| git | git | >= 2.30 | submodule recursive |

## 2. Capability matrix (公式)

| capability | 公式 source | 反映先 |
|---|---|---|
| build | `tsc + rollup` | `npm run build` |
| ES3 制約 | `target: ES3` in tsconfig | `npm run verify` |
| ScriptUI Window | `types-for-adobe` + shims | `src/types/extendscript-shims.d.ts` |
| undo group | shims | `app.beginUndoGroup` |
| source-rect | shims | `layer.sourceRectAtTime` |
| 配布同期 | submodule | `scripts/sync-submodule.mjs` |
| CI | GitHub Actions first-party | `.github/workflows/{ci,release}.yml` |

## 3. Verification level by surface (policy §22)

| surface | required verification | 担当 entry point |
|---|---|---|
| pure TS logic (no ExtendScript) | unit + type-check + lint | `npm run type-check && npm run lint` |
| build artifact (`.jsx`) | build + ES3 / IIFE / header check | `npm run verify` |
| ScriptUI まわり | unit + integration (手動 AE) | `npm run build && 手動 AE smoke` |
| 配布 submodule 同期 | dry-run + 実 push | `npm run release:sync -- --dry-run`, release.yml |
| GitHub Release | release gate + zip upload | release.yml |

> unit 単独で smoke / integration を証明した扱いにしない。

## 4. Quality gate

CI (`ci.yml`) は次の順で実行。いずれか失敗でマージ不可。

1. `bun install --frozen-lockfile`
2. `bun run type-check`
3. `bun run lint`
4. `bun run clean && bun run build`
5. `bun run verify`

ローカルも同じ順 (policy §21: local と CI で同じ deterministic entry point)。

## 5. Lint / type ルール

- `@typescript-eslint/no-explicit-any` : 警告 (Phase 1 のみ多用、Phase 3 で絞る)
- `@typescript-eslint/no-unused-vars` : 警告 (Phase 2 で解消)
- `@typescript-eslint/no-non-null-assertion` : 警告
- error 化は Phase 3 以降に段階的に

## 6. テスト

Phase 1 では **unit test フレームワーク未導入** (ExtendScript の runtime が
AE 依存のため CI で実行できない)。

代わりに:

- `npm run verify` を build-artifact test として必須
- CI で After Effects は実行できないため、integration は手動 (developer local)
- 必要なら Phase 3 で `xvfb-run + Node-based mock` を使った smoke test 導入を
  検討 (low priority)

## 7. Coverage threshold

threshold を一律適用しない。Phase 1 では coverage metric 自体未測定。
Phase 3 で c8 / istanbul 等の導入可否を再評価する。

## 8. False green 禁止 (policy §23)

- skipped test / `.only` / `|| true` / blanket suppression / CI disabling
  による green の偽装を禁止。
- `npm run verify` の `node --check` を `--no-check` でバイパスしない。
- `npm run lint` の警告を error 化していないだけでパス扱いにする。

## 9. Reviewer separation

implementer 自身は PR 作成まで。Ready → merge の判断は別 reviewer (別 agent /
別 sandbox) が clean candidate から行う。clean candidate を implementer が
書いた dirty workspace と混合しない (policy §26)。
