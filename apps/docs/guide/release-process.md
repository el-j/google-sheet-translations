# Release Process

This page documents the complete automated release pipeline for `@el-j/google-sheet-translations`.

## Overview

Every push to `main` triggers a fully automated pipeline:

```
Push to main
    │
    ├─► ci.yml ──────────────────────────── Lint + Build + Test (Node 20/22/24)
    │
    ├─► release.yml
    │       ├─ quality-gate ──────────────── Lint + Build + Test (Node 20/22/24, fail-fast)
    │       └─ release ──────────────────── semantic-release → npm + GitHub Release + CHANGELOG.md
    │
    └─► docs.yml (triggered after Release)
            └─ build + deploy ────────────── VitePress → GitHub Pages
```

## Branch Ruleset

Branch protection is stored as code in `.github/rulesets/main-branch.json`.

Required status checks before merge to `main`:
- `Quality Gate (Node 20)`, `(Node 22)`, `(Node 24)` — from `release.yml`
- `test (20)`, `test (22)`, `test (24)` — from `ci.yml`
- At least 1 approving review

To apply the ruleset, dispatch the **Apply Branch Rulesets** workflow from GitHub Actions.

## Semantic Release

Version bumps and changelog entries are determined automatically from [Conventional Commits](https://www.conventionalcommits.org/):

| Commit type | Release |
|-------------|---------|
| `feat` | minor (e.g. 2.1.0 → 2.2.0) |
| `fix`, `perf`, `refactor`, `revert` | patch (e.g. 2.1.0 → 2.1.1) |
| `docs`, `style`, `test`, `build`, `ci`, `chore` | none |
| Breaking change (`!` or `BREAKING CHANGE:`) | major (e.g. 2.1.0 → 3.0.0) |

Configuration: `.releaserc.json`

### Preview Next Release

```bash
npm run changelog:preview
```

Runs `semantic-release --dry-run` locally to preview the next version and changelog entry.

## Changelog

`CHANGELOG.md` is automatically updated by semantic-release on every release. The docs site changelog page (`/changelog`) includes the root `CHANGELOG.md` via VitePress file includes — it is always in sync.

## Docs Deployment

The `docs.yml` workflow:

1. **Triggers** on successful Release workflow completion, or on pushes that modify `website/**`, `README.md`, or `CHANGELOG.md`
2. **Syncs translations** to the demo Google Sheet (if `GOOGLE_CLIENT_EMAIL` secret is set)
3. **Builds** the VitePress site with `npm run docs:build`
4. **Deploys** to GitHub Pages at `https://el-j.github.io/google-sheet-translations/`

## Floating Version Tag

After each release, the `v{MAJOR}` floating tag (e.g. `v2`) is force-updated so that GitHub Action users referencing `el-j/google-sheet-translations@v2` always get the latest patch.

## Pre-release Channels

| Branch | Pre-release channel |
|--------|---------------------|
| `main` | stable (e.g. `2.1.0`) |
| `develop` | `beta` (e.g. `2.2.0-beta.1`) |
| `next` | `next` (e.g. `3.0.0-next.1`) |
