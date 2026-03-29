## Goal
Create GitHub repository rulesets as infrastructure-as-code so that CI + quality-gate must pass before any merge to `main`, enforcing changelog coverage on every real release.

## Context
- Repo: `el-j/google-sheet-translations`
- Existing workflows: `.github/workflows/ci.yml`, `.github/workflows/release.yml`
- quality-gate job runs on Node 20/22/24 and must all pass
- No `.github/rulesets/` directory exists yet
- GitHub REST API endpoint: `POST /repos/{owner}/{repo}/rulesets`

## Steps
1. Create `.github/rulesets/main-branch.json` — ruleset config requiring:
   - Required status checks: `Quality Gate (Node 20)`, `Quality Gate (Node 22)`, `Quality Gate (Node 24)` (from release.yml), plus `test (20)`, `test (22)`, `test (24)` (from ci.yml)
   - Pull request required before merging to main/develop
   - Linear history (squash/rebase only)
2. Create `.github/workflows/apply-ruleset.yml` — `workflow_dispatch`-triggered workflow that calls the GitHub API to upsert the ruleset from the JSON file
3. Update `CONTRIBUTING.md` to document the ruleset and how to apply it

## Acceptance criteria
- [ ] `.github/rulesets/main-branch.json` is valid GitHub Rulesets API JSON
- [ ] `.github/workflows/apply-ruleset.yml` uses `gh api` to apply the ruleset
- [ ] Existing tests unaffected
- [ ] Status: DONE ✅
