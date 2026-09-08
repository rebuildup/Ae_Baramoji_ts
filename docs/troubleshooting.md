# Troubleshooting — Ae_Baramoji_ts

典型障害と切り分け。深堀りする前に `docs/architecture.md` / `docs/quality-profile.md`
を確認すること。

## 1. `bun run build` が落ちる

### 症状: `Could not resolve ../types/index` が出る

- 原因: `.d.ts` ファイルは type-only import なので Rollup が解釈しない。
- 対処: import を `import type` にするか削除する。

### 症状: 出力 `.jsx` に ES5+ 構文が混入

- 原因: tsconfig の `target` / `lib` の不整合、TS 5 の新構文が混入。
- 対処: `bun run verify` の出力を確認 → `// ES3 violation` 行を読む。
  修正: 当該行を `var x = ...` と明示的に書き換える、または `extendscript-shims.d.ts`
  の `declare global` で吸収する。

### 症状: `process is not defined` 等 Node 由来の global 参照

- 原因: init polyfill (`src/init.ts`) の import 漏れ。
- 対処: 各 entry の先頭に `import './init';` があるか確認。

## 2. `bun run verify` が落ちる

### 症状: `node --check` が失敗

- 原因: 出力 .jsx に JS 構文エラーがある。
- 対処: `scripts/verify-build.mjs` の出力から該当ファイルを temp `.js` にして
  `node --check` を再実行し、エラー行を読む。

### 症状: `IIFE invocation present` 失敗

- 原因: Rollup の `format: 'iife'` 設定、または `output.name: null` が崩れている。
- 対処: `rollup.config.mjs` を確認し、`...(function() { ... })()` のラップが残る
  設定にする。

## 3. submodule 関連

### 症状: `release/Ae_Baramoji/` が空

- 原因: `git submodule update --init --recursive` 未実行。
- 対処: clone し直すか `git submodule update --init --recursive`。

### 症状: submodule HEAD が古い (CI で push したはずが反映されない)

- 原因: `release:sync` が失敗。submodule commit author 未設定、または
  `secrets.GH_PAT` 不在。
- 対処: log で submodule 側の最新 commit を確認。`scripts/sync-submodule.mjs`
  の dry-run で再現確認。

### 症状: submodule 内に意図しない変更

- 原因: 配布リポ側で他人が push、または dry-run テストの残骸。
- 対処: `git -C release/Ae_Baramoji reset --hard HEAD`。
  本リポ側で submodule pointer を戻す commit が必要なら別途 push。

## 4. CI 関連

### 症状: `ci.yml` が submodule 取得失敗

- 原因: `actions/checkout` の `submodules: recursive` 未設定、または repo 権限不足。
- 対処: PR からの CI では submodule 完全取得は不要。release でのみ必要。

### 症状: `release.yml` が push 失敗

- 原因: `secrets.GH_PAT` 未設定、または権限不足。
- 対処: 両リポへの write を持つ PAT を再発行。

## 5. Phase 2 のバグ

### 症状: 旧エントリに重複コードが残る

- 原因: `src/core/*.ts` への抽出漏れ。
- 対処: `rg "adjustAnchorPoint\|captureBasicProperties" src/entries/` で残骸を検出。

### 症状: 共通化したのに diff で挙動が変わる

- 原因: 抽出時のロジック差 (e.g. early-return 条件)。
- 対処: `git diff` の `Baramoji.jsx` 出力と原本を `diff -u` で比較。

## 6. ES3 互換の維持

### 症状: 出力に `=>` や `const` が混ざる

- 原因: TypeScript 5 の新機能、または polyfill 漏れ。
- 対処:
  - TS の arrow function 化を `function` へ明示
  - `declare global` の shims で型を揃え、polyfill は `src/init.ts` に集約
  - `bun run verify` の grep は hot な正典

## 7. ExtendScript 実機で動かない

AE 自体の問題かコードかを切り分ける:

1. AE → File → Scripts → ScriptUI を開き、AE 内 console に `$.writeln('hello')`
   を最小で実行
2. 1 が動くなら `dist/Baramoji_txt.jsx` を単独実行
3. 2 が動かない場合、`dist/Baramoji.jsx` の IIFE 先頭に
   `$.writeln('A')` を入れてどこで止まるか確認

## 8. それでも解決しないとき

`docs/decisions/` に ADR を起こし、関連する Issue を作成。fresh agent が
事象から再構成できるよう次の情報を含める:

- 該当 command / arg
- 期待される出力
- 実際の出力 (log, error)
- 再現条件
- 既に試した workaround
- 関連 docs / commit SHA
