## [1.3.0](https://github.com/el-j/google-sheet-translations/compare/v1.2.0...v1.3.0) (2026-03-08)

### 🚀 Features

* sync docs translations to spreadsheet + multilingual live-demo page ([907f76b](https://github.com/el-j/google-sheet-translations/commit/907f76bd024afbbeff9b73002cb4767c4ecc1490))

### 🐛 Bug Fixes

* add headers=1 to gviz URL so col.label is always populated (fixes Node 22 integration test) ([7255402](https://github.com/el-j/google-sheet-translations/commit/7255402f879778e1c35ba3983c051d4a22879b62))
* sync docs version with package.json and fix demo spreadsheet sheet names ([2ef0b9b](https://github.com/el-j/google-sheet-translations/commit/2ef0b9b1c244161fe46ab7ca53c6350ca39bd089))

## [1.2.0](https://github.com/el-j/google-sheet-translations/compare/v1.1.0...v1.2.0) (2026-03-07)

### 🚀 Features

* add integration test suite, exclude from normal runs, write v1.1.0 audit ([cebc378](https://github.com/el-j/google-sheet-translations/commit/cebc37820f07ae9a43907f99e4ecc7d5261db6db))
* CI integration test gate, audit doc, type-safety fixes, 171 tests ([7bd5ba5](https://github.com/el-j/google-sheet-translations/commit/7bd5ba5bf7c22944ac31f7a44ab7176e1e61bf7a))
* update demo spreadsheet ID, add VitePress integration, and auto-create spreadsheet ([7631f10](https://github.com/el-j/google-sheet-translations/commit/7631f10f8fd20c2236c039c6fbee9b200453cffb))

### 🐛 Bug Fixes

* address code review - non-greedy regex, readable colLetter, rateLimiter comment ([79467df](https://github.com/el-j/google-sheet-translations/commit/79467df3e1c83f4b7d83a95bc099a5fb67d8d4f2))
* gitignore website/public/translations/ (auto-generated at docs build time) ([df1da6e](https://github.com/el-j/google-sheet-translations/commit/df1da6e4e75ea03ecb046c17d588e6ce55afbf4a))
* npm audit --omit=dev to skip devDependency vulnerabilities in CI ([af33c49](https://github.com/el-j/google-sheet-translations/commit/af33c49c506482675c7853e67ce8a5c148ff3e95))
* reindent getSpreadSheetData.ts and improve CI/docs workflows ([2c508b2](https://github.com/el-j/google-sheet-translations/commit/2c508b26b62f9e493fd77643326056071b63a659))
* remove timer unref to prevent exit code 13; add GitHub Action ([e71d603](https://github.com/el-j/google-sheet-translations/commit/e71d60347134894f0eb3b7b5d7480aa0eadbf5a9))
* update Jest CLI to use --testPathPatterns and enable integration tests ([d3117fd](https://github.com/el-j/google-sheet-translations/commit/d3117fd30ad48f6dcc7d79ee26b4514d8c4f672a))

## [1.1.0](https://github.com/el-j/google-sheet-translations/compare/v1.0.2...v1.1.0) (2026-03-07)

### 🚀 Features

* unauthenticated public sheet access + demo spreadsheet docs ([9ee0831](https://github.com/el-j/google-sheet-translations/commit/9ee0831497050c2f7ea9b6cf104834936973d85e))

## [1.0.2](https://github.com/el-j/google-sheet-translations/compare/v1.0.1...v1.0.2) (2026-03-07)

### 🐛 Bug Fixes

* normalize GOOGLE_PRIVATE_KEY newlines to resolve ERR_OSSL_UNSUPPORTED in CI ([ead2716](https://github.com/el-j/google-sheet-translations/commit/ead27161fc661051298c4935ef1e8bbcba077fd4))

## [1.0.1](https://github.com/el-j/google-sheet-translations/compare/v1.0.0...v1.0.1) (2026-03-07)

### 🐛 Bug Fixes

* add ESM export conditions to package.json (fixes "No exports main defined" for .mjs consumers) ([893a9b9](https://github.com/el-j/google-sheet-translations/commit/893a9b9cb2d73c42ba278cecf8df01e919cccd20))

## 1.0.0 (2026-03-07)

### 🚀 Features

* add comprehensive package audit document for @el-j/google-sheet-translations ([1362e7c](https://github.com/el-j/google-sheet-translations/commit/1362e7c72324a7ead9fdbae0594158eb6658750c))
* add orchestrator manifest and agent definitions ([5cab7e0](https://github.com/el-j/google-sheet-translations/commit/5cab7e08df690f25e16358f966a43d8cf58c7388))
* add semantic-release pipeline, VitePress docs site, and GitHub Pages workflow ([f402c09](https://github.com/el-j/google-sheet-translations/commit/f402c090fcbec899cae8182a1d3c6941194677f1))
* **api:** trim index.ts to clean public API for v2.0.0 ([3bc51cb](https://github.com/el-j/google-sheet-translations/commit/3bc51cbfaf38da17213c51845db8b534f9ffa01d))
* **docs:** add VitePress documentation site and GitHub Pages deployment ([ce08a15](https://github.com/el-j/google-sheet-translations/commit/ce08a15039969808e2d165de7409eb11115ca586))
* Enhance locale handling and spreadsheet synchronization ([7025928](https://github.com/el-j/google-sheet-translations/commit/7025928f012dc11347d9f7312e253d4f339272b8))
* **lint:** add ESLint + TypeScript plugin, fix all violations in src/ ([9997723](https://github.com/el-j/google-sheet-translations/commit/9997723ee189360215a456e70a49aed1039df619))
* **release:** add semantic-release pipeline with conventional commits ([1164fd7](https://github.com/el-j/google-sheet-translations/commit/1164fd7e28d0d3b005e015db598d4a6a826869c5))

### 🐛 Bug Fixes

* **ci:** add explicit permissions block to CI test job ([77081b9](https://github.com/el-j/google-sheet-translations/commit/77081b9e71cd023ece86bca54f0c3103db962510))
* **config:** strict tsconfig, exports field, coverage thresholds, version 2.0.0 ([211fb45](https://github.com/el-j/google-sheet-translations/commit/211fb45c41ba8521e3e21addc944ac304f8f5c92))
* correct repository field in orchestrator.json to el-j/google-sheet-translations ([51f247b](https://github.com/el-j/google-sheet-translations/commit/51f247b94a768c091bc54189223ba6515a2795e5))
* **deps:** add missing conventional-changelog-conventionalcommits dependency ([19e0e88](https://github.com/el-j/google-sheet-translations/commit/19e0e88e0aa9b4a2cd3326c38a31dc75872f573c))
* **localeNormalizer:** explicit return type, empty-string early-return, [@public](https://github.com/public) tag ([4d7576f](https://github.com/el-j/google-sheet-translations/commit/4d7576f77ce27a79f9b2f03f3bbdea23b388e3bf))
* reduce default wait time between API calls from 5 to 1 second ([8e36c5e](https://github.com/el-j/google-sheet-translations/commit/8e36c5e24b1d022dd97ff3ce4c798f4708d632bc))
* **release:** address code review feedback ([5359164](https://github.com/el-j/google-sheet-translations/commit/53591646ac78688cfbf643a5b855ca487a65210d))
* **security:** sanitize locale filename and wrap file I/O in try/catch ([f7859fe](https://github.com/el-j/google-sheet-translations/commit/f7859fea6120bff47b2584c29176e5c2472712a4))
* update Node.js versions in CI workflows for semantic-release compatibility ([53a5f24](https://github.com/el-j/google-sheet-translations/commit/53a5f24c4dad2e43e81bd2d30ceb04b8f93f706b))

### 📝 Documentation

* update audit with v2.0.0 resolution status ([91a38e5](https://github.com/el-j/google-sheet-translations/commit/91a38e562ab14a34e99217d642c36f16d12a8c7e))

# Changelog

All notable changes to `@el-j/google-sheet-translations` will be documented in this file.

This file is auto-generated by [semantic-release](https://semantic-release.gitbook.io/). Do not edit manually.

<!-- semantic-release will prepend new entries above this line -->
