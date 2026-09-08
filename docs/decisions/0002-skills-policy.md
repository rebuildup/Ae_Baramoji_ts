# ADR 0002 — Phase 1 では Skill を導入しない

- status: accepted
- date: 2026-09-09
- supersedes: なし
- superseded-by: なし

## Context

policy §10 に「必要な Skill だけを導入」「source / trust / maintenance /
reproducibility を評価」とある。policy 自体は 8 個の standard Skill 候補
(`parallel-orchestration`, `sandbox-runtime`, `github-delivery`,
`quality-gate`, `engineering-decisions`, `security-maintenance`,
`onboarding`, `agent-recovery`) を挙げている。

## Decision

Phase 1 では **Skill を導入しない**。

理由:

1. 当プロジェクトの workflow は **薄い TypeScript build pipeline** で、
   policy に書かれた 8 個の standard Skill のうち対応する実装責任は
   ほぼ `docs/architecture.md`, `docs/development.md`,
   `docs/quality-profile.md`, `docs/release.md`, `docs/security.md`,
   `docs/recovery.md` で既に文書化されている。
2. Skill は `bunx skills add <owner/repo@skill>` 経由で third-party
   repo からダウンロードされる。Phase 1 の薄く安定した workflow に
   third-party 由来の guidance を混ぜると、source の trust 評価
   (maintainer / update cadence / community coverage) を経ずに
   canonical 化を早めることになる。
3. Skill は agent 起動時に guidance として読み込まれるため、size の割に
   context を消費する。Phase 2/3 で workflow が厚くなった時点で
   **必要性ベース** で再評価する。

## Consequences

### positive

- Phase 1 の surface area が小さいまま保てる
- `bunx skills` 経路の動作は別途確認済み (test install → remove で検証)
- `.agents/skills/` ディレクトリだけ事前作成し、`.gitignore` で除外、
  将来の再評価時に再導入できる

### negative

- policy 列挙の 8 個を網羅しない。Phase 2/3 で再評価するまでは
  fresh agent は Skill の guidance を得られない
- 後から一括導入すると ADR 起票と検証コストが嵩む

## 再評価 trigger (Phase 2 以降)

- worker / agent を 2 個以上並行 spawn する必要が出てきたとき
  → `parallel-orchestration` の trust 評価
- sandbox / container runtime を導入するとき
  → `sandbox-runtime` の trust 評価
- GitHub Actions 以外の CI / GitHub Project 自動化を入れるとき
  → `github-delivery` の trust 評価
- Phase 3 で lint rule を error 化 / coverage 導入するとき
  → `quality-gate` の trust 評価

## 動作確認 log

```text
bunx skills add addyosmani/agent-skills@debugging-and-error-recovery
→ Installation complete (Safe / 0 alerts / Low Risk)
→ ~/work/Ae_Baramoji_ts/.agents/skills/debugging-and-error-recovery

bunx skills remove debugging-and-error-recovery
→ Successfully removed 1 skill(s)
```

trust 評価を伴う導入は再評価 trigger まで保留。

## Alternatives considered

- 8 個を一括導入: source / trust 評価を経ないコミットメントになる
- `quality-gate`, `engineering-decisions` だけ導入: Phase 1 では
  `docs/quality-profile.md` 等で代替可能、再評価 trigger に該当しない
- カスタム Skill (本リポ著) を `skills/` 配下で育てる: Phase 2 以降の
  workflow 厚化後に検討
