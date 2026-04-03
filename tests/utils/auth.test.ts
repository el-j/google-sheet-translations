import { createAuthClient, buildGoogleAuth } from '../../src/utils/auth';
import { GoogleAuth } from 'google-auth-library';
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

// Mock GoogleAuth constructor
jest.mock('google-auth-library', () => {
  return {
    GoogleAuth: jest.fn().mockImplementation((opts: unknown) => ({
      _opts: opts,
    })),
  };
});

const mockValidateCredentials = validateCredentials as jest.Mock;
const MockGoogleAuth = GoogleAuth as unknown as jest.Mock;

describe('createAuthClient', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('service-account key mode (classic)', () => {
    test('should create a GoogleAuth client with service-account credentials', () => {
      mockValidateCredentials.mockReturnValue({
        GOOGLE_CLIENT_EMAIL: 'test@example.com',
        GOOGLE_PRIVATE_KEY: 'test-private-key',
      });

      createAuthClient();

      expect(MockGoogleAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          credentials: expect.objectContaining({
            client_email: 'test@example.com',
            private_key: 'test-private-key',
          }),
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        })
      );
    });

    test('should normalize literal \\n sequences in GOOGLE_PRIVATE_KEY to real newlines', () => {
      const keyWithEscapedNewlines =
        '-----BEGIN RSA PRIVATE KEY-----\\nMIIEfake\\n-----END RSA PRIVATE KEY-----\\n';
      const keyWithRealNewlines =
        '-----BEGIN RSA PRIVATE KEY-----\nMIIEfake\n-----END RSA PRIVATE KEY-----\n';

      mockValidateCredentials.mockReturnValue({
        GOOGLE_CLIENT_EMAIL: 'ci@example.com',
        GOOGLE_PRIVATE_KEY: keyWithEscapedNewlines,
      });

      createAuthClient();

      expect(MockGoogleAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          credentials: expect.objectContaining({
            private_key: keyWithRealNewlines,
          }),
        })
      );
    });

    test('should leave already-unescaped newlines unchanged', () => {
      const keyWithRealNewlines =
        '-----BEGIN RSA PRIVATE KEY-----\nMIIEfake\n-----END RSA PRIVATE KEY-----\n';

      mockValidateCredentials.mockReturnValue({
        GOOGLE_CLIENT_EMAIL: 'local@example.com',
        GOOGLE_PRIVATE_KEY: keyWithRealNewlines,
      });

      createAuthClient();

      expect(MockGoogleAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          credentials: expect.objectContaining({
            private_key: keyWithRealNewlines,
          }),
        })
      );
    });
  });

  describe('Workload Identity Federation / ADC mode', () => {
    test('should use ADC when GOOGLE_APPLICATION_CREDENTIALS is set', () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/credentials.json';

      createAuthClient();

      // GoogleAuth is constructed without explicit credentials (uses ADC file)
      expect(MockGoogleAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        })
      );
      expect(MockGoogleAuth).toHaveBeenCalledWith(
        expect.not.objectContaining({ credentials: expect.anything() })
      );
    });

    test('should NOT call validateCredentials when GOOGLE_APPLICATION_CREDENTIALS is set', () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/path/to/credentials.json';

      createAuthClient();

      expect(mockValidateCredentials).not.toHaveBeenCalled();
    });

    test('should still call validateCredentials when GOOGLE_APPLICATION_CREDENTIALS is absent', () => {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

      createAuthClient();

      expect(mockValidateCredentials).toHaveBeenCalledTimes(1);
    });
  });
});

describe('buildGoogleAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns GoogleAuth with credentials when provided', () => {
    buildGoogleAuth(['https://www.googleapis.com/auth/spreadsheets'], {
      client_email: 'sa@project.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n',
    });

    expect(MockGoogleAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        credentials: expect.objectContaining({ client_email: 'sa@project.iam.gserviceaccount.com' }),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      })
    );
  });

  test('returns GoogleAuth without credentials when none provided (ADC/WIF)', () => {
    buildGoogleAuth(['https://www.googleapis.com/auth/drive.readonly']);

    expect(MockGoogleAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      })
    );
    expect(MockGoogleAuth).toHaveBeenCalledWith(
      expect.not.objectContaining({ credentials: expect.anything() })
    );
  });
});
