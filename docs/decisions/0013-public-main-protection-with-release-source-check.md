# ADR 0013 — public repository の main 保護を release-source check で強化する

- status: accepted
- date: 2026-09-15
- supersedes: なし
- superseded-by: なし
- related: policy §11 / §12、`AGENTS.md`、`docs/release.md` §3、
  `.github/workflows/release-source-check.yml`、`README.md`

## Context

`Ae_Baramoji_ts` は **public repository** (policy §11)。`main` への正準
delivery path は `release-x-y-z -> main` の release PR のみ。

現在 `Protect main` ruleset (id: 22558519) は次の 3 規則を active で持つ:

- `deletion` の禁止
- `non_fast_forward` (force push) の禁止
- `pull_request` (PR を必須化、`required_review_thread_resolution: true`、
  `require_extra_approval_for_unattributed_changes: true`)

しかし **required_status_checks は未設定** で、CI が red でも merge できて
しまう。これは policy §11 が示す「CI を通過した PR のみ main に着地できる」
状態に反する。

加えて、policy §11 は「branch protection / ruleset だけでPR head branch
patternを制限できない場合は required GitHub Action / status check で
`base == main` かつ `head` が canonical `release-*` pattern であることを
検証する」と定める。現行 ruleset は head pattern を制限しないため、
release-source check を独立 workflow で提供し、ruleset に required check として
登録する必要がある。

## Decision

### 1. release-source check workflow を追加する

`.github/workflows/release-source-check.yml` を新設し、`pull_request_target`
opened / edited / reopened / synchronize で起動する:

- trigger を **`pull_request_target`** にする理由: `pull_request` だと workflow
  file 自体が PR の HEAD commit から取られるため、fork PR の作者が
  workflow を書き換えて head pattern check を bypass できてしまう
  (CodeRabbit Security Review, 2026-09-15)。
  `pull_request_target` は workflow を **BASE branch から** 実行するため
  fork からの改変が効かない。本 workflow は PR のコードを checkout せず
  `github.event.pull_request.*` の metadata だけを参照するので、
  `pull_request_target` 由来の secret 露出面を一切使わずに済む。
- `base == main` のとき: head ref が
  `^release-[0-9]+-[0-9]+-[0-9]+(-[A-Za-z0-9._-]+)?$` に match するか検証。
  mismatch の場合 ::error:: を emit して exit 1。
- `base != main` のとき: pass-through job を走らせ、緑で finish する
  (stacked PR は integration gate で別途検証される)。

status check 名は `release-source` で固定。

### 2. ruleset に required_status_checks を追加する

`Protect main` ruleset (id: 22558519) に次の rule を追加する:

- type: `required_status_checks`
- `strict_required_status_checks_policy: true`
- required contexts:
  - `type-check, lint, build` (既存の CI run から自動供給)
  - `release-source` (本 ADR で新設)

rule 追加後、既存 PR を含めて ruleset enforcement が即時適用される。既存
PR #17 を含む ready-to-merge 直前の PR には両 check が走っていない可能性が
あるため、適用前に head SHA で再実行されるよう user が verify する。

### 3. ruleset 反映は user が明示 authorization する

ADR-0012 に従い、`gh api` による ruleset mutation は production side effect
なので **user が手動で実行** する。Coordinator / agent は API call を実行せず、
次の template を PR description / issue comment / 報告に貼る。

### 4. bypass / exception path を設けない

`bypass_actors` は当面空のまま維持する (現行と一致)。`strict_required_
status_checks_policy: true` により "checks が latest commit で緑でない限り
merge 不可" を強制する。

## user 実行用の ruleset 更新コマンド

次の JSON を `protect-main-after-0013.json` として保存し、`gh api` で PUT する。

```json
{
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "required_reviewers": [],
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "require_extra_approval_for_unattributed_changes": true,
        "allowed_merge_methods": ["merge", "squash", "rebase"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "type-check, lint, build" },
          { "context": "release-source" }
        ]
      }
    }
  ],
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] }
  },
  "bypass_actors": []
}
```

```bash
gh api -X PUT \
  /repos/rebuildup/Ae_Baramoji_ts/rulesets/22558519 \
  -H "Accept: application/vnd.github+json" \
  --input protect-main-after-0013.json
```

適用後の確認:

```bash
gh api /repos/rebuildup/Ae_Baramoji_ts/rulesets/22558519 \
  | jq '.rules[] | {type: .type, contexts: (.parameters.required_status_checks // [])}'
```

## Consequences

### positive

- policy §11 の release-source check 要件を満たせる
- CI red 状態での `main` merge が構造的に不可能になる
- `release-x-y-z -> main` 以外の直接経路 (例: feature branch から
  `main`、古い label/release-* branch から `main`) が明示 error で弾かれる
- `pull_request_target` により、fork PR が workflow file を改変して
  check を bypass する経路を塞げる (CodeRabbit Security Review)

### negative

- 既存 PR #17 を含む ready-to-merge 直前の PR は新 check が走っていない
  可能性がある。head SHA で push して re-run を促す運用が必要。
- ruleset 反映時の short downtime: PUT 自体は atomic だが、CI 再実行の
  待ち時間中に merge しようとしても落ちる。
- release-source check を bypass する正当 path (hotfix patch release が
  緊急で必要な場合) を本 ADR では用意しない。`docs/security.md` Incident
  response の critical dependency CVE path から別途臨時 release branch
  を起こして対応する。

## 動作確認 log

- 2026-09-15: workflow `release-source-check.yml` を main に反映せず
  `release-0-2-0` branch で先に検証する想定。ruleset PUT は user の
  明示 authorization を待って実行。

## Alternatives considered

- **branch protection で head pattern を直接制限する**: 現行 GitHub
  ruleset の `pull_request` rule には head ref pattern 制限 parameter が
  ない。policy §11 が指摘するとおり代替として status check を要求する。
- **CODEOWNERS で release PR の reviewer を固定する**: 現体制に
  meaningful な CODEOWNERS reviewer がいない (policy §26)。将来
  reviewer が複数名揃った段階で再評価。
- **`dismiss_stale_reviews_on_push: true` を有効化する**: 同一 PR に
  なされる stale な dismiss 挙動が release PR で disruptive になりうる。
  本 ADR では現行 (`false`) を維持。

## 再評価 trigger

- ruleset / branch protection の新機能が head pattern を直接制限できるように
  なった場合 → status check の不要可否を再評価
- CODEOWNERS / required reviewer が整備され bot review と human review を
  分離できる体制が整った場合 → reviewer approval を release-source と
  組み合わせる option を再評価
- release 頻度が上がり release-source check の wall-clock cost が無視
  できなくなった場合 → lightweight shell job への縮減を再評価
