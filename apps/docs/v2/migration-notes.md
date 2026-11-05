# v2 to v3 Migration Notes

## Why migrate

v3 introduces explicit provider composition for input/output/sync and capability safety checks.

## Safe migration path

1. Keep existing v2 workflow running.
2. Generate provider config with `gst-migrate-v3 --dry-run`.
3. Switch one branch/workflow to provider mode.
4. Compare outputs.
5. Move default workflow to provider mode.

## Commands

```bash
gst-migrate-v3 --dry-run
gst-migrate-v3 --write-workflows --provider-config-path=.github/provider.config.json
```

Full guide: [Migration to v3](/guide/provider-migration-v3).
