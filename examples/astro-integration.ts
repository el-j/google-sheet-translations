// @ts-nocheck
// A small local Astro integration that refreshes translation files before
// `astro dev` / `astro build` run. See website/guide/astro.md for the full
// walkthrough (including npm-script and runtime-read alternatives).
//
// Usage in astro.config.mjs:
//   import { translationsSync } from './examples/astro-integration';
//   export default defineConfig({ integrations: [translationsSync()] });

export function translationsSync() {
  return {
    name: 'translations-sync',
    hooks: {
      'astro:config:setup': async ({ logger, command }) => {
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
