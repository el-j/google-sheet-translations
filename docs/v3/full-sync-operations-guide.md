# v3 Full Sync Operations Guide

## Scope

This guide documents full-sync operations for provider runtime in v3, including CryptPad workspace sync and asset synchronization.

## Operational modes

1. `google-sheets` full mode
- input, output, and sync in Google
- optional formula auto-translation

2. `cryptpad-csv` plus `cryptpad-workspace`
- input via CSV source(s)
- output and sync via workspace snapshot adapter
- optimistic revision checks for write safety

3. mixed mode
- read via one provider, write/sync via another
- capability checks enforce valid combinations

## Failure recovery runbook

## Sync failures

- If sync fails with revision mismatch:
  - fetch latest remote state
  - re-run with updated expected revision
  - or use conflict policy `manual` to inspect unresolved deltas

- If sync fails with capability error:
  - verify provider supports the requested operation (`read-input`, `write-output`, `sync-back`, `sync-assets`, `discover-sources`)

## Asset sync failures

- Unsafe path detected:
  - provider blocks traversal writes outside target directory
  - fix manifest `relativePath` entries

- Download failures:
  - retry source access
  - verify `sourcePath` / `sourceUrl` for each asset entry

## Conflict policy cookbook

## `remote-wins`

Use when remote editors are source-of-truth.

- Local conflicting changes are ignored.
- Non-conflicting local inserts/updates still apply.

## `local-wins`

Use for deterministic CI publishing where local repository state is authoritative.

- Local updates overwrite conflicting remote values.

## `manual`

Use for human-in-the-loop review.

- Conflicting entries are skipped and reported.
- Non-conflicting local changes still merge.

## Migration playbook

1. Run `gst-migrate-v3 --dry-run`.
2. Validate mapping parity with `gst-migrate-v3 --dry-run --parity-check`.
3. Apply migration with `--write-workflows` in a branch.
4. Compare outputs with existing snapshots.
5. Roll out provider runtime to default workflows.

## Rollback playbook

1. Keep legacy workflow file in branch history.
2. Restore previous Action inputs if needed.
3. Re-run release tests and compare outputs.
4. Re-open migration rollout only after conflict and parity checks pass.
