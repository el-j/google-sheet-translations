# Task File Format

Use this command as a reference for creating well-structured task files when
breaking down complex work for sub-agents.

## Task file structure

Each sub-agent task should include:

```markdown
## Goal
One sentence describing what success looks like.

## Context
- Relevant file paths
- Key existing patterns to follow
- Any constraints or non-goals

## Steps
1. Step A
2. Step B
3. Verify by running: `<command>`

## Acceptance criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] No existing tests broken
```

## Example task: Add new export

```markdown
## Goal
Export `resolveLocaleWithFallback` from `packages/google-sheet-translations/src/index.ts`.

## Context
- File: `packages/google-sheet-translations/src/utils/localeNormalizer.ts` – function already exists
- Pattern: see how `getLanguagePrefix` is exported in `packages/google-sheet-translations/src/index.ts` line 34
- Tests live in: `packages/google-sheet-translations/tests/utils/localeNormalizer.test.ts`

## Steps
1. Add `resolveLocaleWithFallback` to the export block in `packages/google-sheet-translations/src/index.ts`
2. Add 5+ test cases to `packages/google-sheet-translations/tests/utils/localeNormalizer.test.ts`
3. Run: `npm run build && npm test`

## Acceptance criteria
- [ ] `packages/google-sheet-translations/dist/index.js` contains `resolveLocaleWithFallback`
- [ ] 5+ new test cases pass
- [ ] TypeScript compiles without errors
```

## Passing tasks to sub-agents

```typescript
task({
  agent_type: "general-purpose",
  description: "Export resolveLocaleWithFallback",
  prompt: `
    <task>
    Goal: Export resolveLocaleWithFallback from packages/google-sheet-translations/src/index.ts
    Context: ...
    Steps: ...
    </task>
    
    Working directory: /home/runner/work/google-sheet-translations/...
    
    Do the task and verify it passes:
    npm run build && npm test -w @el-j/google-sheet-translations -- tests/utils/localeNormalizer.test.ts
  `
})
```

## Task sizing

Split into separate tasks when:
- A task touches more than one logical concern
- A task would take more than 15 minutes for a human
- A task has a natural checkpoint (e.g., "build passes → then proceed")

Keep as one task when:
- Changes are tightly coupled (must succeed or fail together)
- The task is a simple CRUD on one file
