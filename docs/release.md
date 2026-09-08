# Release — Ae_Baramoji_ts

## 1. Release sprint = target version

1 sprint = 1 semantic version。`release-<major>-<minor>-<patch>` branch を
main から作成して統合先とする。

```
main
└── release-0-2-0
    ├── 123
    ├── 124
    └── 125
```

`release-x-y-z` branch は破壊的リベース前提。ticket branch からの PR は
Draft → Ready → merge の順で進める。

## 2. Branch / tag の運用

| 用途 | 命名 | 備考 |
|---|---|---|
| released source | `main` | released SoT。直接 push しない |
| active sprint | `release-x-y-z` | main から作成 |
| ticket branch | `<issue-number>` | 例: `123` |
| tag | `v<x>.<y>.<z>` | release branch merge 後に push、CI が Release を作る |

semver:

- `MAJOR`: 公開 I/F (UI / ファイル名 / 出力フォーマット) 変更
- `MINOR`: 新エントリ追加 / 既存エントリの機能追加
- `PATCH`: bug fix / ドキュメント修正 / 内部 refactor

## 3. Release gate (CI 自動)

`.github/workflows/release.yml` は `v*` tag push で起動する:

1. checkout (submodules: recursive, token: GH_PAT)
2. `bun install --frozen-lockfile`
3. `bun run clean && bun run build && bun run verify`
4. `bun run release:sync` (配布 submodule へ push)
5. 親リポ側で submodule pointer bump を commit
6. GitHub Release 作成 + `Baramoji.zip` 添付

GH_PAT は両リポへの write を持つ PAT。`secrets.GH_PAT`。

## 4. Worker / ticket / release gate

| gate | 範囲 | 実行 |
|---|---|---|
| worker | 担当チケット内の focused 検証 | 各 commit / PR push |
| ticket integration | clean candidate での統合検証 | PR ready → merge |
| release | release-x-y-z → main 前の全段検証 | tag push 前 + CI |

ticket → release → main の順に verification level を上げる (policy §22-23):

- pure logic → unit
- build artifact → build + smoke + ES3 / IIFE check
- UI / ScriptUI → unit + integration + smoke
- release → integration + E2E (manual AE) + release check

## 5. Dry run

```bash
bun run release:zip                    # zip を release/Ae_Baramoji/ に作る
bun run release:sync -- --dry-run     # submodule / parent 変更を実際には記録しない
```

CI は dry-run しない。CI で tag を消したい場合は `git tag -d vX.Y.Z && git push --delete origin vX.Y.Z` で巻き戻し可能。

## 6. Rollback

- 配布リポの submodule を巻き戻す: `git -C release/Ae_Baramoji reset --hard <old_sha>`
  + 親側で submodule pointer を `<old_sha>` に戻す commit を push。
- 取り消した tag は `git tag -d <tag>` (ローカル) + `git push --delete origin <tag>`。
- GitHub Release の削除は web UI から手動。

## 7. Version policy notes

- 配布リポの .jsx ファイル名 (`Baramoji.jsx`, `Baramoji_*.jsx`) は破壊的変更扱い
  (MAJOR)。rename する場合は ADR を先に起こす。
- 新エントリ追加 (例 `Baramoji_new.jsx`) は MINOR。
- 既存エントリの挙動変更は PATCH、ただし ScriptUI の表示文字列変更は MINOR。

## 8. Checklist (release 前)

- [ ] `bun run type-check && bun run lint && bun run build && bun run verify` green
- [ ] release branch の全 PR merged
- [ ] CI 必須 check 全 green
- [ ] submodule pointer が最新
- [x] `dist/Baramoji.zip` の SHA-256 を release notes に記載 (`bun run release:checksums` で自動生成)
- [ ] ローカル AE で手動 smoke (`Baramoi_*.jsx` 各 1 回)

release 配布物の SHA-256 検証:

```bash
# リポ root で
bun run verify:zip dist/checksums.txt
# または
sha256sum -c dist/checksums.txt
```
