# Spreadsheet Setup

## Demo template

Get started instantly with our ready-to-use demo spreadsheet:

**[📄 Open demo spreadsheet →](https://docs.google.com/spreadsheets/d/1QPT1wGSN5knfmXDlN1UKYr3nVUYl4-wDGipaPNurwC0/edit)**

It is publicly accessible — no login required. You can:

- **View it** and use it directly with `publicSheet: true` (see [Public Sheets guide](/guide/public-sheets))
- **Copy it** to your own Google Drive via **File → Make a copy**

Direct copy link:
```
https://docs.google.com/spreadsheets/d/1QPT1wGSN5knfmXDlN1UKYr3nVUYl4-wDGipaPNurwC0/copy
```

## Spreadsheet structure

Each Google Sheet should follow this layout:

| key | en | de | fr |
|-----|----|----|-----|
| welcome | Welcome | Willkommen | Bienvenue |
| goodbye | Goodbye | Auf Wiedersehen | Au revoir |

- **Column 1** — the translation key (used as the variable name in your app)
- **Remaining columns** — locale codes as headers (any format the package recognizes)

## Supported locale formats

The package recognises these header formats:

| Header | Normalized to |
|--------|--------------|
| `en` | `en-GB` |
| `de` | `de-DE` |
| `fr` | `fr-FR` |
| `en-us` | `en-us` |
| `zh_cn` | `zh-cn` |
| `pt-BR` | `pt-br` |

Two-letter codes are expanded to `<lang>-<LANG>` using a built-in mapping. Codes already containing a hyphen or underscore are normalised to lowercase.

## Non-locale column names

The following column names are automatically **ignored** (treated as metadata, not locales):

`key` · `keys` · `id` · `identifier` · `name` · `title` · `label` · `description` · `comment` · `note` · `context` · `category` · `type` · `status` · `updated` · `created` · `modified` · `version` · `source` · `i18n` · `translation` · `namespace` · `section`

## Multiple sheets

You can have multiple sheets in one spreadsheet. Pass all the sheet titles you want to process:

```typescript
await getSpreadSheetData(['home', 'products', 'checkout']);
```

A special `i18n` sheet (if it exists) is always included automatically.

## Google Cloud service account setup

Only required for private spreadsheets or when you need write access
(bidirectional sync, auto-translate).

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → enable the **Google Sheets API**
3. Create a **Service Account** → generate a JSON key
4. Extract `client_email` and `private_key` from the JSON key
5. Share your spreadsheet with the service account email (Viewer for pull-only, Editor for sync/push)
