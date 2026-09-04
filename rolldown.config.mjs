import { defineConfig } from 'rolldown';

const isExternal = (id) => !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0');

const cjsConfig = {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'cjs',
    exports: 'named',
  },
  platform: 'node',
  external: isExternal,
};

const esmConfig = {
  input: 'src/index.ts',
  output: {
    file: 'dist/esm/index.js',
    format: 'esm',
  },
  platform: 'node',
  external: isExternal,
};

const cliConfigs = [
  {
    input: 'src/setup/cli.ts',
    output: {
      file: 'dist-cli/setup-wif.mjs',
      format: 'esm',
      banner: '#!/usr/bin/env node',
    },
    platform: 'node',
    external: isExternal,
  },
  {
    input: 'src/setup/providerCli.ts',
    output: {
      file: 'dist-cli/run-provider.mjs',
      format: 'esm',
      banner: '#!/usr/bin/env node',
    },
    platform: 'node',
    external: isExternal,
  },
  {
    input: 'src/setup/migrateV3Cli.ts',
    output: {
      file: 'dist-cli/migrate-v3.mjs',
      format: 'esm',
      banner: '#!/usr/bin/env node',
    },
    platform: 'node',
    external: isExternal,
  },
];

const actionConfig = {
  input: 'src/action-entrypoint.ts',
  output: {
    file: 'dist-action/index.mjs',
    format: 'esm',
    codeSplitting: false,
  },
  platform: 'node',
};

const target = process.env.BUILD_TARGET;

let configs;
switch (target) {
  case 'cjs':
    configs = [cjsConfig];
    break;
  case 'esm':
    configs = [esmConfig];
    break;
  case 'cli':
    configs = cliConfigs;
    break;
  case 'action':
    configs = [actionConfig];
    break;
  default:
    configs = [cjsConfig, esmConfig, ...cliConfigs, actionConfig];
    break;
}

export default defineConfig(configs);
