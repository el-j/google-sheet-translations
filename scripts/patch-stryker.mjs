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

// 2. Patch @stryker-mutator/vitest-runner stryker-setup.js for Vitest 5 dynamic hook evaluation
const strykerSetupPath = path.join(
  root,
  'node_modules/@stryker-mutator/vitest-runner/dist/src/stryker-setup.js',
);

if (fs.existsSync(strykerSetupPath)) {
  let setupContent = fs.readFileSync(strykerSetupPath, 'utf8');
  if (setupContent.includes("if (mode === 'mutant') {")) {
    setupContent = setupContent.replace(
      /if \(mode === 'mutant'\) \{[\s\S]*?else \{[\s\S]*?\}\s*\}/,
      `beforeAll(() => {
    const mode = inject('mode');
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
afterAll((firstArg, secondArg) => {
    const suiteMeta = (secondArg && secondArg.meta) || (firstArg && firstArg.meta) || {};
    const mode = inject('mode');
    if (mode === 'mutant') {
        suiteMeta.hitCount = ns.hitCount;
    } else {
        suiteMeta.mutantCoverage = ns.mutantCoverage;
    }
});`,
    );
    fs.writeFileSync(strykerSetupPath, setupContent, 'utf8');
    console.log('Patched @stryker-mutator/vitest-runner for Vitest 5 dynamic hook evaluation.');
  }
}
