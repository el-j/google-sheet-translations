import { validateEnv } from '../../src/utils/validateEnv';
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
