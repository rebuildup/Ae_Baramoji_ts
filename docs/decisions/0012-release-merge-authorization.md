# ADR 0012 — Release PR マージは explicit user authorization 境界

- status: accepted
- date: 2026-09-15
- supersedes: なし
- superseded-by: なし
- related: `docs/release.md` §3 / §4、`docs/recovery.md` §7

## Context

policy §12 は「`release-x-y-z -> main` を含む PR merge は explicit user
authorization 境界 (ADR-0012) に従う」と定める。

実際の状態 (2026-09-15 時点):

- `main` は `Protect main` ruleset (id: 22558519) で保護され、`bypass_actors`
  は空、`current_user_can_bypass: "never"`。
- 現 active sprint は `release-0-2-0`、PR #17 (`release: v0.2.0 integration`)
  が Ready で待機。CodeRabbit + Copilot bot の review は COMMENTED のみで
  human approval はまだ。
- 配布 submodule / 親 pointer bump / GitHub Release 作成は release.yml が
  tag push で自動実行する。この path は policy §18 の external side effect に
  該当し、reviewer approval だけでは十分ではない。

## Decision

release PR (`release-x-y-z -> main`) の merge は次の 3 層をすべて満たした
**ready-to-merge** 状態で停止し、merge そのものは user が明示的に
authorization した瞬間にのみ実行する。

1. **review approval**: CODEOWNERS (いない場合は明示的な human reviewer)
   の approve。policy §26 に基づく reviewer separation。
2. **release gate green**: `bun run type-check && bun run lint && bun run
   test && bun run build && bun run verify`、および CI の required check
   (type-check, lint, build / release-source (ADR-0013)) の成功。
3. **explicit user authorization**: release PR を Ready-to-merge 状態まで
   進めた Coordinator / agent は **STOP** し、現在状態 (head SHA / required
   checks / outstanding review conversation / submodule pointer) を user へ
   report する。merge は user が明示的に authorize した場合にのみ実行する。

### 境界の内側 (coordinator / agent が自律して進める)

- branch / commit / push (PR Draft まで)
- PR Ready 化 (Draft → Ready)
- release gate 全段の実行
- `release` workflow の準備 (tag 作成を除く)
- ready-to-merge 状態確認 + user への report

### 境界の外側 (user のみが行う)

- release PR (`release-x-y-z -> main`) の merge
- `v<x>.<y>.<z>` tag の push (release.yml 起動 trigger)
- submodule への destructive 操作 (`git -C release/Ae_Baramoji reset --hard`)
- GitHub Release の削除 / 配布物の rollback を含む `docs/security.md`
  Incident response のうち destructive path
- ruleset / branch protection の mutation (ADR-0013 関連の `gh api` PUT)

### なぜ独立境界を設けるか

- CodeRabbit / Copilot 等の bot review は COMMENTED のみで approve 相当では
  ない。human approval gate を別途満たす必要がある。
- reviewer / CODEOWNERS approval は merge の **前提条件** だが、merge を
  **実行する権限** そのものではない (policy §12 強調)。
- release.yml の tag-trigger は irreversible な GitHub Release 公開 +
  submodule pointer bump + distribution リポ mirror を起動するため、
  policy §18 external side effect の idempotency 境界とも重なる。
- agent が自律 merge した場合、後の監査で「なぜ誰が merge したか」を
  user の明示操作として残せない。

## Consequences

### positive

- agent / Coordinator の自律範囲が確定し、user escalation の機会損失と
  over-reach の両方を回避できる
- release PR merge / tag push / destructive submodule 操作が user 起点の
  audit trail に乗る
- policy §12 / §18 / §26 と一貫する

### negative

- release PR が Ready 状態で停滞する期間、user 応答待ちになる
- 「release 完了」を agent 単独で完結できない運用上の friction
- 緊急 patch release で user が応答できない状況下では対応が遅れる
  (security incident は `docs/security.md` Incident response 表に従い別途
  user escalate を要求)

## 動作確認 log

- 2026-09-15: PR #17 が `release-0-2-0 -> main` で Ready 状態。CodeRabbit 2 件
  COMMENTED、bot review では human approval gate 未達。本 ADR の境界に従い
  merge せず user 報告のみ。

## Alternatives considered

- **reviewer approve を release merge 実行権限に含める**: 「approval を
  得た agent が自律 merge する」とする案。policy §12 の「reviewer approval
  は merge の前提条件だが merge を実行する権限は user」に反するため不採用。
- **release PR merge 用に専用 GitHub App / bot を作る**: review / merge /
  audit の 3 関心を分離できるが、現状スコープでは over-engineering。
  Phase 3 以降で再評価。
- **tag push を agent に許可**: release.yml が irreversible な GitHub
  Release を起動するため、policy §18 external side effect の guard に
  反する。不採用。

## 再評価 trigger

- CODEOWNERS が整備され human review gate を bot と分離できる体制が整った
  場合 → 「reviewer approve で merge まで自動化」を再評価
- Phase 2 以降で release 頻度が上がり user 起動 cost が問題化した場合 →
  GitHub App を用いた audited automation を再評価
- `tag push` を CI 経由のみで起動する invariant を破る要件が出た場合 →
  本境界の縮小を再評価
