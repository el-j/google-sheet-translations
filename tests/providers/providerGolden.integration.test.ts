import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCryptPadCsvInputProvider, runProviderPipeline } from '../../src/providers';

describe('provider golden fixtures', () => {
  it('matches golden translation output for cryptpad csv pipeline', async () => {
    const fixturesDir = path.resolve(__dirname, '../fixtures/providers');

    const inputProvider = createCryptPadCsvInputProvider({
      sources: [
        {
          tableName: 'home',
          filePath: path.join(fixturesDir, 'home.csv'),
        },
        {
          tableName: 'about',
          filePath: path.join(fixturesDir, 'about.csv'),
        },
      ],
    });

    const result = await runProviderPipeline({
      inputProvider,
      tableNames: ['home', 'about'],
    });

    const expected = JSON.parse(
      fs.readFileSync(path.join(fixturesDir, 'expected-cryptpad-pipeline.json'), 'utf8'),
    );

    expect(result.translations).toEqual(expected);
    expect(result.locales.sort()).toEqual(['de-DE', 'en-GB']);
  });
});
