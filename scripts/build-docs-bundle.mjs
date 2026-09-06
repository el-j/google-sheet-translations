#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'website/.vitepress/dist');
const nextDistDir = path.join(distDir, 'next');

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: repoRoot, ...opts });
}

function ensureGitRef(ref) {
  try {
    const branch = ref.replace(/^origin\//, '');
    execSync(`git fetch origin ${branch}:refs/remotes/origin/${branch}`, { stdio: 'ignore', cwd: repoRoot });
  } catch {
    // ignore
  }
}

function resolveGitRef(candidates) {
  for (const ref of candidates) {
    ensureGitRef(ref);
    try {
      execSync(`git rev-parse --verify ${ref}`, { stdio: 'ignore', cwd: repoRoot });
      return ref;
    } catch {
      // ignore
    }
  }
  return null;
}

function getPackageVersion(dir) {
  try {
    const pkgPath = path.join(dir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch {
    return null;
  }
}

async function main() {
  console.log('=== Building Multi-Version Documentation Bundle ===');

  // 1. Build main library code first so data loaders have access to dist/
  if (!fs.existsSync(path.join(repoRoot, 'dist/index.js'))) {
    console.log('[build] Building library package first...');
    run('npm run build');
  }

  // 2. Clean previous build artifact in website/.vitepress/dist
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  const currentPkgVersion = getPackageVersion(repoRoot) || '3.0.0-beta.2';
  const previewVersion = currentPkgVersion.includes('beta') || currentPkgVersion.includes('alpha')
    ? `v${currentPkgVersion}`
    : 'v3.0.0-beta.2';

  const stableRef = resolveGitRef(['origin/main', 'main']);
  let stableBuilt = false;

  if (stableRef) {
    console.log(`[build:stable] Found stable git ref: ${stableRef}`);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gst-docs-stable-'));

    try {
      // Extract stable ref into tmpDir
      execSync(`git archive ${stableRef} | tar -x -C "${tmpDir}"`, { cwd: repoRoot });

      const stableVersion = `v${getPackageVersion(tmpDir) || '2.2.0'}`;
      console.log(`[build:stable] Extracted ${stableRef} (version: ${stableVersion}) to ${tmpDir}`);

      // Link node_modules
      const tmpNodeModules = path.join(tmpDir, 'node_modules');
      if (!fs.existsSync(tmpNodeModules)) {
        try {
          fs.symlinkSync(path.join(repoRoot, 'node_modules'), tmpNodeModules, 'junction');
        } catch {
          // ignore
        }
      }

      // Copy built library dist
      const tmpDist = path.join(tmpDir, 'dist');
      if (!fs.existsSync(tmpDist)) {
        fs.cpSync(path.join(repoRoot, 'dist'), tmpDist, { recursive: true });
      }

      // Overlay updated theme, components, and config.mts so stable docs have the new version dropdown
      const vitepressDir = path.join(tmpDir, 'website/.vitepress');
      fs.mkdirSync(vitepressDir, { recursive: true });
      fs.cpSync(
        path.join(repoRoot, 'website/.vitepress/config.mts'),
        path.join(vitepressDir, 'config.mts'),
      );
      fs.cpSync(
        path.join(repoRoot, 'website/.vitepress/theme'),
        path.join(vitepressDir, 'theme'),
        { recursive: true },
      );

      console.log(`[build:stable] Building stable documentation for base: /google-sheet-translations/...`);
      run('npx vitepress build website', {
        cwd: tmpDir,
        env: {
          ...process.env,
          DOCS_BASE: '/google-sheet-translations/',
          DOCS_OUT_DIR: distDir,
          DOCS_STABLE_VERSION: stableVersion,
          DOCS_PREVIEW_VERSION: previewVersion,
          VITE_CONFIG_NATIVE_IGNORE_WARNING: 'true',
        },
      });

      stableBuilt = true;
      console.log(`[build:stable] Successfully built stable docs into ${distDir}`);
    } catch (err) {
      console.warn('[build:stable] Warning: building from stable ref failed:', err);
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }

  // If stable build was not possible from ref (e.g. shallow clone or offline), build current workspace to distDir
  if (!stableBuilt) {
    console.log('[build:stable] Falling back to building current workspace as root docs...');
    run('npx vitepress build website', {
      cwd: repoRoot,
      env: {
        ...process.env,
        DOCS_BASE: '/google-sheet-translations/',
        DOCS_OUT_DIR: distDir,
        DOCS_STABLE_VERSION: 'v2.2.0',
        DOCS_PREVIEW_VERSION: previewVersion,
        VITE_CONFIG_NATIVE_IGNORE_WARNING: 'true',
      },
    });
  }

  // 3. Build Preview Documentation (develop / v3-beta) into website/.vitepress/dist/next
  console.log(`[build:preview] Building v3-beta preview docs into ${nextDistDir}...`);
  fs.mkdirSync(nextDistDir, { recursive: true });
  run('npx vitepress build website', {
    cwd: repoRoot,
    env: {
      ...process.env,
      DOCS_BASE: '/google-sheet-translations/next/',
      DOCS_ENV: 'preview',
      DOCS_OUT_DIR: nextDistDir,
      DOCS_STABLE_VERSION: 'v2.2.0',
      DOCS_PREVIEW_VERSION: previewVersion,
      VITE_CONFIG_NATIVE_IGNORE_WARNING: 'true',
    },
  });

  // 4. Ensure v2 archive exists at website/.vitepress/dist/v2
  const v2Dist = path.join(distDir, 'v2');
  const previewV2Dist = path.join(nextDistDir, 'v2');
  if (!fs.existsSync(v2Dist) && fs.existsSync(previewV2Dist)) {
    console.log('[build:v2] Copying v2 documentation archive to /google-sheet-translations/v2/');
    fs.cpSync(previewV2Dist, v2Dist, { recursive: true });
  }

  // 5. Preserve historical version folders from _previous_pages (downloaded from gh-pages)
  const prevPagesDir = path.join(repoRoot, '_previous_pages');
  if (fs.existsSync(prevPagesDir)) {
    console.log('[build:archive] Checking for historical versions in _previous_pages...');
    for (const entry of fs.readdirSync(prevPagesDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith('v') && entry.name !== 'v2') {
        const dest = path.join(distDir, entry.name);
        if (!fs.existsSync(dest)) {
          console.log(`[build:archive] Preserving historical version: ${entry.name}`);
          fs.cpSync(path.join(prevPagesDir, entry.name), dest, { recursive: true });
        }
      }
    }
  }

  // 6. Create v2.2 snapshot directory if not present
  const v22Dist = path.join(distDir, 'v2.2');
  if (!fs.existsSync(v22Dist)) {
    console.log('[build:archive] Creating v2.2 snapshot archive directory...');
    fs.mkdirSync(v22Dist, { recursive: true });
    for (const file of fs.readdirSync(distDir)) {
      if (file !== 'next' && file !== 'v2' && file !== 'v2.2' && !file.startsWith('.')) {
        fs.cpSync(path.join(distDir, file), path.join(v22Dist, file), { recursive: true });
      }
    }
  }

  console.log('\n=== Multi-Version Documentation Bundle Built Successfully! ===');
  console.log(`  - Root (Stable v2.2.0):         ${distDir}/index.html`);
  console.log(`  - Next (Preview ${previewVersion}): ${nextDistDir}/index.html`);
  console.log(`  - v2 Archive:                   ${distDir}/v2/index.html`);
  console.log(`  - v2.2 Snapshot:                ${distDir}/v2.2/index.html`);
}

main().catch((err) => {
  console.error('[build] Error building docs bundle:', err);
  process.exit(1);
});
