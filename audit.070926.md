# Comprehensive Code Audit — `@el-j/google-sheet-translations` v3.0.0-beta.7

> Audit date: 2026-09-07 · Auditor: Antigravity  
> Definition of done: 100% coverage, no gaps/stubs, 100% in-code docs, 100% e2e tested, 100% mutation tested, no warnings, no type issues.

---

## Executive Summary

| Category | Status |
|---|---|
| Unit test coverage | ⚠️ **~82–93%** (target: 100%) |
| Branch coverage | ❌ **~71–83%** (target: 100%) |
| E2E / integration coverage | ⚠️ Partial — 5 files, key flows missing |
| Mutation testing | ❌ **Not set up at all** |
| In-code documentation | ⚠️ Mostly good, several gaps |
| Type safety | ✅ Zero TypeScript errors |
| Lint warnings | ✅ Zero oxlint warnings |
| Stub / placeholder code | ⚠️ 3 clear stubs found |
| Unlinked features | ⚠️ Several barrel-file exports disconnected from tests |
| TODOs / outstanding work | ⚠️ Several implicit TODOs in comments |
| Boss files (oversized) | ✅ None — largest file is 483 lines |

---

## 1. Coverage Gaps

### 1.1 Worst offenders (by branch coverage)

| File | Statements | Branches | Functions | Issue |
|---|---|---|---|---|
| [`netflux.ts`](file:///Users/rex-fab-alt/Documents/private/google-sheet-translations/src/providers/cryptpad/netflux.ts) | 55.6% | 47.9% | 45% | `broadcastChannelMessage` almost entirely untested |
| [`runtime.ts`](file:///Users/rex-fab-alt/Documents/private/google-sheet-translations/src/providers/runtime.ts) | 92.5% | **54%** | 100% | `cryptpad-workspace` output/sync factory branches never exercised |
| [`fullProvider.ts`](file:///Users/rex-fab-alt/Documents/private/google-sheet-translations/src/providers/cryptpad/fullProvider.ts) | 80% | 75% | 80% | Lines 84, 90–107: `readSnapshot` error path + entire `readSnapshot` impl |
| [`sheetParser.ts`](file:///Users/rex-fab-alt/Documents/private/google-sheet-translations/src/providers/cryptpad/sheetParser.ts) | 92.1% | 73.8% | 100% | Lines 70–78 (`buildCellRef` sheet-prefix branch), line 268 (`groupCellsBySheet` fallback) |
| [`provider.ts`](file:///Users/rex-fab-alt/Documents/private/google-sheet-translations/src/providers/cryptpad/provider.ts) | 81.5% | 83.9% | 90% | Lines 46–50 (HTTP error path in `fetchCsv`), line 93 (no-sources guard) |
| [`migrateV3.ts`](file:///Users/rex-fab-alt/Documents/private/google-sheet-translations/src/migration/migrateV3.ts) | 89.9% | **74.5%** | 100% | Lines 317, 340, 443, 452: `parityCheck` + workflow rewrite edge cases |
| [`syncEngine.ts`](file:///Users/rex-fab-alt/Documents/private/google-sheet-translations/src/providers/syncEngine.ts) | 93.2% | 82.6% | 93.8% | Lines 181, 185, 189, 266: conflict resolution edge cases not covered |

### 1.2 Files with 0% coverage (barrel/re-export only, intentionally excluded)

These appear in the coverage report as "0%". They are pure re-export barrels and should **stay excluded** — but they are noted here because any logic added to them will be invisible to tests:

- `src/providers/cryptpad/index.ts`
- `src/providers/index.ts`
- `src/index.ts` (partial exclusion via vitest config)
- `src/providers/contracts.ts` (type-only, correct to exclude)
- `src/providers/assetContracts.ts` (type-only, correct)

---

## 2. Missing Dedicated Test Files

Five CryptPad source modules have no own test file. They're partially exercised through integration, but have zero isolated unit tests:

| Source file | Test file | Coverage via |
|---|---|---|
| [`crypto.ts`](file:///Users/rex-fab-alt/Documents/private/google-sheet-translations/src/providers/cryptpad/crypto.ts) | ❌ None | Indirect via `netflux.test.ts` |
| [`client.ts`](file:///Users/rex-fab-alt/Documents/private/google-sheet-translations/src/providers/cryptpad/client.ts) | ❌ None (`clientDirect.test.ts` covers only 2 methods) | `clientDirect.test.ts` |
| [`sheetParser.ts`](file:///Users/rex-fab-alt/Documents/private/google-sheet-translations/src/providers/cryptpad/sheetParser.ts) | ❌ None | `sheetProvider.test.ts` partially |
| [`driveCatalogProvider.ts`](file:///Users/rex-fab-alt/Documents/private/google-sheet-translations/src/providers/cryptpad/driveCatalogProvider.ts) | ❌ None | Not tested at all |
| `index.ts` files | Barrel only — acceptable |

### Specific missing test cases

- **`crypto.ts`**: `parsePadUrl` error branch (bad URL format), `deriveCryptPadKeys` with and without password, `decryptCryptPadPayload` bad nonce, `encryptCryptPadPayload` roundtrip.
- **`netflux.ts`**: `broadcastChannelMessage` happy path, timeout-before-send path (line 208), signal abort path. `fetchChannelHistory` timeout path (line 90–95), abort path.
- **`client.ts`**: `initializeRtChannel` — **zero tests** for the newly added method. `fetchSheetData` with and without RT channel. `writeSheetRows` with `override=true` vs `false`.
- **`driveCatalogProvider.ts`**: entire provider is untested.
- **`sheetParser.ts`**: `buildCellRef` with sheet prefix, `groupCellsBySheet` fallback (line 268), `parseOnlyOfficeChanges` Case B (binary coordinates, lines 139–153).

---

## 3. Stub / Placeholder Code

### 3.1 `authToken` in `fullProvider.ts` — dead parameter

[`fullProvider.ts:28`](file:///Users/rex-fab-alt/Documents/private/google-sheet-translations/src/providers/cryptpad/fullProvider.ts#L28-L46)

```ts
/** Optional authentication token for future remote write-back endpoints. */
authToken?: string;
```

`authToken` is passed through `readSnapshot` and `writeSnapshot` but the **default dep implementations completely ignore it**. It is described as "for future remote write-back endpoints" — this is a stub. Either implement it or remove it.

### 3.2 `console.log` in `client.ts` — not a proper logger

[`client.ts:213-217`](file:///Users/rex-fab-alt/Documents/private/google-sheet-translations/src/providers/cryptpad/client.ts#L213-L217)

```ts
console.log('No OnlyOffice RT channel found. Initializing headlessly...');
console.log(`RT channel initialized: ${rtChannel}`);
```

The entire library uses no structured logger. These `console.log` calls in a library method are inappropriate — they'll pollute users' stdout with no way to suppress them. Should use a debug-level logger or emit via an optional `onProgress` callback.

### 3.3 `CryptPadWorkspaceProviderOptions.authToken` comment says "future"

This was documented as a forward-looking feature but never implemented. The option exists in the public API surface, misleading callers into thinking it does something.

---

## 4. Unlinked / Unexercised Features

### 4.1 `initializeRtChannel()` — brand new, zero tests

The [`initializeRtChannel`](file:///Users/rex-fab-alt/Documents/private/google-sheet-translations/src/providers/cryptpad/client.ts#L99-L126) method added today is:
- Not covered by any unit test
- Not covered by any integration test
- The protocol envelope format (`[1, [[0, 0, jsonStr]]]`) is **reverse-engineered** and unverified — if CryptPad updates its metadata format this will silently break

### 4.2 `driveCatalogProvider.ts` — fully untested end-to-end

The [`createCryptPadDriveCatalogProvider`](file:///Users/rex-fab-alt/Documents/private/google-sheet-translations/src/providers/cryptpad/driveCatalogProvider.ts) is exported in the public API but has no test at all. Not even a smoke test.

### 4.3 Asset sync provider — no e2e test path

[`assetProvider.ts`](file:///Users/rex-fab-alt/Documents/private/google-sheet-translations/src/providers/cryptpad/assetProvider.ts) has unit tests but no integration test that exercises a real CryptPad drive. The `driveUrl`-backed code path (vs manifest-backed) is only lightly tested.

### 4.4 `gst-cryptpad drive-scan` command — no integration test

The `drive-scan` command in [`cryptpadCli.ts`](file:///Users/rex-fab-alt/Documents/private/google-sheet-translations/src/setup/cryptpadCli.ts) is excluded from coverage (CLI files are excluded) and has **no integration test** in `tests/integration/`. The `inspect`, `pull`, `push`, `sync` commands also have no integration tests.

### 4.5 Multi-sheet CryptPad push — only single-sheet tested

`writeSheetRows` supports multiple sheets but the integration test only confirms a single `i18n` sheet was written. Multi-sheet roundtrip is unverified.

---

## 5. Documentation Gaps

### 5.1 Missing JSDoc — `client.ts` new method

`initializeRtChannel()` has a good JSDoc, but these are missing:
- No `@param` / `@returns` tags on any method in `client.ts`
- `getKeys()`, `getWebsocketUrl()`, `fetchSheetRows()` have no JSDoc at all

### 5.2 `netflux.ts` — `broadcastChannelMessage` partially documented

The 350ms `setTimeout` delay before closing is undocumented (why 350ms? what happens if it's too short?). The `sent` flag logic and why `resolve()` is called inside a `setTimeout` is not explained.

### 5.3 `sheetParser.ts` — binary format completely undocumented

The OnlyOffice binary parsing in `parseOnlyOfficeChanges` (lines 110–155) has in-code comments but **no link to any CryptPad/OnlyOffice spec, no reference to the source protocol, no explanation of why `0x08` is the marker or what `asc_1;` prefix means**. If this breaks, nobody will know how to fix it without hours of reverse engineering.

### 5.4 `initializeRtChannel` envelope format is undocumented

The metadata patch envelope:
```ts
JSON.stringify([1, [[0, 0, innerJson]]])
```
Has no comment explaining what `1`, `[[0, 0, ...]]` means in the Netflux/CryptPad protocol. Critical knowledge for maintenance.

### 5.5 `fullProvider.ts` — `buildSyncInput` has no JSDoc

The function is non-obvious (falls back from `metadata.baseTranslations` to `remoteTranslations`) and needs explanation.

---

## 6. Missing E2E Integration Tests

Current integration tests (`tests/integration/`):

| Test file | What it covers |
|---|---|
| `actionBundle.integration.test.ts` | Action bundle failure modes |
| `cli.integration.test.ts` | `gst-setup-wif` help/missing-args |
| `migrateV3Cli.integration.test.ts` | `gst-migrate-v3` migration workflow |
| `providerCli.integration.test.ts` | `gst-run-provider` help |
| `publicSheet.integration.test.ts` | Google Sheets public read |

**Completely absent E2E tests:**

- ❌ `gst-cryptpad push` — no e2e test (just ran it manually)
- ❌ `gst-cryptpad pull` — no e2e test
- ❌ `gst-cryptpad sync` — no e2e test
- ❌ `gst-cryptpad inspect` — no e2e test
- ❌ `gst-cryptpad drive-scan` — no e2e test
- ❌ `gst-run-provider` with a real CryptPad provider config — no e2e
- ❌ `initializeRtChannel` round-trip: push to new sheet → inspect → verify RT channel created
- ❌ Multi-sheet push+pull round-trip

---

## 7. Mutation Testing — Not Set Up

**Zero mutation testing infrastructure exists.** No Stryker, no Vitest mutation plugin. Without mutation testing, branch coverage numbers are unreliable — a test can "cover" a line without actually asserting the correct output.

Critical areas that need mutation testing first:
1. `syncEngine.ts` — conflict resolution logic
2. `sheetParser.ts` — binary encoding/decoding
3. `crypto.ts` — key derivation, nonce generation
4. `fullProvider.ts` — revision guard, merge logic

---

## 8. Outstanding / Implicit TODOs

| Location | Description |
|---|---|
| `fullProvider.ts:28` | `authToken` — "for future remote write-back endpoints" (never implemented) |
| `netflux.ts:244` | `// Brief delay to ensure frame is flushed to socket before closing` — magic 350ms, unverified |
| `client.ts:220` | 800ms pause after RT init — empirical, not documented or tested for adequacy |
| `sheetParser.ts:137–138` | `// Case B: binary range coordinates` — only partially implemented, never fully verified |
| `provider.ts:83–84` | `fullProvider.ts` `authToken` is passed to deps but ignored |
| `sheetOutputProvider.ts:13` | `keyColumnName` option defaults to `'key'` but `writeSheetRows` defaults to `'var'` — **inconsistency** between two layers |

---

## 9. API Inconsistencies / Type Issues

### 9.1 `keyColumnName` default mismatch

[`sheetOutputProvider.ts`](file:///Users/rex-fab-alt/Documents/private/google-sheet-translations/src/providers/cryptpad/sheetOutputProvider.ts) defaults `keyColumnName` to `'key'`, while [`client.ts writeSheetRows`](file:///Users/rex-fab-alt/Documents/private/google-sheet-translations/src/providers/cryptpad/client.ts#L209-L218) auto-detects `'var'` or `'key'` from existing rows. When pushing to an empty sheet, the header will say `key` but `writeSheetRows` may detect `var`. A round-trip can produce inconsistent column headers.

### 9.2 `initializeRtChannel` not exported in barrel

`CryptPadClient.initializeRtChannel()` is a public method (no `private`) but is **not mentioned in any documentation** and was not intentionally designed as a public API endpoint. Either mark it `private` or document it as public API in `index.ts` exports.

---

## 10. Code Warnings (Non-lint)

TypeScript strict compile: ✅ zero errors  
oxlint: ✅ zero warnings  

However, `console.log` in library code (`client.ts:213-217`) is a **silent correctness issue**, not caught by the current linter config because `no-console` is not enabled in `.oxlintrc.json`.

---

## Priority Matrix

| Priority | Item | Effort |
|---|---|---|
| 🔴 Critical | Add `crypto.ts` dedicated test file (key derivation coverage) | Small |
| 🔴 Critical | Add `netflux.ts` `broadcastChannelMessage` tests (only 45% fn coverage) | Medium |
| 🔴 Critical | Add `initializeRtChannel` unit test + integration e2e test | Small |
| 🔴 Critical | Remove/implement `authToken` stub in `fullProvider.ts` | Small |
| 🔴 Critical | Fix `keyColumnName` default mismatch between `sheetOutputProvider` and `client` | Small |
| 🟠 High | Add `driveCatalogProvider.ts` tests | Medium |
| 🟠 High | Add `sheetParser.ts` dedicated tests (binary encoding, edge cases) | Medium |
| 🟠 High | Add e2e integration tests for all `gst-cryptpad` subcommands | Large |
| 🟠 High | Add `no-console` rule to `.oxlintrc.json` and replace `console.log` in `client.ts` | Small |
| 🟡 Medium | Set up Stryker mutation testing (at minimum for `syncEngine`, `crypto`, `sheetParser`) | Large |
| 🟡 Medium | Document binary format in `sheetParser.ts` with links to CryptPad protocol | Small |
| 🟡 Medium | Document `initializeRtChannel` envelope format with protocol reference | Small |
| 🟡 Medium | Cover `runtime.ts` `cryptpad-workspace` factory branches | Small |
| 🟡 Medium | Cover `migrateV3.ts` branch gaps (74.5% branch coverage) | Medium |
| 🟢 Low | Cover `fullProvider.ts` `readSnapshot` ENOENT error path | Small |
| 🟢 Low | Add `@param`/`@returns` JSDoc to `client.ts` methods | Small |
| 🟢 Low | Mark `initializeRtChannel` explicitly as `public` or `private` | Small |
