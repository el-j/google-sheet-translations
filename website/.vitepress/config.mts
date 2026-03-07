import { defineConfig } from 'vitepress'

export default defineConfig({
  title: '@el-j/google-sheet-translations',
  description: 'Fetch, sync and manage translations from Google Spreadsheets with TypeScript. Supports bidirectional sync, auto-translation, and Next.js integration.',

  // GitHub Pages base path
  base: '/google-sheet-translations/',

  // Clean URLs
  cleanUrls: true,

  // Head tags
  head: [
    ['meta', { name: 'theme-color', content: '#0ea5e9' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'en' }],
    ['meta', { name: 'og:title', content: '@el-j/google-sheet-translations' }],
    ['meta', { name: 'og:description', content: 'Fetch, sync and manage translations from Google Spreadsheets with TypeScript' }],
    ['meta', { name: 'og:site_name', content: '@el-j/google-sheet-translations' }],
    ['link', { rel: 'icon', href: '/google-sheet-translations/favicon.ico' }],
  ],

  themeConfig: {
    logo: { src: '/logo.svg', width: 24, height: 24 },

    nav: [
      { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: 'API', link: '/api/', activeMatch: '/api/' },
      {
        text: 'v2.0.0',
        items: [
          { text: 'Changelog', link: '/changelog' },
          { text: 'Contributing', link: '/contributing' },
        ],
      },
      {
        text: 'npm',
        link: 'https://www.npmjs.com/package/@el-j/google-sheet-translations',
        target: '_blank',
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'What is this?', link: '/guide/introduction' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Configuration', link: '/guide/configuration' },
          ],
        },
        {
          text: 'Guides',
          items: [
            { text: 'Bidirectional Sync', link: '/guide/bidirectional-sync' },
            { text: 'Auto-Translation', link: '/guide/auto-translation' },
            { text: 'Public Sheets (No Auth)', link: '/guide/public-sheets' },
            { text: 'Live Demo', link: '/guide/live-demo' },
            { text: 'Next.js Integration', link: '/guide/nextjs' },
            { text: 'Locale Filtering', link: '/guide/locale-filtering' },
          ],
        },
        {
          text: 'Advanced',
          items: [
            { text: 'Spreadsheet Setup', link: '/guide/spreadsheet-setup' },
            { text: 'Environment Variables', link: '/guide/environment-variables' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/' },
            { text: 'getSpreadSheetData', link: '/api/get-spreadsheet-data' },
            { text: 'validateEnv', link: '/api/validate-env' },
            { text: 'Locale Utilities', link: '/api/locale-utilities' },
            { text: 'Types', link: '/api/types' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/el-j/google-sheet-translations' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present el-j',
    },

    editLink: {
      pattern: 'https://github.com/el-j/google-sheet-translations/edit/main/website/:path',
      text: 'Edit this page on GitHub',
    },

    search: {
      provider: 'local',
    },

    lastUpdated: {
      text: 'Last updated',
    },
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark',
    },
  },
})
