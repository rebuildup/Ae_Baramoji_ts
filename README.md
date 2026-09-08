# Ae_Baramoji_ts

After Effects 用 ExtendScript (`.jsx`) 配布物 `Ae_Baramoji` の **TypeScript
ソースリポジトリ**。7 本の `.jsx` (`Baramoji.jsx` + 6 standalone variants) を
ビルドし、`Baramoji.zip` にまとめて `rebuildup/Ae_Baramoji` (submodule) へ自動
同期する。

配布リポ: https://github.com/rebuildup/Ae_Baramoji

## 役割

| リポジトリ | 役割 |
|---|---|
| `rebuildup/Ae_Baramoji_ts` (本リポ) | source-of-truth。TypeScript で開発し `.jsx` を生成 |
| `rebuildup/Ae_Baramoji` | distribution。submodule 経由で自動反映、直接編集禁止 |

## Quick start

```bash
git clone --recurse-submodules https://github.com/rebuildup/Ae_Baramoji_ts.git
cd Ae_Baramoji_ts
npm ci
git submodule update --init --recursive

npm run type-check
npm run lint
npm run build
npm run verify
```

7 本の `.jsx` が `dist/` に生成される。Build artifact の SHA-256 は release
notes に記載する。

## 配布

```bash
npm run release:zip                    # dist/ → release/Ae_Baramoji/Baramoji.zip
npm run release:sync -- --dry-run      # submodule への反映を確認
npm run release                        # clean → build → verify → sync
```

CI (`.github/workflows/release.yml`) は `v*` タグ push で自動実行。
配布 submodule / 親 pointer / GitHub Release は 1 アクションで揃う。

## ドキュメント

| doc | 用途 |
|---|---|
| [AGENTS.md](./AGENTS.md) | root agent 向け dispatcher |
| [docs/architecture.md](./docs/architecture.md) | source/work SoT、build / sync / release の依存方向 |
| [docs/development.md](./docs/development.md) | bootstrap、scripts、validation entry point |
| [docs/quality-profile.md](./docs/quality-profile.md) | quality gate, verification level |
| [docs/release.md](./docs/release.md) | sprint / tag / submodule sync workflow |
| [docs/security.md](./docs/security.md) | advisory intake、secret 扱い |
| [docs/recovery.md](./docs/recovery.md) | fresh agent 復旧手順 |
| [docs/troubleshooting.md](./docs/troubleshooting.md) | 典型障害と切り分け |
| [docs/decisions/](./docs/decisions/) | ADR |

## 開発フロー要約

1. Issue 起票 (`.github/ISSUE_TEMPLATE/{bug,feature,security}.yml`)
2. ticket branch `<issue-number>` を `main` から切る
3. `release-x-y-z` へ向けて Draft PR を出す
4. `npm run type-check && npm run lint && npm run build && npm run verify` を通す
5. reviewer 別 agent で integration 確認 → Ready → merge
6. release branch merge → tag push → CI が GitHub Release まで自動化

## License

MIT — Copyright 2025 361do_sleep

実装方針の詳細は `docs/decisions/0001-typescript-source-of-truth.md` を参照。
