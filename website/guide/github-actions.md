# GitHub Actions Integration

There are two ways to authenticate with Google APIs from a GitHub Actions workflow.
Both are fully supported by this package.

## Option 1 — Workload Identity Federation (recommended, keyless)

[Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation) lets GitHub Actions authenticate to Google Cloud **without storing a long-lived service account key**. GitHub issues a short-lived OIDC token for every run; Google Cloud exchanges it for a scoped access token.

**Why prefer this?**
- No JSON key to rotate, leak, or accidentally commit
- Credentials expire automatically after each job
- Auditable: restrict access by repo, branch, or actor

### Step 1 — Configure Google Cloud (once)

> [!TIP]
> You can do this via the Cloud Console, `gcloud` CLI, or Terraform. The gcloud
> steps below are the quickest path.

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

Then note your **Workload Identity Provider** resource name:

```bash
gcloud iam workload-identity-pools providers describe "github-provider" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="value(name)"
# → projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-provider
```

Store it as a **repository variable** (not secret): **Settings → Secrets and variables → Actions → Variables**:

| Variable | Value |
|----------|-------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/…/providers/github-provider` |
| `GCP_SERVICE_ACCOUNT` | `my-sa@my-project.iam.gserviceaccount.com` |
| `GOOGLE_SPREADSHEET_ID` | Your spreadsheet ID |

### Step 2 — GitHub Actions workflow

```yaml
name: Sync Translations

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest

    permissions:
      contents: write       # push updated translation files
      id-token: write       # ← required for OIDC token issuance

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Authenticate to Google Cloud (WIF)
        uses: google-github-actions/auth@v3
        with:
          workload_identity_provider: ${{ vars.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ vars.GCP_SERVICE_ACCOUNT }}
        # ↑ Sets GOOGLE_APPLICATION_CREDENTIALS automatically

      - run: npm ci

      - name: Sync translations
        run: node sync-translations.js
        env:
          GOOGLE_SPREADSHEET_ID: ${{ vars.GOOGLE_SPREADSHEET_ID }}
          # No GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY needed!
```

The `google-github-actions/auth` step writes a short-lived credential file and sets
`GOOGLE_APPLICATION_CREDENTIALS` to its path. The package detects this variable and
uses Application Default Credentials automatically.

---

## Option 2 — Service account key (classic secrets)

If you already have a service account JSON key, store it split across two secrets and reference them in the workflow.

### Step 1 — Create the secrets

Go to **Settings → Secrets and variables → Actions → Secrets** and add:

| Secret | Value |
|--------|-------|
| `GOOGLE_CLIENT_EMAIL` | `client_email` field from the JSON key |
| `GOOGLE_PRIVATE_KEY` | `private_key` field from the JSON key |

Add a repository **variable** (not secret) for the spreadsheet ID:

| Variable | Value |
|----------|-------|
| `GOOGLE_SPREADSHEET_ID` | Your spreadsheet ID |

> [!IMPORTANT]
> When you paste the private key into a GitHub Secret the literal string `\n` is stored
> instead of real newlines. The package converts them automatically at runtime — no
> manual editing needed.

### Step 2 — GitHub Actions workflow

```yaml
name: Sync Translations

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - run: npm ci

      - name: Sync translations
        run: node sync-translations.js
        env:
          GOOGLE_CLIENT_EMAIL: ${{ secrets.GOOGLE_CLIENT_EMAIL }}
          GOOGLE_PRIVATE_KEY: ${{ secrets.GOOGLE_PRIVATE_KEY }}
          GOOGLE_SPREADSHEET_ID: ${{ vars.GOOGLE_SPREADSHEET_ID }}
```

---

## Authentication priority

When both `GOOGLE_APPLICATION_CREDENTIALS` **and** `GOOGLE_CLIENT_EMAIL`/`GOOGLE_PRIVATE_KEY` are set, the package always prefers WIF/ADC (`GOOGLE_APPLICATION_CREDENTIALS`).

| `GOOGLE_APPLICATION_CREDENTIALS` set? | `GOOGLE_CLIENT_EMAIL` + `GOOGLE_PRIVATE_KEY` set? | Mode used |
|---------------------------------------|---------------------------------------------------|-----------|
| ✅ Yes | any | WIF / ADC |
| ❌ No | ✅ Yes | Service account key |
| ❌ No | ❌ No | ❌ Error thrown |
