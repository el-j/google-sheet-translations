# validateEnv

Validates that all required Google Sheets API environment variables are present and non-empty.

## Signature

```typescript
function validateEnv(): GoogleEnvVars
```

## Returns

[`GoogleEnvVars`](/api/types#googleenvvars) — an object containing the validated env var values.

## Throws

`Error` if any required variable is missing or empty:

```
Missing required environment variables: GOOGLE_PRIVATE_KEY, GOOGLE_SPREADSHEET_ID

Make sure these are set in your .env file or environment.
```

## Example

```typescript
import { validateEnv } from '@el-j/google-sheet-translations';

// Call early in your script / startup to fail fast
const { GOOGLE_SPREADSHEET_ID } = validateEnv();
console.log('Using spreadsheet:', GOOGLE_SPREADSHEET_ID);
```

## Required env vars

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_EMAIL` | Service account email address |
| `GOOGLE_PRIVATE_KEY` | RSA private key (with `\n` newlines) |
| `GOOGLE_SPREADSHEET_ID` | ID extracted from the Sheets URL |
