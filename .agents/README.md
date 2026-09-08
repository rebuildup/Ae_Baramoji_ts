# agent-related local artifacts

`bunx skills add <owner/repo@skill>` はこのリポジトリの `.agents/skills/`
に配置する。

Phase 1 では意図的に Skill を導入していない。trust 評価を伴う再評価は
Phase 2 以降の workflow 厚化時に行う (詳細は
`docs/decisions/0002-skills-policy.md` を参照)。

意図的に空のディレクトリとして残し、将来の導入に備える。
`skills-*` という独自ディレクトリは作成しない (Skills CLI の既定 path に
合わせる)。
