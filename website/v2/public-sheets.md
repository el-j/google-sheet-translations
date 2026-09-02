# v2 Public Sheets

::: warning v2 public mode docs
Public-sheet usage remains supported, but provider runtime is recommended for future-proof workflows.
:::

When a spreadsheet is shared as "Anyone with link can view", v2 can fetch data without service-account credentials.

```ts
import getSpreadSheetData from '@el-j/google-sheet-translations';

const translations = await getSpreadSheetData(['home', 'i18n'], {
  spreadsheetId: '1QPT1wGSN5knfmXDlN1UKYr3nVUYl4-wDGipaPNurwC0',
  publicSheet: true,
});
```

## Notes

- No `GOOGLE_CLIENT_EMAIL` or `GOOGLE_PRIVATE_KEY` required in this mode.
- Spreadsheet must be publicly readable.
- This mode is read-only.

For provider-based usage, see [Provider Runtime](/guide/provider-runtime).
