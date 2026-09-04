# Full Sync Operations (v3)

This page covers full provider-sync operations in v3, including CryptPad workspace sync and asset policies.

## Modes

- Google full mode: input + output + sync (`google-sheets`)
- CryptPad full mode: input (`cryptpad-csv`) + output/sync (`cryptpad-workspace`) + assets (`cryptpad-assets`)
- Mixed mode: cross-provider composition guarded by capability checks

## Conflict policies

- `remote-wins`: keep remote value on conflicts
- `local-wins`: apply local value on conflicts
- `manual`: skip conflicting keys, merge non-conflicting keys

## Migration and safety

```bash
gst-migrate-v3 --dry-run
gst-migrate-v3 --dry-run --parity-check
gst-migrate-v3 --write-workflows --provider-config-path=.github/provider.config.json
```

## Asset sync safety

- path traversal protection on `relativePath`
- hash-based dedupe during sync
- optional `deleteMissing` cleanup policy

For migration details, read [Migration to v3](/guide/provider-migration-v3).
