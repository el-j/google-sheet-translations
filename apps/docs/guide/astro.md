# Astro Integration

The package is a **build-time data fetcher** — it doesn't need any framework-specific
code to work with Astro. It writes plain JSON/TypeScript files to disk (translations,
`locales.ts`, `languageData.json`); Astro (via Vite) imports those like any other
static asset. This guide covers two ways to trigger that fetch — a plain npm script,
or a small native Astro integration for nicer DX — plus how to read the generated
files at build time and at runtime, including Astro's built-in i18n routing.

## Setup

::: code-group

```bash [npm]
npm install @el-j/google-sheet-translations
```

```bash [pnpm]
pnpm add @el-j/google-sheet-translations
```

:::

## Option A — npm script (simplest)

Run the fetch as a `predev`/`prebuild` step, same as any other codegen step in an
Astro project:

```json
// package.json
{
  "scripts": {
    "predev": "gst-run-provider pull --sheet-titles=home,common,products",
    "prebuild": "gst-run-provider pull --sheet-titles=home,common,products",
    "dev": "astro dev",
    "build": "astro build"
  }
}
```

Or call the programmatic API from a standalone script (`scripts/fetch-translations.mjs`)
if you need more control (public sheet, CryptPad, auto-translate, etc. — see
[Getting Started](/guide/getting-started) and [Non-Google Providers](/guide/non-google-providers)):

```typescript
// scripts/fetch-translations.mjs
import { getSpreadSheetData } from '@el-j/google-sheet-translations';

await getSpreadSheetData(['home', 'common', 'products'], {
  translationsOutputDir: './src/i18n/translations',
  localesOutputPath: './src/i18n/locales.ts',
  dataJsonPath: './src/lib/languageData.json',
  waitSeconds: 2,
});

console.log('[i18n] Translation files written');
```

```json
// package.json
{
  "scripts": {
    "predev": "node scripts/fetch-translations.mjs",
    "prebuild": "node scripts/fetch-translations.mjs"
  }
}
```

This is enough for most projects — no Astro-specific tooling is actually necessary,
since Astro (via Vite) will happily import the generated `.json`/`.ts` files like
any other module.

## Option B — a small native Astro integration

If you'd rather the fetch run automatically as part of `astro dev` / `astro build`
(no separate npm lifecycle script to remember), write a tiny local
[Astro integration](https://docs.astro.build/en/reference/integrations-reference/)
that hooks into `astro:config:setup` — it runs once, in Node, before Astro reads
anything that might depend on the generated files:

```typescript
// integrations/translations.ts
import type { AstroIntegration } from 'astro';

export function translationsSync(): AstroIntegration {
  return {
    name: 'translations-sync',
    hooks: {
      'astro:config:setup': async ({ logger, command }) => {
        // Skip on `astro preview` — only refresh on `dev`/`build`
        if (command === 'preview') return;

        const { getSpreadSheetData } = await import('@el-j/google-sheet-translations');

        await getSpreadSheetData(['home', 'common', 'products'], {
          translationsOutputDir: './src/i18n/translations',
          localesOutputPath: './src/i18n/locales.ts',
          dataJsonPath: './src/lib/languageData.json',
          waitSeconds: 2,
        });

        logger.info('Translation files written');
      },
    },
  };
}
```

```typescript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import { translationsSync } from './integrations/translations';

export default defineConfig({
  integrations: [translationsSync()],
});
```

> [!TIP]
> For CryptPad instead of Google Sheets, swap the dynamic import for
> `createCryptPadSheetInputProvider` / `runProviderPipeline` — see
> [Non-Google Providers](/guide/non-google-providers) and the
> [Provider Runtime Architecture](/guide/provider-runtime) guide.

## Astro's built-in i18n routing

Astro has native [i18n routing](https://docs.astro.build/en/guides/internationalization/)
config. Feed it directly from the generated `locales.ts`:

```typescript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import { locales } from './src/i18n/locales'; // auto-generated

export default defineConfig({
  i18n: {
    defaultLocale: 'en-GB',
    locales: locales.map((l) => l.toLowerCase()),
    routing: { prefixDefaultLocale: false },
  },
});
```

## Reading translations

### At build time (`.astro` frontmatter)

Vite (and therefore Astro) imports JSON natively:

```astro
---
// src/pages/[locale]/index.astro
import en from '../../i18n/translations/en.json';
import de from '../../i18n/translations/de.json';

const translations = { en, de } as const;
const { locale } = Astro.params;
const t = translations[locale as keyof typeof translations] ?? translations.en;
---

<h1>{t['welcome']}</h1>
```

### Dynamically, across all locales

For a locale count that isn't fixed at authoring time, use Vite's `import.meta.glob`:

```typescript
// src/i18n/getTranslations.ts
const modules = import.meta.glob<{ default: Record<string, string> }>(
  './translations/*.json',
  { eager: true },
);

const translations: Record<string, Record<string, string>> = {};
for (const [path, mod] of Object.entries(modules)) {
  const locale = path.match(/([^/]+)\.json$/)?.[1];
  if (locale) translations[locale] = mod.default;
}

export function getTranslations(locale: string) {
  return translations[locale] ?? translations['en'];
}
```

```astro
---
// src/pages/[locale]/index.astro
import { getTranslations } from '../../i18n/getTranslations';
const t = getTranslations(Astro.params.locale ?? 'en');
---

<h1>{t['welcome']}</h1>
```

### At runtime (SSR endpoints / islands)

The same `getTranslations()` helper works in an Astro API route or a server-rendered
page when using [SSR mode](https://docs.astro.build/en/guides/on-demand-rendering/)
— the JSON files are bundled at build time either way, so there's no extra runtime
fetch or dependency on the original spreadsheet.
