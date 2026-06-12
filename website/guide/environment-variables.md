# Environment Variables

The package requires exactly three environment variables:

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_EMAIL` | Service account email (`…@….iam.gserviceaccount.com`) |
| `GOOGLE_PRIVATE_KEY` | RSA private key from the service account JSON |
| `GOOGLE_SPREADSHEET_ID` | The ID from the spreadsheet URL |

## Finding the spreadsheet ID

In your Google Sheets URL:

```
https://docs.google.com/spreadsheets/d/1QPT1wGSN5knfmXDlN1UKYr3nVUYl4-wDGipaPNurwC0/edit
                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                        This is your GOOGLE_SPREADSHEET_ID
```

## Setting variables locally

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

## CI / GitHub Actions

Add the three variables as repository secrets in **Settings → Secrets and variables → Actions**, then reference them in your workflow:

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
