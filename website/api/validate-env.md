# validateEnv

Validates that all required Google Sheets API environment variables are present and non-empty.

## Signature

```typescript
function validateEnv(): GoogleEnvVars
```

## Returns

[`GoogleEnvVars`](/api/types#googleenvvars) — an object containing the validated env var values.

## Throws

`Error` if `GOOGLE_SPREADSHEET_ID` is missing, or if neither service-account key
credentials nor `GOOGLE_APPLICATION_CREDENTIALS` (WIF/ADC) are set:

```
Missing required environment variables: GOOGLE_PRIVATE_KEY

Make sure these are set in your .env file or environment.
Alternatively, set GOOGLE_APPLICATION_CREDENTIALS for Workload Identity Federation.
```

## Example

```typescript
import { validateEnv } from '@el-j/google-sheet-translations';

// Call early in your script / startup to fail fast
const { GOOGLE_SPREADSHEET_ID } = validateEnv();
console.log('Using spreadsheet:', GOOGLE_SPREADSHEET_ID);
```

## Authentication modes

### Mode 1 — Workload Identity Federation / ADC

When `GOOGLE_APPLICATION_CREDENTIALS` is set (e.g. written automatically by
`google-github-actions/auth`), only `GOOGLE_SPREADSHEET_ID` is required.
`GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY` are **not** checked.

```yaml
# GitHub Actions with WIF — only GOOGLE_SPREADSHEET_ID needed
env:
  GOOGLE_SPREADSHEET_ID: ${{ vars.GOOGLE_SPREADSHEET_ID }}
  # GOOGLE_APPLICATION_CREDENTIALS set automatically by google-github-actions/auth
```

### Mode 2 — Service account key (classic)

When `GOOGLE_APPLICATION_CREDENTIALS` is **not** set, all three variables are required:

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_EMAIL` | Service account email address |
| `GOOGLE_PRIVATE_KEY` | RSA private key (with `\n` newlines) |
| `GOOGLE_SPREADSHEET_ID` | ID extracted from the Sheets URL |
