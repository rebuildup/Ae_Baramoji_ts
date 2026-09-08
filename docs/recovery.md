# Recovery — Ae_Baramoji_ts

このドキュメントは **会話履歴・private memory・session ID を唯一の source of
truth にしない** という前提での復旧手順を定義する (policy §16)。

## 1. Failure model

最低限次を想定する:

- model / session context loss
- agent process crash / cancel
- IDE / terminal restart
- parent agent crash while child continues
- child / subagent crash
- sandbox / container recreate
- Supervisor restart
- transient network / provider failure
- host reboot
- context window exhaustion

RPO / RTO は host の disk durability と GitHub availability に依存する。
remote 設定後は RPO < 1 commit (全 commit が GitHub 上にある前提)。

## 2. Durable recovery sources (priority)

1. GitHub Issue / Project
2. target release branch (`release-x-y-z`)
3. ticket branch / commit graph
4. Draft / Ready PR / review / CI state
5. committed docs (`docs/`) と ADR (`docs/decisions/`)
6. `skills/` 配下の project-local guidance
7. `.checkpoint/` 配下の structured checkpoint

transient (使わない):

- 会話履歴 / private memory / session ID
- agent ID / Supervisor local DB
- shell history / IDE state

## 3. Recovery algorithm

fresh agent は次の順で再構成する:

1. **SoT 特定**: GitHub Issue / PR / target release branch の URL を特定
2. **remote fetch**: `git fetch --all --prune --tags`
3. **target release branch を確認**: `git checkout release-x-y-z`
4. **該当 ticket branch を確認**: `git checkout <issue-number>`
5. **最新 checkpoint を読む**: `.checkpoint/` 配下の最新 JSON
6. **canonical policy を確認**: `AGENTS.md` → `docs/architecture.md` →
   `docs/decisions/` の順
7. **active children を再発見**: `.checkpoint/` の `active_children`
8. **child result を回収**: immutable commit / diff
9. **stale base / conflicting integration を判定**: rebase 計画
10. **再構築 plan を再評価**: issue 単位で再 plan
11. **worker gate を再実行**: `bun run type-check && bun run lint &&
    bun run build && bun run verify`
12. **execution generation / lease を bump** して続行

## 4. Structured checkpoint

private chain-of-thought は保存しない。復旧に必要な外部化可能 state だけ:

`.checkpoint/<issue-number>.json`:

```json
{
  "schema_version": 1,
  "issue_id": "123",
  "target_release": "0.2.0",
  "ticket_branch": "123",
  "pr_number": null,
  "base_sha": "0a7d7b2",
  "checkpoint_sha": "0a7d7b2",
  "execution_generation": 3,
  "status": "in_progress",
  "completed_steps": ["bootstrap", "core extraction", "type-check"],
  "next_steps": ["wire entries to extracted core", "lint pass", "verify"],
  "pending_validation": ["integration: end-to-end Baramoji.jsx smoke"],
  "active_children": [],
  "integrated_child_results": [],
  "external_side_effects": [
    {"kind": "github_pr", "ref": "https://github.com/rebuildup/Ae_Baramoji_ts/pull/45"},
    {"kind": "submodule_commit", "ref": "0363680"}
  ],
  "blockers": [],
  "decision_refs": ["docs/decisions/0001-typescript-source-of-truth.md"],
  "artifact_refs": ["dist/Baramoji.jsx"],
  "updated_at": "2026-09-09T00:00:00Z"
}
```

`.checkpoint/` は `.gitignore` で除外しない (= 履歴に残す)。 checkpoint を
書いた commit 自体は通常 commit として記録される。

## 5. Soft / Hard checkpoint

- soft: host / sandbox 障害向け。local immutable ref, filesystem snapshot。
  issue 単位の *.json checkpoint で代替可能。
- hard: sandbox / provider 消失向け。meaningful code / work state が durable
  remote (GitHub) から到達可能。release branch + Issue + ADR + commit graph
  が hard boundary。

## 6. Checkpoint trigger

次の前後で checkpoint を書く:

- meaningful implementation milestone
- risky refactor / migration
- child spawn (snapshot 作成)
- child result integration
- long validation
- external side effect (push, release, submodule sync)
- user / external input 待ち
- provider TTL / shutdown 接近
- graceful cancellation / shutdown signal
- context limit 接近

## 7. Subagent recovery (split-brain 防止)

- child lifecycle は Supervisor が所有する。parent model process は owner ではない。
- parent 死亡時に child を即 cancel しない。
- recovered parent は:
  - child 一覧を再発見
  - input snapshot / execution_generation を確認
  - running / completed / failed / orphaned を分類
  - completed result を immutable result として回収
- network partition / timeout 後に旧 agent と新 agent が同時実行する可能性を前提とする
- Supervisor は lease / generation / fencing token を task に持たせる

## 8. Provider / sandbox loss

`rebuildup/Ae_Baramoji_ts` の GitHub remote が利用可能な間は hard 状態を保てる。
remote 喪失時:

- local working tree を `git bundle create` で backup
- 別 host で `git clone --mirror` 可能な full bundle を維持
- `release/Ae_Baramoji` submodule は独立 mirror なので別途 clone 可能

## 9. Recovery drill

定期的に次の順で確認する (任意、半年に 1 回目安):

1. ticket work を checkpoint
2. agent / sandbox を意図的に停止
3. fresh agent / sandbox から `docs/recovery.md` のみで再起動
4. branch / children / validation / side-effect journal を再構成
5. duplicate mutation なしで続行できることを確認
