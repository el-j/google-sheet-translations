# Orchestrate Command

Use this command to coordinate multi-step development work using swarms of
sub-agents. Reference this file at the start of any complex task.

## When to orchestrate

- Feature spans multiple files / layers (src + tests + docs + CI)
- Security audit + remediation across devDeps and workflows
- Release pipeline changes (workflow + package + lockfile)
- Any task explicitly requesting parallel / swarm execution

## Orchestration protocol

### 1. Discover phase (parallel)

Spawn **explore** sub-agents simultaneously for independent research:

```
task(explore): "Describe fileWriter.ts exports and their current test coverage"
task(explore): "List all open GitHub Actions workflow files and their triggers"
task(explore): "Find all usages of resolveLocaleAlias in the codebase"
```

### 2. Plan phase

Produce a `report_progress` checklist from discovery output BEFORE writing code.
Use `- [ ]` for pending, `- [x]` for done items.

### 3. Execute phase (parallel where safe)

Spawn **general-purpose** or **task** sub-agents for independent work units:

- Independent file edits → parallel sub-agents
- Dependent changes (B requires A) → sequential

```
# Parallel example:
task(general-purpose): "Add resolveLocaleWithFallback to localeNormalizer.ts and its tests"
task(general-purpose): "Create Vue composable useLocaleSwitcher.ts"

# Sequential example:
# 1. First update src/index.ts exports
# 2. Then build + verify dist/index.js contains new exports
```

### 4. Verify phase

After all sub-agents complete:
1. Run `npm run build` – confirm 0 TypeScript errors
2. Run `npm test` – confirm all tests pass
3. Run `npm run lint` – confirm 0 lint warnings
4. Run `npm audit --omit=dev --audit-level=high` – confirm 0 production vulns
5. Call `code_review` + `codeql_checker`

### 5. Report

Call `report_progress` with final checklist showing all `[x]` items.

## Sub-agent types

| Type | Best for |
|------|----------|
| `explore` | File discovery, code search, reading, answering questions |
| `task` | Running commands (build, test, lint, install) |
| `general-purpose` | Multi-step code edits with reasoning |

## Parallelism rules

✅ Safe to parallelize:
- Edits to different files with no shared state
- Multiple explore queries about different parts of the codebase
- Running multiple test files independently

❌ Must be sequential:
- Edit A then read A's output to decide edit B
- Install packages then run build
- Commit then push (report_progress handles this)
