import { GoogleAuth } from "google-auth-library";

// ── public types ─────────────────────────────────────────────────────────────

export interface WifSetupOptions {
	/** Google Cloud project ID (e.g. "my-gcp-project") */
	projectId: string;
	/** Service account email (e.g. "deploy@my-gcp-project.iam.gserviceaccount.com") */
	serviceAccountEmail: string;
	/** GitHub repository in "owner/repo" format (e.g. "myorg/myrepo") */
	githubRepo: string;
	/** Workload Identity Pool ID (default: "github-actions") */
	poolId?: string;
	/** OIDC Provider ID (default: "github-oidc") */
	providerId?: string;
	/** Path to a service account JSON key file used for bootstrapping.
	 *  If omitted, Application Default Credentials (ADC) are used. */
	keyFilePath?: string;
	/** Optional callback invoked before each setup step for progress reporting. */
	onProgress?: (step: string) => void;
}

export interface WifSetupResult {
	/** Full WIF provider resource name – set this as the `WIF_PROVIDER` env var */
	wifProvider: string;
	/** Numeric Google Cloud project number */
	projectNumber: string;
	/** Workload Identity Pool ID used */
	poolId: string;
	/** OIDC Provider ID used */
	providerId: string;
}

export interface GrantDrivePermissionsOptions {
	/** Google Cloud project ID */
	projectId: string;
	/** Service account email to grant Drive access */
	serviceAccountEmail: string;
	/** Path to a service account JSON key file used for bootstrapping. */
	keyFilePath?: string;
}

// ── internal types ────────────────────────────────────────────────────────────

interface GcpOperation {
	name: string;
	done?: boolean;
	error?: { code: number; message: string };
}

interface IamPolicy {
	bindings?: Array<{ role: string; members: string[] }>;
	etag?: string;
	version?: number;
}

// ── error class ───────────────────────────────────────────────────────────────

export class GcpApiError extends Error {
	constructor(
		message: string,
		public readonly status: number,
	) {
		super(message);
		this.name = "GcpApiError";
	}
}

// ── internal helpers ──────────────────────────────────────────────────────────

async function getAccessToken(keyFilePath?: string): Promise<string> {
	const auth = new GoogleAuth({
		...(keyFilePath ? { keyFilename: keyFilePath } : {}),
		scopes: ["https://www.googleapis.com/auth/cloud-platform"],
	});
	const client = await auth.getClient();
	const tokenResponse = await client.getAccessToken();
	if (!tokenResponse.token) {
		throw new Error(
			"Failed to obtain a Google Cloud access token. " +
				"Ensure you are authenticated via Application Default Credentials " +
				"(run: gcloud auth application-default login) " +
				"or provide --key-file pointing to a service account JSON key.",
		);
	}
	return tokenResponse.token;
}

async function gcpFetch(
	url: string,
	token: string,
	method = "GET",
	body?: unknown,
): Promise<unknown> {
	const response = await fetch(url, {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});
	const data = (await response.json()) as unknown;
	if (!response.ok) {
		const errData = data as { error?: { message?: string } };
		const message = errData.error?.message ?? `HTTP ${response.status}`;
		throw new GcpApiError(message, response.status);
	}
	return data;
}

async function pollOperation(
	operationName: string,
	token: string,
	maxWaitMs = 60_000,
): Promise<void> {
	// Operation names returned by IAM are full resource paths, e.g.:
	// "projects/my-project/locations/global/workloadIdentityPools/pool/operations/abc"
	const opUrl = operationName.startsWith("http")
		? operationName
		: `https://iam.googleapis.com/v1/${operationName}`;
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
				"The resources may still be provisioning in the background – " +
				"re-running the command is safe (existing resources are reused).",
		);
	}
}

async function getProjectNumber(projectId: string, token: string): Promise<string> {
	const data = (await gcpFetch(
		`https://cloudresourcemanager.googleapis.com/v1/projects/${encodeURIComponent(projectId)}`,
		token,
	)) as { projectNumber: string };
	return data.projectNumber;
}

async function createOrGetWifPool(
	projectId: string,
	poolId: string,
	token: string,
): Promise<void> {
	try {
		const op = (await gcpFetch(
			`https://iam.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/locations/global/workloadIdentityPools` +
				`?workloadIdentityPoolId=${encodeURIComponent(poolId)}`,
			token,
			"POST",
			{
				displayName: "GitHub Actions Pool",
				description: "Pool for GitHub Actions OIDC authentication",
				disabled: false,
			},
		)) as GcpOperation;
		if (!op.done) {
			await pollOperation(op.name, token);
		} else if (op.error) {
			throw new Error(`Operation failed: ${op.error.message}`);
		}
	} catch (err) {
		if (err instanceof GcpApiError && err.status === 409) {
			return; // Pool already exists – that's fine
		}
		throw err;
	}
}

async function createOrGetWifProvider(
	projectId: string,
	poolId: string,
	providerId: string,
	githubRepo: string,
	token: string,
): Promise<void> {
	try {
		const op = (await gcpFetch(
			`https://iam.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/locations/global/workloadIdentityPools/${encodeURIComponent(poolId)}/providers` +
				`?workloadIdentityPoolProviderId=${encodeURIComponent(providerId)}`,
			token,
			"POST",
			{
				displayName: "GitHub OIDC Provider",
				disabled: false,
				attributeMapping: {
					"google.subject": "assertion.sub",
					"attribute.actor": "assertion.actor",
					"attribute.repository": "assertion.repository",
				},
				// Scope the provider to this exact repository for security
				attributeCondition: `assertion.repository=='${githubRepo}'`,
				oidc: {
					issuerUri: "https://token.actions.githubusercontent.com",
				},
			},
		)) as GcpOperation;
		if (!op.done) {
			await pollOperation(op.name, token);
		} else if (op.error) {
			throw new Error(`Operation failed: ${op.error.message}`);
		}
	} catch (err) {
		if (err instanceof GcpApiError && err.status === 409) {
			return; // Provider already exists – that's fine
		}
		throw err;
	}
}

async function bindServiceAccount(
	projectId: string,
	serviceAccountEmail: string,
	projectNumber: string,
	poolId: string,
	githubRepo: string,
	token: string,
): Promise<void> {
	const saResource = `projects/${encodeURIComponent(projectId)}/serviceAccounts/${encodeURIComponent(serviceAccountEmail)}`;
	const principal = `principalSet://iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/attribute.repository/${githubRepo}`;

	const policy = (await gcpFetch(
		`https://iam.googleapis.com/v1/${saResource}:getIamPolicy`,
		token,
		"POST",
		{},
	)) as IamPolicy;

	const bindings = policy.bindings ?? [];
	const role = "roles/iam.workloadIdentityUser";
	const existing = bindings.find((b) => b.role === role);

	if (existing) {
		if (existing.members.includes(principal)) {
			return; // Already bound – idempotent
		}
		existing.members.push(principal);
	} else {
		bindings.push({ role, members: [principal] });
	}

	await gcpFetch(
		`https://iam.googleapis.com/v1/${saResource}:setIamPolicy`,
		token,
		"POST",
		{ policy: { ...policy, bindings } },
	);
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Configures Workload Identity Federation (WIF) on Google Cloud so that
 * GitHub Actions can authenticate without a long-lived service account key.
 *
 * This function is **idempotent**: re-running it when resources already exist
 * is safe – existing pools, providers and IAM bindings are reused.
 *
 * Steps performed:
 * 1. Resolves the numeric Google Cloud project number.
 * 2. Creates (or reuses) a Workload Identity Pool named `poolId`.
 * 3. Creates (or reuses) an OIDC Provider scoped to `githubRepo`.
 * 4. Grants the service account the `roles/iam.workloadIdentityUser` role
 *    for tokens originating from `githubRepo`.
 *
 * The returned {@link WifSetupResult.wifProvider} is the full provider resource
 * name that should be set as the `WIF_PROVIDER` environment variable / GitHub
 * Actions environment variable.
 *
 * @example
 * ```typescript
 * import { setupWIF } from '@el-j/google-sheet-translations';
 *
 * const result = await setupWIF({
 *   projectId: 'my-gcp-project',
 *   serviceAccountEmail: 'deploy@my-gcp-project.iam.gserviceaccount.com',
 *   githubRepo: 'myorg/myrepo',
 *   keyFilePath: './service-account-key.json',
 *   onProgress: (step) => console.log(' ⏳', step),
 * });
 *
 * console.log('WIF_PROVIDER =', result.wifProvider);
 * ```
 */
export async function setupWIF(options: WifSetupOptions): Promise<WifSetupResult> {
	const poolId = options.poolId ?? "github-actions";
	const providerId = options.providerId ?? "github-oidc";
	const log = options.onProgress ?? (() => undefined);

	if (!options.githubRepo.includes("/")) {
		throw new Error(
			`githubRepo must be in "owner/repo" format, got: "${options.githubRepo}"`,
		);
	}

	log("Authenticating with Google Cloud...");
	const token = await getAccessToken(options.keyFilePath);

	log("Fetching project number...");
	const projectNumber = await getProjectNumber(options.projectId, token);

	log(`Creating Workload Identity Pool "${poolId}"...`);
	await createOrGetWifPool(options.projectId, poolId, token);

	log(`Creating OIDC Provider "${providerId}"...`);
	await createOrGetWifProvider(
		options.projectId,
		poolId,
		providerId,
		options.githubRepo,
		token,
	);

	log("Binding service account permissions...");
	await bindServiceAccount(
		options.projectId,
		options.serviceAccountEmail,
		projectNumber,
		poolId,
		options.githubRepo,
		token,
	);

	const wifProvider = `projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`;
	return { wifProvider, projectNumber, poolId, providerId };
}

/**
 * Grants the service account `roles/drive.file` on the Google Cloud project.
 *
 * This is required when using the Drive-folder features of
 * `@el-j/google-sheet-translations` (e.g. `manageDriveTranslations()`)
 * so the service account can create and access spreadsheets inside a shared
 * Drive folder.
 *
 * This function is **idempotent** – it checks the existing policy before
 * adding the binding.
 *
 * @example
 * ```typescript
 * await grantDrivePermissions({
 *   projectId: 'my-gcp-project',
 *   serviceAccountEmail: 'deploy@my-gcp-project.iam.gserviceaccount.com',
 *   keyFilePath: './service-account-key.json',
 * });
 * ```
 */
export async function grantDrivePermissions(
	options: GrantDrivePermissionsOptions,
): Promise<void> {
	const token = await getAccessToken(options.keyFilePath);

	const policy = (await gcpFetch(
		`https://cloudresourcemanager.googleapis.com/v1/projects/${encodeURIComponent(options.projectId)}:getIamPolicy`,
		token,
		"POST",
		{},
	)) as IamPolicy;

	const bindings = policy.bindings ?? [];
	const role = "roles/drive.file";
	const member = `serviceAccount:${options.serviceAccountEmail}`;
	const existing = bindings.find((b) => b.role === role);

	if (existing) {
		if (existing.members.includes(member)) {
			return; // Already granted – idempotent
		}
		existing.members.push(member);
	} else {
		bindings.push({ role, members: [member] });
	}

	await gcpFetch(
		`https://cloudresourcemanager.googleapis.com/v1/projects/${encodeURIComponent(options.projectId)}:setIamPolicy`,
		token,
		"POST",
		{ policy: { ...policy, bindings } },
	);
}
