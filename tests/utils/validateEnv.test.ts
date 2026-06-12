import { validateEnv, validateCredentials } from '../../src/utils/validateEnv';
import type { GoogleEnvVars } from '../../src/types';

describe('validateEnv', () => {
  // Store the original process.env
  const originalEnv = process.env;

  beforeEach(() => {
    // Create a clean copy of the env for each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  test('should throw error when all required environment variables are missing', () => {
    // Clear the required variables
    delete process.env.GOOGLE_CLIENT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;
    delete process.env.GOOGLE_SPREADSHEET_ID;

    expect(() => validateEnv()).toThrow(
      /Missing required environment variables/
    );
  });

  test('should throw error when some required environment variables are missing', () => {
    // Set some variables but not all
    process.env.GOOGLE_CLIENT_EMAIL = 'test@example.com';
    delete process.env.GOOGLE_PRIVATE_KEY;
    delete process.env.GOOGLE_SPREADSHEET_ID;

    expect(() => validateEnv()).toThrow(
      /Missing required environment variables/
    );
  });

  test('should return valid environment variables', () => {
    // Set all required variables
    const testVars: GoogleEnvVars = {
      GOOGLE_CLIENT_EMAIL: 'test@example.com',
      GOOGLE_PRIVATE_KEY: 'test-private-key',
      GOOGLE_SPREADSHEET_ID: 'test-spreadsheet-id'
    };

    process.env.GOOGLE_CLIENT_EMAIL = testVars.GOOGLE_CLIENT_EMAIL;
    process.env.GOOGLE_PRIVATE_KEY = testVars.GOOGLE_PRIVATE_KEY;
    process.env.GOOGLE_SPREADSHEET_ID = testVars.GOOGLE_SPREADSHEET_ID;

    const result = validateEnv();
    expect(result).toEqual(testVars);
  });

  test('should handle environment variables with special characters', () => {
    // Set variables with special characters
    const privateKey = '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg==\n-----END PRIVATE KEY-----\n';
    
    process.env.GOOGLE_CLIENT_EMAIL = 'test@example.com';
    process.env.GOOGLE_PRIVATE_KEY = privateKey;
    process.env.GOOGLE_SPREADSHEET_ID = 'test-spreadsheet-id';

    const result = validateEnv();
    
    expect(result).toEqual({
      GOOGLE_CLIENT_EMAIL: 'test@example.com',
      GOOGLE_PRIVATE_KEY: privateKey,
      GOOGLE_SPREADSHEET_ID: 'test-spreadsheet-id'
    });
  });
});

describe('validateCredentials', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('should throw when GOOGLE_CLIENT_EMAIL is missing', () => {
    delete process.env.GOOGLE_CLIENT_EMAIL;
    process.env.GOOGLE_PRIVATE_KEY = 'key';
    expect(() => validateCredentials()).toThrow(/Missing required environment variables/);
  });

  test('should throw when GOOGLE_PRIVATE_KEY is missing', () => {
    process.env.GOOGLE_CLIENT_EMAIL = 'test@example.com';
    delete process.env.GOOGLE_PRIVATE_KEY;
    expect(() => validateCredentials()).toThrow(/Missing required environment variables/);
  });

  test('should throw when both credentials are missing', () => {
    delete process.env.GOOGLE_CLIENT_EMAIL;
    delete process.env.GOOGLE_PRIVATE_KEY;
    expect(() => validateCredentials()).toThrow(/Missing required environment variables/);
  });

  test('should return credentials when both are set (no spreadsheet ID required)', () => {
    process.env.GOOGLE_CLIENT_EMAIL = 'service@project.iam.gserviceaccount.com';
    process.env.GOOGLE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----\n';
    delete process.env.GOOGLE_SPREADSHEET_ID;

    const result = validateCredentials();
    expect(result.GOOGLE_CLIENT_EMAIL).toBe('service@project.iam.gserviceaccount.com');
    expect(result.GOOGLE_PRIVATE_KEY).toContain('BEGIN PRIVATE KEY');
    // TypeScript type must not include GOOGLE_SPREADSHEET_ID
    expect((result as Record<string, unknown>)['GOOGLE_SPREADSHEET_ID']).toBeUndefined();
  });
});
