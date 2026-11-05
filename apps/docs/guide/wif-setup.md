# Workload Identity Federation (WIF) Setup

**Workload Identity Federation (WIF)** enables GitHub Actions workflows to authenticate securely with Google Cloud APIs (Drive, Sheets, Docs) **without managing or storing long-lived service account private keys** in GitHub Secrets.

---

## 🚀 Quick Setup with Interactive CLI

The package bundles `gst-setup-wif`, an interactive setup CLI that configures GCP Workload Identity Pools, Providers, IAM bindings, and Google Drive permissions automatically.

### Running via npx

```bash
npx @el-j/google-sheet-translations setup-wif
```

### CLI Command Options

```bash
gst-setup-wif [options]

Options:
  -p, --project-id <id>        Google Cloud Project ID
  -s, --service-account <sa>   Service Account email (e.g. sa@proj.iam.gserviceaccount.com)
  -r, --repo <owner/repo>      GitHub repository in owner/repo format
  --pool-id <id>               WIF Pool ID (default: github-actions)
  --provider-id <id>           WIF Provider ID (default: github-provider)
  --drive-folder-id <id>       Google Drive Folder ID to grant permissions on
  -y, --yes                    Skip interactive confirmation prompts
  -h, --help                   Show help
```

---

## 📋 What the Setup Does Automatically

1. **Enables Google Cloud APIs**: Enables IAM Credentials, Cloud Resource Manager, Google Drive, and Google Sheets APIs.
2. **Creates Workload Identity Pool**: Creates a WIF pool (e.g. `projects/12345/locations/global/workloadIdentityPools/github-actions`).
3. **Creates OIDC Provider**: Configures GitHub OIDC token issuer `https://token.actions.githubusercontent.com`.
4. **Binds IAM Permissions**: Grants `roles/iam.workloadIdentityUser` to the GitHub repository claim.
5. **Grants Drive Folder Access**: Adds the service account as an Editor on the specified Google Drive folder.

---

## 🤖 GitHub Actions Workflow Configuration

Once WIF is provisioned, configure your GitHub Actions workflow using `google-github-actions/auth`:

```yaml
jobs:
  translations:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write # Required for WIF OIDC token exchange

    steps:
      - name: Checkout repository
        uses: actions/checkout@v7

      - name: Authenticate to Google Cloud via WIF
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: 'projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions/providers/github-provider'
          service_account: 'sa-translations@your-project.iam.gserviceaccount.com'

      - name: Fetch Translations
        uses: el-j/google-sheet-translations@v2
        with:
          drive_folder_id: ${{ vars.GOOGLE_DRIVE_FOLDER_ID }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

---

## 💻 Programmatic WIF API

You can also automate WIF setup in TypeScript scripts using `setupWIF` and `grantDrivePermissions`:

```typescript
import { setupWIF, grantDrivePermissions } from '@el-j/google-sheet-translations';

const result = await setupWIF({
  projectId: 'my-gcp-project',
  serviceAccountEmail: 'sa@my-gcp-project.iam.gserviceaccount.com',
  githubRepo: 'myorg/myrepo',
});

console.log('Workload Identity Provider:', result.providerResourceName);

// Grant Drive permissions
await grantDrivePermissions({
  projectId: 'my-gcp-project',
  serviceAccountEmail: 'sa@my-gcp-project.iam.gserviceaccount.com',
});
```
