# GitHub Actions

The package ships as a **single, unified GitHub Action** that covers all usage
modes — basic translation sync, multi-spreadsheet Drive folder management, and
image downloads — in one step.

```
el-j/google-sheet-translations@v2
```

The action automatically routes to the right code path based on which inputs
you provide:

| Inputs set | Mode |
|------------|------|
| `google-spreadsheet-id` only | Single spreadsheet |
| `drive-folder-id` and/or `spreadsheet-ids` | Drive folder / multi-spreadsheet |
| `sync-images: true` | + image download from Drive folder |

> **One action, three modes — no separate action needed.**

---

## Mode 1 — Basic single-spreadsheet sync

The simplest workflow: fetch translations from one spreadsheet and commit them.

```yaml
# .github/workflows/translations.yml
name: Sync Translations

on:
  schedule:
    - cron: '0 6 * * *'   # daily at 06:00 UTC
  workflow_dispatch:        # allow manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - name: Fetch translations
        uses: el-j/google-sheet-translations@v2
        with:
          google-client-email: ${{ secrets.GOOGLE_CLIENT_EMAIL }}
          google-private-key: ${{ secrets.GOOGLE_PRIVATE_KEY }}
          google-spreadsheet-id: ${{ secrets.GOOGLE_SPREADSHEET_ID }}
          sheet-titles: 'home,common,about'

      - name: Commit updated translation files
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'chore: sync translations'
          file_pattern: 'translations/ src/i18n/locales.ts src/lib/languageData.json'
```

> [!NOTE]
> The `git-auto-commit-action` step is optional — skip it if your build
> fetches translations at build time and never commits them.

---

## Mode 2 — Drive folder management (multi-spreadsheet)

When `drive-folder-id` is set the action scans the Drive folder for every
Google Spreadsheet, fetches and merges all of them, and writes the combined
translation files.

```yaml
# .github/workflows/drive-translations.yml
name: Sync Drive Translations

on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - name: Fetch translations from Drive folder
        uses: el-j/google-sheet-translations@v2
        with:
          google-client-email: ${{ secrets.GOOGLE_CLIENT_EMAIL }}
          google-private-key: ${{ secrets.GOOGLE_PRIVATE_KEY }}
          # No google-spreadsheet-id needed — Drive folder is the source of truth
          sheet-titles: 'home,common,about'

          # ── Drive folder inputs ──────────────────────────────────────────
          drive-folder-id: ${{ secrets.GOOGLE_DRIVE_FOLDER_ID }}
          scan-for-spreadsheets: 'true'   # auto-discover all spreadsheets

          # Optional: also commit translation files
      - name: Commit updated translation files
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'chore: sync drive translations'
          file_pattern: 'translations/ src/i18n/'
```

> [!TIP]
> You need to enable the **Google Drive API** for the Drive folder inputs to
> work. See [Service Account Setup → Part 2](/guide/service-account-setup#part-2--enabling-the-drive-api-for-folder--image-usage).

---

## Mode 3 — Drive folder + image sync

The complete headless CMS pipeline: fetch translations **and** download images
from the same Drive folder.

```yaml
# .github/workflows/cms-sync.yml
name: CMS Sync (translations + images)

on:
  schedule:
    - cron: '0 5 * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - name: Sync translations and images from Drive
        id: cms
        uses: el-j/google-sheet-translations@v2
        with:
          google-client-email: ${{ secrets.GOOGLE_CLIENT_EMAIL }}
          google-private-key: ${{ secrets.GOOGLE_PRIVATE_KEY }}
          sheet-titles: 'home,common,about,blog'

          # ── Drive folder inputs ──────────────────────────────────────────
          drive-folder-id: ${{ secrets.GOOGLE_DRIVE_FOLDER_ID }}
          scan-for-spreadsheets: 'true'

          # ── Image sync ───────────────────────────────────────────────────
          sync-images: 'true'
          image-output-path: './public/remote-images'

      - name: Show sync results
        run: |
          echo "Translations dir: ${{ steps.cms.outputs.translations-dir }}"
          echo "Locales file:      ${{ steps.cms.outputs.locales-file }}"

      - name: Commit all synced assets
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'chore: cms sync (translations + images)'
          file_pattern: 'translations/ src/i18n/ public/remote-images/'
```

---

## Mode 4 — Explicit spreadsheet IDs (no Drive scan)

If you know your spreadsheet IDs upfront and don't need Drive folder scanning,
pass them directly:

```yaml
- uses: el-j/google-sheet-translations@v2
  with:
    google-client-email: ${{ secrets.GOOGLE_CLIENT_EMAIL }}
    google-private-key: ${{ secrets.GOOGLE_PRIVATE_KEY }}
    sheet-titles: 'home,common'
    spreadsheet-ids: '${{ secrets.SPREADSHEET_ID_MAIN }},${{ secrets.SPREADSHEET_ID_BLOG }}'
```

---

## Auto-translation on push

Inject `=GOOGLETRANSLATE()` formulas for missing translations when new keys are
pushed to the spreadsheet:

```yaml
- uses: el-j/google-sheet-translations@v2
  with:
    google-client-email: ${{ secrets.GOOGLE_CLIENT_EMAIL }}
    google-private-key: ${{ secrets.GOOGLE_PRIVATE_KEY }}
    google-spreadsheet-id: ${{ secrets.GOOGLE_SPREADSHEET_ID }}
    sheet-titles: 'home,common'
    sync-local-changes: 'true'
    auto-translate: 'true'
```

---

## All action inputs

| Input | Default | Description |
|-------|---------|-------------|
| `google-client-email` | — *(required)* | Service account `client_email` |
| `google-private-key` | — *(required)* | Service account `private_key` |
| `google-spreadsheet-id` | `''` | Single spreadsheet ID (omit when using Drive folder) |
| `sheet-titles` | — *(required)* | Comma-separated sheet tab names |
| `drive-folder-id` | `''` | Drive folder ID — triggers Drive mode |
| `scan-for-spreadsheets` | `'true'` | Auto-discover spreadsheets in the folder |
| `spreadsheet-ids` | `''` | Comma-separated explicit spreadsheet IDs |
| `sync-images` | `'false'` | Download images from Drive folder |
| `image-output-path` | `'./public/remote-images'` | Local directory for downloaded images |
| `sync-local-changes` | `'true'` | Push local key changes back to spreadsheet |
| `auto-translate` | `'false'` | Inject GOOGLETRANSLATE formulas for missing cells |
| `override` | `'false'` | Overwrite existing translations with formulas |
| `clean-push` | `'false'` | Push all keys regardless of timestamp |
| `auto-create` | `'true'` | Create a new spreadsheet when no ID is provided |
| `translations-output-dir` | `'translations'` | Directory for per-locale JSON files |
| `locales-output-path` | `'src/i18n/locales.ts'` | Path for the generated locales list |
| `data-json-path` | `'src/lib/languageData.json'` | Path for the sync snapshot |
| `row-limit` | `'100'` | Max rows per sheet |
| `wait-seconds` | `'1'` | Throttle delay between API calls |

## Action outputs

| Output | Description |
|--------|-------------|
| `translations-dir` | Absolute path of the locale JSON directory |
| `locales-file` | Absolute path of the generated `locales.ts` |
| `data-json-file` | Absolute path of `languageData.json` |

---

## Required secrets

Set these in **Settings → Secrets and variables → Actions**:

| Secret | Required for |
|--------|-------------|
| `GOOGLE_CLIENT_EMAIL` | All modes |
| `GOOGLE_PRIVATE_KEY` | All modes |
| `GOOGLE_SPREADSHEET_ID` | Single-spreadsheet mode |
| `GOOGLE_DRIVE_FOLDER_ID` | Drive folder mode |

> **First time?** Follow the [Service Account Setup guide →](/guide/service-account-setup)
> to create the service account and enable the correct APIs.

---

## Why one action instead of two?

The action automatically detects which mode to run based on your inputs:

- If `drive-folder-id` **or** `spreadsheet-ids` is set → Drive / multi-spreadsheet mode
- Otherwise → single-spreadsheet mode
- `sync-images: true` layers image sync on top of either Drive mode

This means your workflow never needs to choose between separate actions — the
routing is internal and zero-configuration. Both modes share the same output
variables, so downstream steps (like committing files or uploading artifacts)
are identical regardless of mode.
