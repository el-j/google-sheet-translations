import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

// 1. Patch @stryker-mutator/core ts-config-preprocessor.js for TS 7 compatibility
const tsConfigPreprocessorPath = path.join(
  root,
  'node_modules/@stryker-mutator/core/dist/src/sandbox/ts-config-preprocessor.js',
);

if (fs.existsSync(tsConfigPreprocessorPath)) {
  let content = fs.readFileSync(tsConfigPreprocessorPath, 'utf8');
  if (!content.includes('ts.parseConfigFileTextToJson ||')) {
    content = content.replace(
      /const \{ config, error \} = ts\.parseConfigFileTextToJson\(/g,
      'const parseFn = ts.parseConfigFileTextToJson || ((_, text) => ({ config: JSON.parse(text) }));\n    const { config, error } = parseFn(',
    );
    fs.writeFileSync(tsConfigPreprocessorPath, content, 'utf8');
    console.log('Patched @stryker-mutator/core for TypeScript 7 compatibility.');
  }
}

// 2. Patch @stryker-mutator/vitest-runner stryker-setup.js for dynamic Vitest 5 worker evaluation
const strykerSetupPath = path.join(
  root,
  'node_modules/@stryker-mutator/vitest-runner/dist/src/stryker-setup.js',
);

if (fs.existsSync(path.dirname(strykerSetupPath))) {
  const content = fs.existsSync(strykerSetupPath) ? fs.readFileSync(strykerSetupPath, 'utf8') : '';
  if (!content.includes('// Patched for dynamic Vitest 5 evaluation')) {
    const dynamicSetup = `import { beforeEach, afterAll, beforeAll, afterEach, inject } from 'vitest';
// Patched for dynamic Vitest 5 evaluation
const globalNamespace = inject('globalNamespace') || '__stryker__';
const ns = globalThis[globalNamespace] || (globalThis[globalNamespace] = {});

beforeAll(() => {
    const mode = inject('mode');
    ns.hitLimit = inject('hitLimit');
    if (mode === 'mutant') {
        ns.hitCount = 0;
        ns.activeMutant = inject('activeMutant');
    }
});

beforeEach(({ task }) => {
    const mode = inject('mode');
    if (mode === 'mutant') {
        ns.activeMutant = inject('activeMutant');
    } else {
        ns.activeMutant = undefined;
        ns.currentTestId = toRawTestId(task);
    }
});

afterEach(() => {
    ns.currentTestId = undefined;
});

afterAll(({}, suite) => {
    const mode = inject('mode');
    const targets = [suite?.meta, suite?.file?.meta].filter(Boolean);
    for (const target of targets) {
        if (mode === 'mutant') {
            target.hitCount = ns.hitCount;
        } else {
            target.mutantCoverage = ns.mutantCoverage;
        }
    }
});

function collectTestName({ name, suite }) {
    const nameParts = [name];
    let currentSuite = suite;
    while (currentSuite) {
        nameParts.unshift(currentSuite.name);
        currentSuite = currentSuite.suite;
    }
    return nameParts.join(' ').trim();
}

function toRawTestId(test) {
    return \`\${test.file?.filepath ?? 'unknown.js'}#\${test.name}\`;
}
//# sourceMappingURL=stryker-setup.js.map
`;
    fs.writeFileSync(strykerSetupPath, dynamicSetup, 'utf8');
    console.log('Patched @stryker-mutator/vitest-runner for dynamic Vitest 5 evaluation.');
  }
}

// 3. Patch @stryker-mutator/vitest-runner test-helpers.js for Vitest 5 testNamePattern matching
const testHelpersPath = path.join(
  root,
  'node_modules/@stryker-mutator/vitest-runner/dist/src/test-helpers.js',
);
if (fs.existsSync(testHelpersPath)) {
  let helpersContent = fs.readFileSync(testHelpersPath, 'utf8');
  if (helpersContent.includes('collectTestName(test)')) {
    helpersContent = helpersContent.replace('collectTestName(test)', 'test.name');
    fs.writeFileSync(testHelpersPath, helpersContent, 'utf8');
    console.log('Patched @stryker-mutator/vitest-runner test-helpers.js for Vitest 5.');
  }
}

