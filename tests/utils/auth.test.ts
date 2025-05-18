import { createAuthClient } from '../../src/utils/auth';
import { JWT } from 'google-auth-library';

// Mock validateEnv to avoid actual environment checks
jest.mock('../../src/utils/validateEnv', () => ({
  validateEnv: jest.fn().mockReturnValue({
    GOOGLE_CLIENT_EMAIL: 'test@example.com',
    GOOGLE_PRIVATE_KEY: 'test-private-key',
    GOOGLE_SPREADSHEET_ID: 'test-spreadsheet-id'
  })
}));

// Mock the JWT constructor
jest.mock('google-auth-library', () => {
  return {
    JWT: jest.fn().mockImplementation(() => ({
      email: 'test@example.com',
      key: 'test-private-key',
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    }))
  };
});

describe('createAuthClient', () => {
  test('should create a JWT auth client with correct parameters', () => {
    const authClient = createAuthClient();
    
    // Check that JWT was called with the right parameters
    expect(JWT).toHaveBeenCalledWith({
      email: 'test@example.com',
      key: 'test-private-key',
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    // Check that we got back the expected object
    expect(authClient).toEqual({
      email: 'test@example.com',
      key: 'test-private-key',
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
  });
});
