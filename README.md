# Ae_Baramoji_ts

TypeScript source-of-truth for [rebuildup/Ae_Baramoji](https://github.com/rebuildup/Ae_Baramoji).

This repository compiles seven ExtendScript (`.jsx`) files and syncs them to the distribution repository as a git submodule.

## What this is

[`rebuildup/Ae_Baramoji`](https://github.com/rebuildup/Ae_Baramoji) is a set of After Effects ExtendScript tools that decompose text layers into character / shape / part variants. Until now, those `.jsx` files were maintained by hand. This repository adds a TypeScript build pipeline on top:

- Type-checked source (uses [`types-for-adobe`](https://www.npmjs.com/package/types-for-adobe))
- Single command to rebuild all seven outputs
- Submodule-based sync to the distribution repo
- CI for both PRs and tagged releases

The `.jsx` files in the distribution repo are **generated artifacts** — please open a PR against `Ae_Baramoji_ts` instead of editing them directly.

## Repository layout

```
.
├── src/
│   ├── core/              # shared decomposition logic
│   ├── entries/           # one entry per output (.tsx.ts → .jsx)
│   ├── types/             # ExtendScript type shims
│   └── init.ts            # ES3 polyfills loaded by every entry
├── scripts/               # build-time helpers (verify, zip, sync)
├── release/
│   └── Ae_Baramoji/       # git submodule → distribution repo
├── rollup.config.mjs      # multi-input Rollup pipeline
├── tsconfig.json          # ES3 target, noLib, types-for-adobe only
└── .github/workflows/     # ci.yml (PR/build) and release.yml (tag)
```

## Build

```bash
npm install
npm run build      # produces dist/Baramoji.jsx + 6 variants
npm run verify     # syntax check + ES3 compatibility + IIFE check
```

## Release

Releases are driven by git tags on this repo. Pushing a tag like `v0.1.0` triggers `.github/workflows/release.yml`, which builds, syncs the seven `.jsx` files (and `Baramoji.zip`) into the `release/Ae_Baramoji` submodule, and creates a GitHub Release with the zip attached.

To do the same thing locally:

```bash
npm run release
```

This requires write access to both repos and a configured git author.

## Development

To add a new decomposition variant:

1. Create `src/entries/<NewName>.tsx.ts` — see the existing entries for the IIFE pattern.
2. Wire it in `rollup.config.mjs` (input → output mapping).
3. Re-use `src/core/*` modules; do not duplicate logic.
4. Run `npm run build && npm run verify`.

## License

MIT — see [LICENSE](./LICENSE). Original `.jsx` implementation copyright 2025 361do_sleep; TypeScript port copyright 2025 rebuildup and contributors.