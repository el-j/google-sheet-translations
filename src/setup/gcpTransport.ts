import { GoogleAuth } from 'google-auth-library';

/**
 * Represents a long-running Google Cloud Operation response.
 */
export interface GcpOperation {
  /** Unique resource name of the operation. */
  name: string;
  /** True if the operation has finished executing. */
  done?: boolean;
  /** Error payload if operation terminated with an error. */
  error?: { code: number; message: string };
}

/**
 * Google Cloud IAM Policy object structure containing member role bindings.
 */
export interface IamPolicy {
  /** Array of role-to-member associations. */
  bindings?: Array<{ role: string; members: string[] }>;
  /** Cryptographic etag used for optimistic concurrency control during updates. */
  etag?: string;
  /** Format version of the policy. */
  version?: number;
}

/**
 * Error thrown when a Google Cloud REST API request returns a non-2xx HTTP status code.
 */
export class GcpApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'GcpApiError';
  }
}

/**
 * Obtains a Google Cloud access token scoped to `cloud-platform`, using the given
 * service account key file if provided, or Application Default Credentials otherwise.
 */
export async function getGcpAccessToken(keyFilePath?: string): Promise<string> {
  const auth = new GoogleAuth({
    ...(keyFilePath ? { keyFilename: keyFilePath } : {}),
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  if (!tokenResponse.token) {
    throw new Error(
      'Failed to obtain a Google Cloud access token. ' +
        'Ensure you are authenticated via Application Default Credentials ' +
        '(run: gcloud auth application-default login) ' +
        'or provide --key-file pointing to a service account JSON key.',
    );
  }
  return tokenResponse.token;
}

/** Authenticated JSON fetch against a Google Cloud API endpoint; throws {@link GcpApiError} on a non-OK response. */
export async function gcpFetch(
  url: string,
  token: string,
  method = 'GET',
  body?: unknown,
): Promise<unknown> {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(method !== 'GET' && method !== 'HEAD' && body !== undefined
      ? { body: JSON.stringify(body) }
      : {}),
  });
  const data = (await response.json()) as unknown;
  if (!response.ok) {
    const errData = data as { error?: { message?: string } };
    const message = errData.error?.message ?? `HTTP ${response.status}`;
    throw new GcpApiError(message, response.status);
  }
  return data;
}

/**
 * Polls a Google Cloud long-running operation (by resource name or full URL, which
 * must resolve to a `*.googleapis.com` host) until it reports `done`, throwing if the
 * operation itself failed or if `maxWaitMs` elapses first.
 */
export async function waitForOperation(
  operationName: string,
  token: string,
  maxWaitMs = 60_000,
): Promise<void> {
  let opUrl: string;
  if (operationName.startsWith('http')) {
    let isGoogleHost;
    try {
      const parsedUrl = new URL(operationName);
      const hostname = (parsedUrl.hostname || '').toLowerCase();
      isGoogleHost =
        hostname === 'iam.googleapis.com' ||
        hostname.endsWith('.iam.googleapis.com') ||
        hostname === 'googleapis.com' ||
        hostname.endsWith('.googleapis.com');
    } catch {
      isGoogleHost = false;
    }
    if (!isGoogleHost) {
      throw new Error(
        `Invalid operation URL: hostname must be a Google API endpoint (*.googleapis.com), got: ${operationName}`,
      );
    }
    opUrl = operationName;
  } else {
    opUrl = `https://iam.googleapis.com/v1/${operationName}`;
  }
  const deadline = Date.now() + maxWaitMs;
  const maxWaitSecs = Math.round(maxWaitMs / 1000);

  while (Date.now() < deadline) {
    const op = (await gcpFetch(opUrl, token)) as GcpOperation;
    if (op.done) {
      if (op.error) {
        throw new Error(`Operation failed: ${op.error.message}`);
      }
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 2000));
  }
  if (Date.now() >= deadline) {
    throw new Error(
      `Operation timed out after ${maxWaitSecs} s. ` +
        'The resources may still be provisioning in the background – ' +
        're-running the command is safe (existing resources are reused).',
    );
  }
}
