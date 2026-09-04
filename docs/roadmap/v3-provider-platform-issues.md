# v3 Provider Platform: Issue Backlog

Use these as copy/paste-ready GitHub issues under milestone: **v3 Provider Platform**.

## Issue 1

Title: `feat(v3): define provider contracts and capability model`

Labels:
- `v3`
- `provider-architecture`
- `enhancement`

Body:

### Summary
Create public TypeScript contracts for input, output, and sync providers, plus capability declaration and validation model.

### Scope
- Add provider interfaces in a dedicated module.
- Add capability types and validator utility.
- Add typed provider registry contract.

### Acceptance Criteria
- Interfaces compile and are exported from a stable module.
- Capability schema supports read/write/sync/discovery flags.
- Unit tests validate capability-policy checks.
- No behavior change in current runtime yet.

### Dependencies
- None

---

## Issue 2

Title: `refactor(v3): isolate transformation core as provider-agnostic module`

Labels:
- `v3`
- `provider-architecture`
- `refactor`

Body:

### Summary
Extract row-to-translation transformation into an explicit pure core module with no provider imports.

### Scope
- Move normalization, locale mapping, and merge logic into core package namespace.
- Ensure core receives canonical row input and returns canonical translation output.
- Preserve existing behavior snapshots.

### Acceptance Criteria
- Core module has no network, auth, or file writes.
- Existing fixtures produce identical outputs before/after extraction.
- Snapshot tests pass for locale and key mapping edge cases.

### Dependencies
- Issue 1

---

## Issue 3

Title: `feat(v3): implement google-sheets provider adapters (input/output/sync)`

Labels:
- `v3`
- `google`
- `provider-architecture`

Body:

### Summary
Wrap existing Google logic behind provider contracts without functional regressions.

### Scope
- Implement `google-sheets` input provider for authenticated and public reads.
- Implement output/sync adapter for existing bidirectional behavior.
- Implement capability map (full support).

### Acceptance Criteria
- Existing Google workflows still pass integration tests.
- Provider adapter is consumed by orchestrator instead of direct calls.
- No user-facing API break in this issue.

### Dependencies
- Issue 1
- Issue 2

---

## Issue 4

Title: `feat(v3): add cryptpad-csv input provider (MVP read-only)`

Labels:
- `v3`
- `cryptpad`
- `enhancement`

Body:

### Summary
Add a CryptPad-friendly input provider based on CSV export/public file endpoints.

### Scope
- Build `cryptpad-csv` provider that fetches and parses CSV rows.
- Support one or multiple table inputs.
- Map rows into canonical transformation input.

### Acceptance Criteria
- Pull-only translation generation works from cryptpad CSV source.
- Provider clearly reports unsupported capabilities (no sync/write/formula).
- Integration tests validate at least one realistic cryptpad export sample.

### Dependencies
- Issue 1
- Issue 2

---

## Issue 5

Title: `feat(v3): build runtime orchestrator for provider pipelines`

Labels:
- `v3`
- `orchestration`
- `enhancement`

Body:

### Summary
Introduce a runtime orchestrator that composes selected providers with transformation and output workflows.

### Scope
- Implement operation plan builder (pull, transform, write, sync).
- Add capability gate checks before execution.
- Emit structured run summary and diagnostics.

### Acceptance Criteria
- Orchestrator can run Google full mode and CryptPad read-only mode.
- Clear error messages when a requested operation is unsupported.
- Existing default flow remains stable through compatibility wrapper.

### Dependencies
- Issue 1
- Issue 2
- Issue 3
- Issue 4

---

## Issue 6

Title: `feat(v3): provider-centric configuration schema and validation`

Labels:
- `v3`
- `config`
- `enhancement`

Body:

### Summary
Design and implement provider-centric config with schema validation and legacy mapping.

### Scope
- Add v3 config schema for input/output/sync providers.
- Add config parser and runtime validator.
- Add compatibility mapper from legacy Google options.

### Acceptance Criteria
- New schema accepts provider definitions with typed options.
- Legacy options map to Google provider config with warnings.
- Invalid combinations fail fast with actionable diagnostics.

### Dependencies
- Issue 1
- Issue 5

---

## Issue 7

Title: `feat(v3): update GitHub Action and CLI for provider config`

Labels:
- `v3`
- `github-action`
- `cli`

Body:

### Summary
Expose provider-based runtime in Action and CLI while maintaining a transition path.

### Scope
- Add provider-related Action inputs (or config file path input).
- Add CLI flags/options for provider selection.
- Keep legacy Google inputs functional with deprecation warnings.

### Acceptance Criteria
- Action supports at least Google and CryptPad provider modes.
- CLI docs and help text include provider examples.
- Legacy mode still works and is covered by tests.

### Dependencies
- Issue 5
- Issue 6

---

## Issue 8

Title: `test(v3): add provider contract test suite and golden integration fixtures`

Labels:
- `v3`
- `testing`

Body:

### Summary
Create a reusable contract test suite every provider must pass, plus end-to-end fixture tests.

### Scope
- Add shared provider contract tests.
- Add golden fixtures for transformation invariants.
- Add CI matrix for provider-mode runs.

### Acceptance Criteria
- All providers run through identical baseline contract checks.
- Golden outputs stay stable across refactors.
- CI includes at least Google + CryptPad read-only scenarios.

### Dependencies
- Issue 3
- Issue 4
- Issue 5

---

## Issue 9

Title: `docs(v3): migration guide from google-first API to provider API`

Labels:
- `v3`
- `documentation`
- `breaking-change`

Body:

### Summary
Write migration documentation with before/after config examples and decision guide.

### Scope
- Add upgrade guide with mapping table.
- Add provider capability matrix.
- Add cookbook examples for common migration scenarios.

### Acceptance Criteria
- Users can migrate without reading implementation code.
- Legacy options and their v3 equivalents are documented.
- CryptPad read-only limitations are explicit.

### Dependencies
- Issue 6
- Issue 7

---

## Issue 10

Title: `chore(v3): deprecation policy, release notes, and rollout checklist`

Labels:
- `v3`
- `release`

Body:

### Summary
Prepare major-release rollout assets and deprecation governance.

### Scope
- Define deprecation windows and warning strategy.
- Draft v3 release notes and changelog outline.
- Produce final go/no-go release checklist.

### Acceptance Criteria
- Deprecation warnings are versioned and documented.
- Release checklist includes test, docs, and compatibility gates.
- Final release notes draft is ready before tagging.

### Dependencies
- Issue 8
- Issue 9

---

## Suggested Sequencing

1. Issue 1
2. Issue 2
3. Issue 3 and Issue 4
4. Issue 5
5. Issue 6
6. Issue 7
7. Issue 8
8. Issue 9
9. Issue 10
