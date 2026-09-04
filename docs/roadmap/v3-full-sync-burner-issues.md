# v3 Burner Backlog: Full CryptPad and Multi-Provider Sync

Milestone proposal: `v3 Full Provider Sync Burner`

## Issue A

Title: `feat(v3): add asset provider contracts and sync capabilities`

Acceptance criteria:

- Add asset input/output/sync contracts.
- Extend capability model for asset planes.
- Add capability gate tests for asset operations.

## Issue B

Title: `feat(v3): implement generic sync engine with three-way diff and conflict policies`

Acceptance criteria:

- Create canonical sync delta and conflict models.
- Implement `remote-wins`, `local-wins`, and `manual` policies.
- Add deterministic golden tests for conflict outcomes.

Depends on: Issue A

## Issue C

Title: `feat(v3): add cryptpad authenticated connector and write-back adapter`

Acceptance criteria:

- Add authenticated connector mode (where platform allows).
- Support key insert, update, and schema-safe append.
- Support revision checks for optimistic concurrency.

Depends on: Issue B

## Issue D

Title: `feat(v3): add cryptpad bidirectional sync provider`

Acceptance criteria:

- Implement full sync provider for CryptPad.
- Reuse generic sync engine.
- Add integration tests for round-trip data consistency.

Depends on: Issue C

## Issue E

Title: `feat(v3): add cryptpad asset discovery and image sync provider`

Acceptance criteria:

- Build asset manifest pull from provider.
- Add download/update/delete policies.
- Add path-safe write and hash-based dedupe.

Depends on: Issue A and Issue C

## Issue F

Title: `feat(v3): add provider catalog and source discovery interfaces`

Acceptance criteria:

- Define provider discovery contract.
- Implement discovery for Google and CryptPad adapters.
- Add catalog integration tests.

Depends on: Issue A and Issue C

## Issue G

Title: `feat(v3): add gst-migrate-v3 command for legacy migration`

Acceptance criteria:

- Parse legacy configuration patterns.
- Emit provider runtime config scaffold.
- Support dry-run output parity check mode.

Depends on: current v3 provider runtime merge

## Issue H

Title: `test(v3): add full provider parity test matrix and release gates`

Acceptance criteria:

- Contract suites for input/output/sync/assets/discovery.
- Golden fixtures for sync conflicts.
- Integration matrix for Google full and CryptPad full modes.

Depends on: Issues B, D, E, F

## Issue I

Title: `docs(v3): publish full-sync operations guide and conflict playbook`

Acceptance criteria:

- Document operational modes and failure recovery.
- Publish conflict resolution cookbook.
- Publish migration and rollback playbooks.

Depends on: Issues D, E, G

## Issue J

Title: `chore(v3): release candidate checklist for full provider sync`

Acceptance criteria:

- CI/test hardening checklist complete.
- Compatibility and migration sign-off complete.
- Release notes and upgrade templates finalized.

Depends on: Issues H and I

## Suggested order

1. A
2. B
3. C
4. D and E
5. F
6. G
7. H
8. I
9. J
