# Security — Ae_Baramoji_ts

## 1. Scope

このリポジトリは **ExtendScript (.jsx) を TypeScript からビルドする開発者向け
リポジトリ** である。runtime は After Effects (ExtendScript 3 era JS engine)
で、network / DB / OS 権限は持たない。

セキュリティ risk surface は主に以下 3 つに限定される:

1. **dependency compromise** — Bun で入れた npm registry パッケージ (`types-for-adobe`,
   `rollup`, `archiver`, `eslint`, ...) の改ざん
2. **submodule upstream / push 認証情報漏洩** — `secrets.GH_PAT`
3. **release 成果物への恶意混入** — submodule へ不正コードが push される

これらに対する intake / priority / 復旧手順を下記に定義する。

## 2. Dependency advisory intake

### source priority (policy §25)

1. framework / runtime / SDK 公式 advisory (Node.js, TypeScript, Rollup, ESLint)
2. GitHub Security Advisories (Dependabot alerts)
3. ecosystem official (npm audit / GitHub Advisory Database)
4. GitHub Security Advisories (manual)
5. trusted secondary source

### scheduled check

- CI で `bun audit --audit-level=high` を release gate 前に実行
  (Bun の audit は npm registry advisory と互換)
- Dependabot の PR を `release-x-y-z` branch へ直接取り込まない。
  必ず別 ticket を起こして評価してから merge する。

### 当該 version との紐付け

`bun.lock` の lockfileVersion と package resolution を起点に、npm
advisory の影響範囲を確認する。production runtime (After Effects) と
dev environment で影響度が異なることに注意。

## 3. Secret 扱い

### してはいけないこと

- 認証情報を commit / log / checkpoint / agent result に含めない
- `.env`, `.env.development`, `.env.production` を commit しない
- `secrets.GH_PAT` の値を Issue / PR / commit / log に出さない
- submodule 内 (`release/Ae_Baramoji/`) に認証情報を残さない

### 必要なら置くもの

- `.env.example` (値の無いテンプレ)
- `.gitignore` の末尾で `.env*` を Git ignore

### 配布リポへの push 認証

`.github/workflows/release.yml` で `secrets.GH_PAT` を使う。
`GH_PAT` は **両リポへの write 権限を持つ PAT**。
漏洩時の被害が大きいため、Dependabot 等の自動化や外部 fork には渡さない。
rotation は 90 日目安。

## 4. Submodule push 経路

release workflow が submodule (`release/Ae_Baramoji/`) へ直接 push する経路は
2 つ:

1. GitHub Actions 経由 (`secrets.GH_PAT` 利用)
2. ローカル手動 (開発者本人の push 権限)

いずれの経路でも次のチェックを行う:

- [ ] submodule 内の差分が想定どおり (`scripts/sync-submodule.mjs` が生成する
      7 .jsx + zip + README のみ)
- [ ] submodule commit author と commit message が想定どおり
- [ ] 親側で submodule pointer bump の commit が想定どおり

## 5. Incident response (1 ページ要約)

| 種別 | 一次対応 |
|---|---|
| dependency critical CVE | Issue 作成、target version を `current sprint + 1 hotfix` に。即 patch |
| GH_PAT 漏洩 | 即 rotate、新 PAT を GitHub Secrets に登録、配布リポと本リポ両方監査 |
| submodule に不正 push | submodule を last-known-good SHA へ reset、`git -C release/Ae_Baramoji reset --hard <sha>` + 親 pointer rollback |
| release 成果物の混入 | Release を削除 → submodule / 親を last-good に戻す → 公開 ADR |

critical 事例は `docs/decisions/` に事後 ADR を必ず残す。

## 6. Code signing / verification (将来)

AE 側でスクリプト署名は ExtendScript では一般的でないが、以下の代替策を検討:

- `dist/` の SHA-256 を `Baramoji.zip` の release notes に固定記載
- 配布リポ README に「ビルド元 commit SHA」リンクを必ず残す
- submodule pointer と build artifact の対応を release gate で assert

## 7. Scope 外

- After Effects 自体の脆弱性
- ExtendScript エンジン (JS) 自体の脆弱性
- upstream `types-for-adobe` の correctness バグ (型 augment で吸収)
