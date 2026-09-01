# v3 Major Release Rollout

## Deprecation Policy

### Deprecation Scope

Legacy Google-first option flow (`getSpreadSheetData` + `SpreadsheetOptions`) remains available for transition, but provider runtime is the primary v3 path.

### Warning Strategy

- v3.0.0: mark legacy options as deprecated in docs and release notes.
- v3.1.x: add stronger migration warnings in examples and docs.
- v4.0.0 candidate: evaluate removal of legacy shims based on adoption telemetry and issue feedback.

### Compatibility Guarantees for v3 line

- Legacy APIs remain functional through v3 minors unless critical security or maintenance concerns require early sunset.
- Provider runtime contracts are considered stable for v3 minor additions.

## Go/No-Go Checklist

## Engineering Gates

- [x] Provider contracts and capability model shipped.
- [x] Provider-agnostic transformation core extracted.
- [x] Google provider adapters implemented (input/output/sync).
- [x] CryptPad CSV provider implemented (MVP input only).
- [x] Provider orchestrator and capability gating implemented.
- [x] Provider config schema and legacy mapping implemented.
- [x] Action provider-mode inputs implemented (`provider-config`, `provider-config-path`).
- [x] CLI provider runner binary implemented (`gst-run-provider`).

## Quality Gates

- [x] Provider unit suite passes.
- [x] Provider contract suite passes across Google/CryptPad input adapters.
- [x] Golden fixture test passes for CryptPad pipeline output.
- [x] Existing legacy action tests still pass with provider-mode additions.

## Documentation Gates

- [x] Migration guide published.
- [x] Capability matrix published.
- [x] Provider config examples published.
- [x] CryptPad MVP limitations documented.

## Release Operations Gates

- [ ] Update CHANGELOG with v3 migration section.
- [ ] Publish release notes (draft below) and pin migration guide links.
- [ ] Verify dist bundles include `dist-cli/run-provider.mjs`.
- [ ] Dry-run npm publish and GitHub release workflow.

## v3 Release Notes Draft

### Highlights

- New provider runtime architecture for input/output/sync composition.
- First non-Google provider support via `cryptpad-csv` read-only input adapter.
- Capability-aware orchestration with explicit validation for unsupported operations.
- New provider-run CLI binary: `gst-run-provider`.
- GitHub Action provider mode via `provider-config` or `provider-config-path`.

### Breaking and Migration-Relevant Changes

- Provider runtime is the recommended API surface for new integrations.
- Legacy Google-first options remain supported for transition but are deprecated.
- Users should adopt provider config for long-term compatibility.

### Upgrade Steps

1. Add a provider runtime config JSON.
2. Switch automation to provider mode (Action input or `gst-run-provider`).
3. Keep legacy mode only where immediate migration is not feasible.
4. Validate outputs against existing translation snapshots.

## Owner Checklist (Milestone Closure)

1. Confirm all v3 milestone issues are closed.
2. Confirm branch has merged commits for architecture, adapters, tests, docs.
3. Cut release candidate and run CI + integration matrix.
4. Publish v3 with migration guide prominently linked.
