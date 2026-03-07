# Next.js Integration

The package integrates cleanly with **Next.js App Router** via the built-in `instrumentation.ts` hook — ideal for pre-fetching translations at **build time** in `next build` + `output: 'export'` workflows.

## Setup

### 1. Install the package

```bash
npm install @el-j/google-sheet-translations
```

### 2. Enable instrumentation in `next.config.ts`

```typescript
// next.config.ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  experimental: {
    instrumentationHook: true, // required for Next.js < 15
  },
  output: 'export', // for static export
};

export default config;
```

> [!NOTE]
> In Next.js 15+ the instrumentation hook is enabled by default.

### 3. Create `instrumentation.ts`

```typescript
// src/instrumentation.ts  (or instrumentation.ts at the project root)
export async function register() {
  // Only run on Node.js runtime — not in the Edge runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getSpreadSheetData } = await import('@el-j/google-sheet-translations');

    await getSpreadSheetData(['home', 'common', 'products'], {
      translationsOutputDir: './public/translations',
      localesOutputPath: './src/i18n/locales.ts',
      dataJsonPath: './src/lib/languageData.json',
      waitSeconds: 2,
    });

    console.log('[i18n] Translation files written');
  }
}
```

### 4. Use the locale list in your app

```typescript
// src/i18n/config.ts
import { locales } from './locales'; // auto-generated

export { locales };
export const defaultLocale = 'en-GB';
```

## Read translations at runtime

Load the generated JSON files using Node.js `fs` or Next.js's own fetch:

```typescript
// src/lib/getTranslations.ts
import fs from 'node:fs';
import path from 'node:path';

export function getTranslations(locale: string) {
  const file = path.join(process.cwd(), 'public/translations', `${locale}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, string>;
}
```

## Internationalization routing

See the [Next.js i18n routing docs](https://nextjs.org/docs/app/building-your-application/routing/internationalization) for setting up locale-based routing.
