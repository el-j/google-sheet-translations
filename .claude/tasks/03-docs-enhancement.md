## Goal
Ensure documentation is always complete, current, and automatically maintained — covering README, CONTRIBUTING, and the VitePress site.

## Context
- `README.md` — could use CI/Release/Docs badges and a workflow overview
- `CONTRIBUTING.md` — 89 lines, covers conventional commits and release process; needs ruleset and changelog-preview docs
- `website/` — VitePress docs site deployed to GitHub Pages
- `docs/` — contains audit files, security docs, guides
- VitePress sidebar config: `website/.vitepress/config.mts`

## Steps
1. Update `README.md`:
   - Add GitHub Actions badges (CI, Release, Docs)
   - Add a "Release & Docs Workflow" section explaining the automated pipeline
2. Update `CONTRIBUTING.md`:
   - Add "Release Gate" section explaining the ruleset
   - Add "Changelog Preview" section explaining `npm run changelog:preview`
   - Add "Docs Automation" section explaining how docs auto-deploy
3. Add `docs/release-process.md` — comprehensive guide to the release pipeline (rulesets, quality gate, semantic-release, docs deploy, changelog sync)
4. Add `/guide/release-process` entry to VitePress sidebar in `website/.vitepress/config.mts`
5. Create `website/guide/release-process.md` that mirrors / includes `docs/release-process.md`

## Acceptance criteria
- [x] README.md has CI, Release, Docs, npm, and License badges
- [x] CONTRIBUTING.md documents ruleset + changelog-preview + docs automation
- [x] `website/guide/release-process.md` explains the full pipeline
- [x] VitePress sidebar has Contributing → Release Process link
- [x] Status: DONE ✅
