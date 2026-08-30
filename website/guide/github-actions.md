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

## Authentication

The action supports two authentication methods — choose one:

### Option A — Workload Identity Federation (recommended, keyless)

[Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation) authenticates **without storing a long-lived service account key**. GitHub issues a short-lived OIDC token each run; Google Cloud exchanges it for a scoped access token.

**Why prefer this?**
- No JSON key to rotate, leak, or accidentally commit
- Credentials expire automatically after each job
- Auditable: restrict access by repo, branch, or actor

**Step 1 — Configure Google Cloud (once)**

> [!TIP]
> You can do this via the Cloud Console, `gcloud` CLI, or Terraform.

```bash
PROJECT_ID="my-gcp-project"
SA_EMAIL="my-sa@${PROJECT_ID}.iam.gserviceaccount.com"
REPO="my-org/my-repo"   # GitHub owner/repo

# 1. Create a Workload Identity Pool
gcloud iam workload-identity-pools create "github-pool" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# 2. Create an OIDC provider inside the pool
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# 3. Allow the pool to impersonate the service account (scoped to your repo)
POOL_NAME=$(gcloud iam workload-identity-pools describe "github-pool" \
  --project="${PROJECT_ID}" --location="global" --format="value(name)")

gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL_NAME}/attribute.repository/${REPO}"
```

Note your **Workload Identity Provider** resource name:

```bash
gcloud iam workload-identity-pools providers describe "github-provider" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="value(name)"
# → projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider
```

**Step 2 — Store repository variables**

Go to **Settings → Secrets and variables → Actions → Variables** and add:

| Variable | Value |
|----------|-------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/…/providers/github-provider` |
| `GCP_SERVICE_ACCOUNT` | `my-sa@my-project.iam.gserviceaccount.com` |
| `GOOGLE_SPREADSHEET_ID` | Your spreadsheet ID |

**Step 3 — Add `google-github-actions/auth` before the action**

```yaml
- name: Authenticate to Google Cloud (WIF)
  uses: google-github-actions/auth@v3
  with:
    workload_identity_provider: ${{ vars.GCP_WORKLOAD_IDENTITY_PROVIDER }}
    service_account: ${{ vars.GCP_SERVICE_ACCOUNT }}
  # ↑ Sets GOOGLE_APPLICATION_CREDENTIALS automatically

- name: Fetch translations
  uses: el-j/google-sheet-translations@v2
  with:
    # No google-client-email or google-private-key needed!
    google-spreadsheet-id: ${{ vars.GOOGLE_SPREADSHEET_ID }}
    sheet-titles: 'home,common,about'
```

The `google-github-actions/auth` step writes a short-lived credential file and
sets `GOOGLE_APPLICATION_CREDENTIALS`. The action detects this and uses
Application Default Credentials automatically.

> [!IMPORTANT]
> Your workflow job needs `id-token: write` permission for OIDC token issuance:
> ```yaml
> permissions:
>   contents: write   # to commit translation files
>   id-token: write   # required for WIF
> ```

---

### Option B — Service account key (classic secrets)

Store the service account credentials as GitHub Secrets:

| Secret | Value |
|--------|-------|
| `GOOGLE_CLIENT_EMAIL` | `client_email` field from the JSON key |
| `GOOGLE_PRIVATE_KEY` | `private_key` field from the JSON key |
| `GOOGLE_SPREADSHEET_ID` | Your spreadsheet ID (can also be a variable) |

> [!IMPORTANT]
> When you paste the private key into a GitHub Secret, the literal string `\n` is
> stored instead of real newlines. The action converts them automatically at
> runtime — no manual editing needed.

```yaml
- name: Fetch translations
  uses: el-j/google-sheet-translations@v2
  with:
    google-client-email: ${{ secrets.GOOGLE_CLIENT_EMAIL }}
    google-private-key: ${{ secrets.GOOGLE_PRIVATE_KEY }}
    google-spreadsheet-id: ${{ secrets.GOOGLE_SPREADSHEET_ID }}
    sheet-titles: 'home,common,about'
```

---

### Authentication priority

| `GOOGLE_APPLICATION_CREDENTIALS` set? | `google-client-email` + `google-private-key` set? | Mode used |
|---------------------------------------|---------------------------------------------------|-----------|
| ✅ Yes (WIF via `google-github-actions/auth`) | any | WIF / ADC |
| ❌ No | ✅ Yes | Service account key |
| ❌ No | ❌ No | ❌ Error thrown |

---

## Mode 1 — Basic single-spreadsheet sync (WIF)

The simplest workflow using Workload Identity Federation:

```yaml
# .github/workflows/translations.yml
name: Sync Translations

on:
  schedule:
    - cron: '0 6 * * *'   # daily at 06:00 UTC
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write       # required to commit translation files
      id-token: write       # required for WIF

    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud (WIF)
        uses: google-github-actions/auth@v3
        with:
          workload_identity_provider: ${{ vars.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ vars.GCP_SERVICE_ACCOUNT }}

      - name: Fetch translations
        uses: el-j/google-sheet-translations@v2
        with:
          google-spreadsheet-id: ${{ vars.GOOGLE_SPREADSHEET_ID }}
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

## Mode 1 — Basic single-spreadsheet sync (classic key)

The same workflow using a classic service account key:

```yaml
# .github/workflows/translations.yml
name: Sync Translations

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
      id-token: write   # omit if using classic key

    steps:
      - uses: actions/checkout@v4

      # ── WIF auth (remove these two steps if using classic key) ──────────
      - name: Authenticate to Google Cloud (WIF)
        uses: google-github-actions/auth@v3
        with:
          workload_identity_provider: ${{ vars.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ vars.GCP_SERVICE_ACCOUNT }}

      - name: Fetch translations from Drive folder
        uses: el-j/google-sheet-translations@v2
        with:
          # WIF: omit google-client-email / google-private-key
          # Classic key: add google-client-email + google-private-key secrets instead
          sheet-titles: 'home,common,about'

          # ── Drive folder inputs ──────────────────────────────────────────
          drive-folder-id: ${{ secrets.GOOGLE_DRIVE_FOLDER_ID }}
          scan-for-spreadsheets: 'true'   # auto-discover all spreadsheets

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
      id-token: write   # omit if using classic key

    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud (WIF)
        uses: google-github-actions/auth@v3
        with:
          workload_identity_provider: ${{ vars.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ vars.GCP_SERVICE_ACCOUNT }}

      - name: Sync translations and images from Drive
        id: cms
        uses: el-j/google-sheet-translations@v2
        with:
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
    # WIF: no credentials needed here (google-github-actions/auth runs first)
    # Classic key: add google-client-email + google-private-key
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
    google-spreadsheet-id: ${{ vars.GOOGLE_SPREADSHEET_ID }}
    sheet-titles: 'home,common'
    sync-local-changes: 'true'
    auto-translate: 'true'
```

---

## All action inputs

| Input | Default | Description |
|-------|---------|-------------|
| `google-client-email` | `''` | Service account `client_email` — omit when using WIF |
| `google-private-key` | `''` | Service account `private_key` — omit when using WIF |
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

## Required secrets / variables

### WIF mode

| Variable | Required for |
|----------|-------------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | WIF |
| `GCP_SERVICE_ACCOUNT` | WIF |
| `GOOGLE_SPREADSHEET_ID` | Single-spreadsheet mode |
| `GOOGLE_DRIVE_FOLDER_ID` | Drive folder mode |

### Classic key mode

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
