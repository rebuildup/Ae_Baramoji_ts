# Onboarding — Ae_Baramoji_ts

fresh contributor / fresh agent がチャット履歴や private memory なしで開発を
開始できるように、repository-controlled docs からの最短経路を定義する。

## 1. 読む順序 (human contributor / agent 共通)

1. `README.md` — プロジェクトの位置付け、quick start、配布の概要
2. `AGENTS.md` — root agent dispatcher。fresh agent はここから入る
3. `docs/architecture.md` — SoT / 依存方向 / build pipeline
4. `docs/development.md` — bootstrap、validation entry point、working rules
5. `docs/quality-profile.md` — quality gate と verification level
6. `docs/release.md` — sprint / Draft PR 契約 / release gate
7. `docs/security.md` — secret 扱い / submodule push / advisory intake
8. `docs/recovery.md` — context 消失 / sandbox 消失時の復旧
9. `docs/troubleshooting.md` — 典型障害と切り分け
10. `docs/decisions/` — ADR。設計の長期 decision と tradeoff のログ

## 2. bootstrap (5 分)

```bash
git clone --recurse-submodules https://github.com/rebuildup/Ae_Baramoji_ts.git
cd Ae_Baramoji_ts
bun install --frozen-lockfile
bun run type-check && bun run lint && bun run test && bun run build && bun run verify
```

5 コマンドすべて green で「動作する source-of-truth が手元にある」状態。
`dist/` に 7 本の `.jsx` が出る。

`release/Ae_Baramoji/` submodule は read-only mirror。直接触らない。

## 3. 最初の変更を PR にするまで

1. 変更前に `.github/ISSUE_TEMPLATE/` から template を選び、
   Issue を日本語で起票する。`feature.yml` / `bug.yml` / `security.yml` の
   必須項目を埋める。
2. branch は `<issue-number>` のみ。`issue/123-feat-...` のような prefix /
   slug は禁止 (`docs/development.md` §5)。
3. `release-x-y-z` へ向けて Draft PR を作成する。base は依存先に応じて
   active release branch を指定する。
4. PR description に Issue link / target release / validation 状態を
   設定する。
5. CI green + reviewer approval で Ready。release PR merge は ADR-0012
   境界に従い user authorization を待つ。

## 4. fresh agent 復旧 (model / sandbox 喪失時)

policy §16 / `docs/recovery.md` を最優先で読む。会話履歴には依存せず、

- GitHub Issue / PR / `release-x-y-z` branch / 関連 commit
- `AGENTS.md` → `docs/architecture.md` → `docs/decisions/` の順の canonical docs

から再構成する。`.checkpoint/` 配下の structured JSON があれば
implementation context 復元の起点にする。

## 5. 配布 submodule への push

`.github/workflows/release.yml` (tag `v*` trigger) だけが submodule 配下に
書き込む。**手動で submodule 内に commit を積まない**。dry-run で検証する:

```bash
bun run release:sync -- --dry-run
```

## 6. 意思決定の問い合わせ

判断に迷ったら `docs/decisions/` と `docs/architecture.md` を最初に確認する。
それで決着しない design-level の question のみ user に escalate する
(`AGENTS.md` §3 + policy §4)。

## 7. weekly sprint / target version の前提

1 sprint = 1 target semantic version。`release-x-y-z` branch を main から
切って統合先とする。sprint 期間は 1 週間 (planning cadence)。
中長期 release 見積もりは calendar 直線ではなく work unit / dependency /
throughput 評価に従う (policy §11)。

## 8. よくある質問

- **Q. skill (`bunx skills`) はいつ入れる?**
  A. まだ入れない。`docs/decisions/0002-skills-policy.md` で Phase 2/3 に
  必要な skill だけ再評価する方針。再評価 trigger (worker 2 個以上
  並列 / sandbox 採用 / Project 自動化 等) に該当したら ADR を起こす。
- **Q. submodule の upstream (`rebuildup/Ae_Baramoji` の独自更新) は?**
  A. Phase 4 以降で再評価。Phase 1/2/3 では親リポからの自動 push のみ。
- **Q. coverage threshold を入れたい**
  A. Phase 3 で再評価。Phase 1/2 では一律 threshold 適用しない
  (`docs/quality-profile.md` §7)。
