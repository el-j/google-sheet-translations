# Environment Variables

The package supports two authentication modes. Only one is required.

## Authentication modes

### Mode 1 — Workload Identity Federation (recommended for GitHub Actions)

**No long-lived secrets needed.** Uses Google's [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation) so GitHub's OIDC identity is exchanged for a short-lived Google access token at runtime.

Set only:

| Variable | Description |
|----------|-------------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to the credential JSON written by `google-github-actions/auth` (set automatically by the action) |
| `GOOGLE_SPREADSHEET_ID` | The ID from the spreadsheet URL |

See [GitHub Actions guide](/guide/github-actions) for the full setup walkthrough.

---

### Mode 2 — Service account key (classic)

Store a downloaded service-account key as environment variables. Works locally, in any CI system, and in GitHub Actions.

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_EMAIL` | Service account email (`…@….iam.gserviceaccount.com`) |
| `GOOGLE_PRIVATE_KEY` | RSA private key from the service account JSON |
| `GOOGLE_SPREADSHEET_ID` | The ID from the spreadsheet URL |

---

## Finding the spreadsheet ID

In your Google Sheets URL:

```
https://docs.google.com/spreadsheets/d/1QPT1wGSN5knfmXDlN1UKYr3nVUYl4-wDGipaPNurwC0/edit
                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                        This is your GOOGLE_SPREADSHEET_ID
```

## Setting variables locally (Mode 2)

Create a `.env` file (never commit this):

```dotenv
GOOGLE_CLIENT_EMAIL=fetch-bot@my-project-123.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIB...\n-----END RSA PRIVATE KEY-----\n"
GOOGLE_SPREADSHEET_ID=1QPT1wGSN5knfmXDlN1UKYr3nVUYl4-wDGipaPNurwC0
```

Then load with `dotenv` before calling the package:

```typescript
import 'dotenv/config';
import getSpreadSheetData from '@el-j/google-sheet-translations';
```

## Validating at startup

```typescript
import { validateEnv } from '@el-j/google-sheet-translations';

validateEnv(); // throws a descriptive Error if any variable is missing
```

In WIF mode (`GOOGLE_APPLICATION_CREDENTIALS` is set), `validateEnv()` only requires `GOOGLE_SPREADSHEET_ID` — it does **not** throw for missing `GOOGLE_CLIENT_EMAIL` or `GOOGLE_PRIVATE_KEY`.

## CI / GitHub Actions

See the dedicated **[GitHub Actions guide](/guide/github-actions)** for both the classic secrets approach and the recommended keyless WIF approach.

Quick reference — classic secrets:

```yaml
env:
  GOOGLE_CLIENT_EMAIL: ${{ secrets.GOOGLE_CLIENT_EMAIL }}
  GOOGLE_PRIVATE_KEY: ${{ secrets.GOOGLE_PRIVATE_KEY }}
  GOOGLE_SPREADSHEET_ID: ${{ secrets.GOOGLE_SPREADSHEET_ID }}
```

> [!IMPORTANT]
> When you paste your private key into a GitHub Secret the literal string `\n` is stored
> instead of real newlines. The package automatically converts `\n` → real newlines at
> runtime, so you can paste the key exactly as it appears in your service-account JSON
> (including the `\n` sequences) without any manual editing.
