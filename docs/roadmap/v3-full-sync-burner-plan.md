# v3 Burner Feature Plan: Full Provider Sync Platform

## Objective

Deliver full provider parity beyond Google so users can choose where translation tables and assets live, then sync in both directions with one runtime model.

Primary burner target:

- Full CryptPad support (read, write-back, conflict-aware sync, asset sync hooks)
- Generic provider framework so the same sync semantics can extend to other hosts

## Scope Expansion Beyond MVP

Current state:

- `cryptpad-csv` supports input-only read mode.
- Google adapters provide full sync and formula flows.

Burner target state:

- CryptPad provider family supports:
  - table read
  - table write
  - bidirectional sync
  - image/asset sync
  - discovery/index where feasible
- Capability model expanded for provider-native conflict, locking, and revision semantics.

## Architecture Blueprint

## Provider planes

1. Data plane
- `TranslationInputProvider`
- `TranslationOutputProvider`
- `TranslationSyncProvider`

2. Asset plane
- `AssetInputProvider`
- `AssetOutputProvider`
- `AssetSyncProvider`

3. Catalog plane
- `ProviderCatalogProvider` for source discovery, indexing, and provider metadata

## Canonical models

- `CanonicalTable`
- `CanonicalTranslationSnapshot`
- `CanonicalAssetManifest`
- `SyncDelta`
- `ConflictSet`

## Sync engine responsibilities

- Three-way diff (local, remote, base snapshot)
- Conflict policies (`remote-wins`, `local-wins`, `manual`, `semantic-merge`)
- Idempotent retries with checkpoint journal
- Partial-run resume after failure

## CryptPad-specific implementation strategy

## Connector modes

1. Public export mode
- CSV/JSON fetch from stable endpoints
- no auth
- read-focused

2. Authenticated API/session mode
- authenticated fetch and write where available
- row/table update operations
- revision markers for optimistic concurrency

3. Workspace file mode
- local mounted export/import files
- deterministic CI runs

## Write-back contract

- update existing keys
- append missing keys
- preserve non-managed columns when configured
- optional strict schema enforcement

## Asset sync contract

- fetch manifest from provider
- download/update/delete assets by policy
- content-hash dedupe
- extension normalization
- path safety guarantees

## Other provider readiness

The same architecture should support future adapters such as:

- Airtable
- Notion databases
- Coda
- generic REST table APIs
- Git-based content stores

## Testing and reliability gates

## Contract tests

- Every provider must pass shared contract suites:
  - input
  - output
  - sync
  - asset sync
  - discovery

## Golden fixtures

- table transformations
- sync delta calculations
- conflict resolution outcomes
- asset manifest reconciliation

## Integration tests

- cryptpad full round-trip suite
- google regression suite
- mixed-provider interoperability suite

## Failure testing

- network interruptions
- stale revision write attempts
- partial sync restarts
- conflict storms

## CI quality target

- 100 percent pass rate on required suites for release branch
- flaky-test budget zero on release candidate pipeline
- release blocked by any regression in legacy compatibility suites

## Migration requirements

## Documentation

- user migration guide (legacy -> provider runtime)
- provider capability matrix
- conflict policy cookbook
- operations/runbook docs

## Migration tooling

Introduce `gst-migrate-v3` command:

- reads legacy config usage patterns
- emits provider runtime config file
- prints deprecation notes and unresolved manual steps
- optional dry-run comparison against current output snapshots

## Backward compatibility policy

- v3.x keeps compatibility wrappers for legacy flows
- warnings become stronger across minors
- removal only in next major after migration window

## Delivery phases

1. Core sync engine hardening
2. CryptPad write-back + revision control
3. CryptPad asset sync
4. Cross-provider interoperability and catalog discovery
5. Migration command and final docs
6. Release candidate hardening and rollout

## Definition of done

- CryptPad full sync parity shipped and documented
- Provider-agnostic asset sync interfaces shipped
- `gst-migrate-v3` shipped
- contract, integration, and regression suites green
- migration path validated on at least two existing real user projects
