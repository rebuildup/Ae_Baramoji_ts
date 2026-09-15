# AGENTS — Ae_Baramoji_ts

このファイルは root agent (Coordinator / fresh agent) 向けの dispatcher です。
project が定める canonical policy / architecture / workflow への入口だけをここに置き、
詳細本文は `docs/` 配下に progressive disclosure しています。

実装作業の前に必ず次の順で確認してください。

## 1. 読む順序

1. `README.md` — プロジェクトの位置付け
2. `docs/architecture.md` — source/work SoT、build / sync / release の依存方向
3. `docs/development.md` — bootstrap、scripts、validation entry point
4. `docs/quality-profile.md` — このプロジェクト固有の quality gate
5. `docs/release.md` — release sprint workflow と Draft PR 契約
6. `docs/security.md` — security advisory intake と secret 扱い
7. `docs/recovery.md` — context / sandbox 消失時の復旧手順
8. `docs/troubleshooting.md` — 典型障害と切り分け
9. `docs/onboarding.md` — fresh contributor / agent の最短経路
10. `docs/decisions/` — ADR (意思決定の記録)。特に:
    - `0012-release-merge-authorization.md` — release PR merge の user authorization 境界
    - `0013-public-main-protection-with-release-source-check.md` — main 保護の release-source check
    - `0002-skills-policy.md` — Skill 導入の defer 判断と再評価 trigger

release-source check の実装は `.github/workflows/release-source-check.yml`
を参照 (ADR-0013)。

## 2. 意思決定の precedence

判断は次の順で確認する。同一 level で矛盾する場合は、より specific かつ新しい
canonical source を優先する (policy §4)。

1. `docs/decisions/` 配下の ADR (特に 0012 / 0013)
2. `docs/architecture.md`, `docs/development.md`, `docs/release.md` の invariant
3. 既存実装の大勢 (coherent majority)
4. 利用 framework / runtime / SDK の current official guidance
5. 確立された ecosystem convention
6. ローカル判断

## 3. 運用ルール

- `main` = released state。 直接 push しない。
- active sprint = `release-x-y-z` branch。
- ticket branch = `<issue-number>` のみ。prefix / slug / title を含めない。
- commit message は英語、Issue / PR は日本語、source code は英語。
- secret を commit / log / checkpoint / agent result に含めない。
- submodule (`release/Ae_Baramoji/`) 内は直接編集しない (配布リポ)。
- 配布リポへの反映は `npm run release:sync` 経由のみ。
- release PR (`release-x-y-z -> main`) の merge / `v*` tag push /
  ruleset mutation は **user authorization 境界 (ADR-0012)**。Ready-to-merge
  状態まで進めて STOP、merge そのものは user が明示 authorize した時にのみ実行。
- main への配信経路は release-source check (`.github/workflows/release-source-check.yml`,
  ADR-0013) で必須 gate。
- 工程や判断に迷ったら user escalation せず、まず `docs/decisions/` と
  `docs/architecture.md` を確認する (自己解決できないものだけ escalate)。

## 4. Validation entry point

```bash
bun install --frozen-lockfile
bun run type-check
bun run lint
bun run test
bun run build
bun run verify
```

CI は `.github/workflows/ci.yml` が同じ entry point を順に実行する。
完了条件は「6 コマンドすべて green」。

## 5. Recovery entry point

fresh agent / 別 sandbox からの再開は `docs/recovery.md` を最優先で読む。
会話履歴・private memory・IDE state に依存せず、Git / Issue / PR / checkpoint
から再構成する。

## 6. Skill discovery

project-local Skill は `.agents/skills/` 配下。`bunx skills list` で発見できる。
新規 Skill 追加は `docs/decisions/` 配下の ADR と合わせて行う。
global 設定は project truth にしない。
