# Security Policy

## Reporting a Vulnerability

Please report security vulnerabilities by opening a [GitHub Security Advisory](https://github.com/el-j/google-sheet-translations/security/advisories/new) rather than a public issue.

## Production Package Security

The **published npm package** (`@el-j/google-sheet-translations`) has **zero known vulnerabilities** in its production dependency tree:

```bash
npm audit --omit=dev --audit-level=high
# found 0 vulnerabilities
```

Production dependencies (`google-spreadsheet`, `google-auth-library`) are regularly audited as part of CI.

---

## Known Dev-Only Vulnerabilities (Not Fixable)

The following vulnerabilities exist in the **development dependency tree only** and do **not** affect the published package or any end-user. They are excluded from CI audit checks via `--omit=dev`.

### `tar` bundled inside `npm` CLI (HIGH)

| Advisory | Title | Affected range | Status |
|----------|-------|----------------|--------|
| [GHSA-qffp-2rhf-9h96](https://github.com/advisories/GHSA-qffp-2rhf-9h96) | Hardlink Path Traversal via Drive-Relative Linkpath | tar ≤ 7.5.9 | Windows-only, N/A on Linux CI |

**Root cause**: `@semantic-release/npm` depends on `npm` (the CLI). The `npm` CLI lists `tar` as a `bundleDependencies` entry — meaning it ships its own copy of `tar` inside its own tarball. Parent-project overrides in `package.json` **cannot** reach bundled dependencies.

**Fix path**: Requires the `npm` CLI itself to ship `tar@≥7.5.10`. As of npm v11.11.0 the bundled tar is still `7.5.9`. This will be resolved automatically when `npm` publishes an update.

**Risk assessment**: The advisory is Windows-specific (drive-relative paths like `C:foo`). CI runs on `ubuntu-latest`; this path is not reachable.

---

### `minimatch` bundled inside `npm` CLI (HIGH)

| Advisory | Title | Affected range | Status |
|----------|-------|----------------|--------|
| [GHSA-7r86-cg39-jmmj](https://github.com/advisories/GHSA-7r86-cg39-jmmj) | ReDoS via multiple non-adjacent GLOBSTAR segments | minimatch 10.0.0–10.2.2 | Requires attacker-controlled glob patterns |
| [GHSA-23c5-xmqv-rm74](https://github.com/advisories/GHSA-23c5-xmqv-rm74) | ReDoS via nested `*()` extglobs | minimatch 10.0.0–10.2.2 | Requires attacker-controlled glob patterns |

**Root cause**: Same as above — `minimatch@10.2.2` is bundled inside the `npm` CLI's `bundleDependencies`. Not overridable externally.

**Fix path**: Requires `npm` CLI to ship `minimatch@≥10.2.3`. As of npm v11.11.0 it still ships `10.2.2`.

**Risk assessment**: ReDoS requires an attacker to supply malicious glob patterns to `npm`'s internal path matching during CI operations. In a CI environment with no external input to npm's glob engine, this is not exploitable.

---

### `esbuild` / `vite` via `vitepress` (MODERATE)

| Advisory | Title | Affected range | Status |
|----------|-------|----------------|--------|
| [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) | Dev server cross-origin request leak | esbuild ≤ 0.24.2 | Docs dev server only |

**Root cause**: `vitepress@1.6.4` depends on `vite@^5.4.14`, which depends on `esbuild@^0.21.3`. The vulnerability is in esbuild's **development server** (`vite dev` / `vitepress dev`). Production builds (`vitepress build`) are unaffected.

**Fix path**: Requires `vitepress` to ship with `vite@6.x` + `esbuild@≥0.25.0`. VitePress 2.x (which would include this) is still in alpha as of this writing.

**Risk assessment**: CI only runs `vitepress build`. The dev server is never started in CI or production. This vulnerability is only exploitable when a developer runs `npm run docs:dev` on their local machine — and only if a malicious website can reach their local dev server (requires same-machine attack).

---

## CI Audit Configuration

CI (`ci.yml`) runs:
```yaml
- name: Audit production dependencies
  run: npm audit --omit=dev --audit-level=high
```

The release workflow (`release.yml`) also runs this check in the `quality-gate` job before allowing `semantic-release` to publish.

Dependabot is configured (`.github/dependabot.yml`) to monitor direct dependencies weekly but suppress version-update alerts for `tar` and `minimatch` since fixes don't exist yet.
