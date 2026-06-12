# Execute Command

Use this command as the final step reference before completing any task.
Ensures all quality gates pass before calling `report_progress`.

## Pre-commit checklist

Run all of the following in order. Each step must pass before proceeding.

### 1. Build
```bash
npm run build
# Expected: exits 0, no TypeScript errors
```

### 2. Lint
```bash
npm run lint
# Expected: exits 0, max-warnings 0
```

### 3. Unit tests
```bash
npx jest --no-coverage --testPathIgnorePatterns=integration
# Expected: all suites pass, no failures
```

### 4. Production audit
```bash
npm audit --omit=dev --audit-level=high
# Expected: "found 0 vulnerabilities"
# Note: dev-dep vulnerabilities in npm CLI's bundled tar/minimatch are
# known-unfixable and excluded via --omit=dev. See docs/SECURITY.md.
```

### 5. Code review
Call the `code_review` tool with a PR title and description.
Address all valid feedback before proceeding to step 6.

### 6. Security scan
Call the `codeql_checker` tool.
Fix any true-positive alerts. Document false positives in the PR.

### 7. Commit & push
Call `report_progress` with:
- A clear commit message (Conventional Commits format)
- An up-to-date checklist marking completed items with `[x]`

## Conventional Commits reference

```
feat: add resolveLocaleWithFallback export
fix: downgrade @semantic-release/npm to remove minimatch ReDoS
chore: add dependabot.yml and .claude/commands orchestration
security: suppress known-unfixable bundled npm tar vulnerability
ci: add quality-gate job to release.yml before semantic-release
docs: document dev-only vulnerability chain in SECURITY.md
```

## Post-commit

After `report_progress` pushes:
1. Check GitHub Actions CI workflow passes (use `list_workflow_runs`)
2. If CI fails, investigate with `get_job_logs` and fix

## Release readiness

Before a PR can merge:
- [ ] All CI checks green on the branch
- [ ] `quality-gate` job passes on all Node versions (20, 22, 24)
- [ ] No new `npm audit --omit=dev --audit-level=high` violations
- [ ] `codeql_checker` shows 0 alerts (or documented false positives)
- [ ] CHANGELOG.md or PR description explains the changes
