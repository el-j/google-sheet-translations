## [2.2.0-beta.1](https://github.com/el-j/google-sheet-translations/compare/v2.1.5-beta.1...v2.2.0-beta.1) (2026-03-29)

### 🚀 Features

* add Drive folder scanner utility ([f5ca785](https://github.com/el-j/google-sheet-translations/commit/f5ca785458a258e1b8b614d0a3b3c63207776299))
* add driveImageSync utility for syncing Drive images to local disk ([23cb96d](https://github.com/el-j/google-sheet-translations/commit/23cb96dbe8b82253939b29ef81d271150af95444))
* add getMultipleSpreadSheetsData for multi-spreadsheet support ([f241bda](https://github.com/el-j/google-sheet-translations/commit/f241bda7a936b819eb7428587584178f16a690b9))
* add manageDriveTranslations orchestrator ([35c0d37](https://github.com/el-j/google-sheet-translations/commit/35c0d37a34cc25d20960f1b5db4bd577e18b4078))
* Google Drive folder management – multi-spreadsheet, folder scanner, image sync, headless CMS orchestrator ([2e917f2](https://github.com/el-j/google-sheet-translations/commit/2e917f22f2dbb3f7bb247064ee2aed3471cf712f))

### 🐛 Bug Fixes

* rebuild dist-action, normalize action inputs to kebab-case, add Drive docs ([f851942](https://github.com/el-j/google-sheet-translations/commit/f8519425cbf99b4afa7b69def5088247ba770aa5))

## [2.1.5-beta.1](https://github.com/el-j/google-sheet-translations/compare/v2.1.4...v2.1.5-beta.1) (2026-03-28)

### 🐛 Bug Fixes

* restore dynamic formula approach with locale-aware separators and zh-TW guard ([4c93b4e](https://github.com/el-j/google-sheet-translations/commit/4c93b4e74affb58a20d5cae32963af45f02fa222))
* use hard-coded GOOGLETRANSLATE language codes instead of broken dynamic extraction ([a5cc95c](https://github.com/el-j/google-sheet-translations/commit/a5cc95ce9f2ea859562a470501253d3b2a32806e))

### 📝 Documentation

* update formula examples and rebuild dist-action bundle ([1a99632](https://github.com/el-j/google-sheet-translations/commit/1a99632bde1d9697ad43cf8236aa8f8e1a3bd998))

## [2.1.4](https://github.com/el-j/google-sheet-translations/compare/v2.1.3...v2.1.4) (2026-03-28)

### 🐛 Bug Fixes

* replace weak SHA-1 createHash with crypto.hash() by upgrading undici to 7.x ([4c3f97d](https://github.com/el-j/google-sheet-translations/commit/4c3f97d0e64793f955dbf93546c33452ebd25bee))

## [2.1.3](https://github.com/el-j/google-sheet-translations/compare/v2.1.2...v2.1.3) (2026-03-14)

### 🐛 Bug Fixes

* proactive rate-limit throttling and GOOGLETRANSLATE language-prefix extraction ([492be83](https://github.com/el-j/google-sheet-translations/commit/492be8335ad555cc1e4130d44d63e75396100b90))

### ♻️ Refactoring

* clarify chunk-delay comment and neutralize test comment per review ([55188b7](https://github.com/el-j/google-sheet-translations/commit/55188b747aa8b4373dfd22133b875599808388e9))

## [2.1.2](https://github.com/el-j/google-sheet-translations/compare/v2.1.1...v2.1.2) (2026-03-14)

### 🐛 Bug Fixes

* auto-create missing sheets on fresh push — bypass CI timestamp trap ([aa6d11b](https://github.com/el-j/google-sheet-translations/commit/aa6d11bd37737c4b983a4ede91eb2335f67d8659))
* close missing describe brace in syncManager.test.ts and remove conflicting codeql.yml ([81e1c89](https://github.com/el-j/google-sheet-translations/commit/81e1c89480db3108732355129171292d796cf15a))
* resolve esbuild Dependabot alert and CodeQL false positive for dist-action ([49efa1d](https://github.com/el-j/google-sheet-translations/commit/49efa1d763d28a63bc3cfabef1aefe6d283c2c24))

## [2.1.1](https://github.com/el-j/google-sheet-translations/compare/v2.1.0...v2.1.1) (2026-03-14)

### 🐛 Bug Fixes

* resolve CodeQL vulnerabilities and update deps ([13699eb](https://github.com/el-j/google-sheet-translations/commit/13699ebc14b78b14eb81f47f7fb893f25ad5b9b3))
* update flatted dep via npm audit fix ([b7697f6](https://github.com/el-j/google-sheet-translations/commit/b7697f6301d36543fd111dd900655e73afeb9986))

## [2.1.0](https://github.com/el-j/google-sheet-translations/compare/v2.0.1...v2.1.0) (2026-03-14)

### 🚀 Features

* add cleanPush option to push all keys regardless of timestamp/diff ([f27e17f](https://github.com/el-j/google-sheet-translations/commit/f27e17fca76111ae1182f2d846022f71fb518f5f))
* add override prop + autoTranslate for existing keys on push ([cc74076](https://github.com/el-j/google-sheet-translations/commit/cc74076894c8781a6a15cf93322a72775a144ede))

### 🐛 Bug Fixes

* address code review – clarify cleanPush description and rowObj comment ([d7c42bc](https://github.com/el-j/google-sheet-translations/commit/d7c42bc2ec181e4d8dc94a717023564450963298))

## [2.0.1](https://github.com/el-j/google-sheet-translations/compare/v2.0.0...v2.0.1) (2026-03-12)

### 🐛 Bug Fixes

* guard i18n sheet from push, fix auto-translate header case, add auto-translate action input ([6ce753b](https://github.com/el-j/google-sheet-translations/commit/6ce753bb1c44ed84904f3fe7e958243241e52928))

## [2.0.0](https://github.com/el-j/google-sheet-translations/compare/v1.4.0...v2.0.0) (2026-03-11)

### ⚠ BREAKING CHANGES

* Package version promoted from 1.4.0 to 2.0.0 to align
with the GitHub Action @v2 tag referenced in documentation. No API
breaking changes; this is a versioning alignment release. Release
workflow now auto-updates the floating v{major} tag after each release.

Co-authored-by: el-j <2795534+el-j@users.noreply.github.com>

### 🚀 Features

* promote package to v2.0.0 for GitHub Action [@v2](https://github.com/v2) alignment ([7b845ac](https://github.com/el-j/google-sheet-translations/commit/7b845ac181175964fc42a3bf4104ca29de016bbf))

## [2.0.0](https://github.com/el-j/google-sheet-translations/compare/v1.4.0...v2.0.0) (2026-03-11)

### ⚠ BREAKING CHANGES

* Package version promoted to 2.0.0 to align with GitHub Action `@v2` tag. No API breaking changes; this is a versioning alignment release.

### 🚀 Features

* promote package to v2.0.0 for GitHub Action `@v2` alignment
* add floating major-version tag (`v2`) automation to release workflow

## [1.4.0](https://github.com/el-j/google-sheet-translations/compare/v1.3.3...v1.4.0) (2026-03-11)

### 🚀 Features

* add TypeScript GitHub Action entry point with tests ([9e3eee7](https://github.com/el-j/google-sheet-translations/commit/9e3eee7c703c07385f41499a70dd32726aa2fa04))
* dual ESM+CJS package build + esbuild ESM action bundle for @actions/core v3 ([674b6f0](https://github.com/el-j/google-sheet-translations/commit/674b6f003a5f394ef3b9a78bfad3249bd27c1e5b))
* export file writers, sync manager, resolveLocaleWithFallback; Vue composable; React hook; Next.js middleware ([42f302c](https://github.com/el-j/google-sheet-translations/commit/42f302c2e2bc0e47d77e47f6a25709ee68684a88))
* extract website translation helpers into package utilities ([c2eed6d](https://github.com/el-j/google-sheet-translations/commit/c2eed6d2dcbab3f68177fa2f5cbbdeae83f59ada))
* ship GitHub Action with node20 runner, ncc bundle, 19 tests + security fixes ([b309e44](https://github.com/el-j/google-sheet-translations/commit/b309e447c16a507697986e6d2e93ec0e220e12ab))

### 🐛 Bug Fixes

* **action:** downgrade @actions/core to v2 to fix ncc bundle build failure ([cdedd6c](https://github.com/el-j/google-sheet-translations/commit/cdedd6c7496f778f4c54bcf4d819c39cb4ff9ed1))
* remove @actions/http-client override causing ERR_MODULE_NOT_FOUND in semantic-release ([b066a07](https://github.com/el-j/google-sheet-translations/commit/b066a0748b3b31c951151f626dcd9739b23b318a))
* remove duplicate tests/basic.test.js to fix Node 22 CI failure ([7904bf9](https://github.com/el-j/google-sheet-translations/commit/7904bf9ae7c06e5f6969006520b797e92ce06e18))
* shorten action.yml description to 116 chars to satisfy GitHub Marketplace 124-char limit ([ce70789](https://github.com/el-j/google-sheet-translations/commit/ce707897f8b5a60a13d5634ed508bd11577e3940))

### ♻️ Refactoring

* **jest:** extract JS transform tsconfig to tsconfig.jest-js.json ([86a427e](https://github.com/el-j/google-sheet-translations/commit/86a427e781f860ce56949e0589eb69a34d5f2a29))

### 📝 Documentation

* address review feedback on GitHub Action section ([2016eee](https://github.com/el-j/google-sheet-translations/commit/2016eee1877d6cceea7bbd6107855bf289cadc0d))
* expand GitHub Action section in README ([191fa25](https://github.com/el-j/google-sheet-translations/commit/191fa25f53a437f25074378b4b3a0113b93f922d))

## [1.3.3](https://github.com/el-j/google-sheet-translations/compare/v1.3.2...v1.3.3) (2026-03-08)

### 🐛 Bug Fixes

* locale-family resolution so translations are pushed when locale codes don't match exactly ([aebf7d6](https://github.com/el-j/google-sheet-translations/commit/aebf7d6c64bc3a2c76d6c4458774924d73903e7e))
* map ui.en.json to ui sheet; auto-create missing sheets; show locale names in LangSwitcher ([8654f27](https://github.com/el-j/google-sheet-translations/commit/8654f27b545d1244fb75dd6708cf8232da3ecf80))

## [1.3.2](https://github.com/el-j/google-sheet-translations/compare/v1.3.1...v1.3.2) (2026-03-08)

### 🐛 Bug Fixes

* use correct secret names and production environment in docs.yml ([091d349](https://github.com/el-j/google-sheet-translations/commit/091d3493950589216ff4e60b499fcc196904a386))

## [1.3.1](https://github.com/el-j/google-sheet-translations/compare/v1.3.0...v1.3.1) (2026-03-08)

### 🐛 Bug Fixes

* docs version from post-release package.json via workflow_run; fix sync case-sensitivity bug ([d716fe2](https://github.com/el-j/google-sheet-translations/commit/d716fe216d2aa38b0ea665ad10f65c8106b848af))

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
