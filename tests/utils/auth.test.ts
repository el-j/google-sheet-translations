import { createAuthClient } from '../../src/utils/auth';
import { JWT } from 'google-auth-library';
import { validateCredentials } from '../../src/utils/validateEnv';

// Mock validateEnv to avoid actual environment checks
jest.mock('../../src/utils/validateEnv', () => ({
  validateEnv: jest.fn().mockReturnValue({
    GOOGLE_CLIENT_EMAIL: 'test@example.com',
    GOOGLE_PRIVATE_KEY: 'test-private-key',
    GOOGLE_SPREADSHEET_ID: 'test-spreadsheet-id'
  }),
  validateCredentials: jest.fn().mockReturnValue({
    GOOGLE_CLIENT_EMAIL: 'test@example.com',
    GOOGLE_PRIVATE_KEY: 'test-private-key',
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

const mockValidateCredentials = validateCredentials as jest.Mock;
const MockJWT = JWT as unknown as jest.Mock;

describe('createAuthClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should create a JWT auth client with correct parameters', () => {
    mockValidateCredentials.mockReturnValue({
      GOOGLE_CLIENT_EMAIL: 'test@example.com',
      GOOGLE_PRIVATE_KEY: 'test-private-key',
      GOOGLE_SPREADSHEET_ID: 'test-spreadsheet-id'
    });
    MockJWT.mockImplementation(() => ({
      email: 'test@example.com',
      key: 'test-private-key',
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    }));

    const authClient = createAuthClient();
    
    // Check that JWT was called with the right parameters
    expect(MockJWT).toHaveBeenCalledWith({
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

  test('should normalize literal \\n sequences in GOOGLE_PRIVATE_KEY to real newlines', () => {
    // Simulate how GitHub Actions secrets store PEM keys: literal \n instead of newlines
    const keyWithEscapedNewlines =
      '-----BEGIN RSA PRIVATE KEY-----\\nMIIEfake\\n-----END RSA PRIVATE KEY-----\\n';
    const keyWithRealNewlines =
      '-----BEGIN RSA PRIVATE KEY-----\nMIIEfake\n-----END RSA PRIVATE KEY-----\n';

    mockValidateCredentials.mockReturnValue({
      GOOGLE_CLIENT_EMAIL: 'ci@example.com',
      GOOGLE_PRIVATE_KEY: keyWithEscapedNewlines,
      GOOGLE_SPREADSHEET_ID: 'some-id'
    });
    MockJWT.mockImplementation((opts: { key: string }) => ({ key: opts.key }));

    createAuthClient();

    expect(MockJWT).toHaveBeenCalledWith(
      expect.objectContaining({ key: keyWithRealNewlines })
    );
  });

  test('should leave already-unescaped newlines unchanged', () => {
    // Simulate a .env file that already has real newlines in the key
    const keyWithRealNewlines =
      '-----BEGIN RSA PRIVATE KEY-----\nMIIEfake\n-----END RSA PRIVATE KEY-----\n';

    mockValidateCredentials.mockReturnValue({
      GOOGLE_CLIENT_EMAIL: 'local@example.com',
      GOOGLE_PRIVATE_KEY: keyWithRealNewlines,
      GOOGLE_SPREADSHEET_ID: 'some-id'
    });
    MockJWT.mockImplementation((opts: { key: string }) => ({ key: opts.key }));

    createAuthClient();

    expect(MockJWT).toHaveBeenCalledWith(
      expect.objectContaining({ key: keyWithRealNewlines })
    );
  });
});
