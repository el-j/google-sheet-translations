#!/usr/bin/env node
// Copies the repo-level README and LICENSE into the package being packed
// (run from the package directory via its `prepack` script) so npm ships them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const file of ['README.md', 'LICENSE']) {
  fs.copyFileSync(path.join(repoRoot, file), path.join(process.cwd(), file));
}
