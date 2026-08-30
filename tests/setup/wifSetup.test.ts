import { setupWIF, grantDrivePermissions, GcpApiError } from "../../src/setup/wifSetup";
import { GoogleAuth } from "google-auth-library";

// ── mock google-auth-library ──────────────────────────────────────────────────
// vi.mock is hoisted; use vi.hoisted() to share references between the factory
// and the test body.

const { mockGetAccessToken, mockGetClient } = vi.hoisted(() => {
	const mockGetAccessToken = vi.fn().mockResolvedValue({ token: "fake-access-token" });
	const mockGetClient = vi.fn().mockResolvedValue({ getAccessToken: mockGetAccessToken });
	return { mockGetAccessToken, mockGetClient };
});

vi.mock("google-auth-library", () => ({
	// Use a regular function (not arrow) so it can be called with `new`.
	GoogleAuth: vi.fn(function () {
		return { getClient: mockGetClient };
	}),
}));

const MockGoogleAuth = GoogleAuth as unknown as Mock;

// ── mock global fetch ─────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ── helpers ───────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: vi.fn().mockResolvedValue(body),
	} as unknown as Response;
}

/** Standard sequence of API responses for a successful setupWIF call */
function mockSuccessfulSetup(projectNumber = "123456789"): void {
	mockFetch
		// 1. getProjectNumber
		.mockResolvedValueOnce(jsonResponse({ projectNumber }))
		// 2. createOrGetWifPool – returns operation
		.mockResolvedValueOnce(
			jsonResponse({ name: "projects/proj/locations/global/workloadIdentityPools/pool/operations/op1", done: true }),
		)
		// 3. createOrGetWifProvider – returns operation
		.mockResolvedValueOnce(
			jsonResponse({ name: "projects/proj/locations/global/workloadIdentityPools/pool/operations/op2", done: true }),
		)
		// 4. getIamPolicy
		.mockResolvedValueOnce(jsonResponse({ bindings: [], etag: "etag1" }))
		// 5. setIamPolicy
		.mockResolvedValueOnce(jsonResponse({ bindings: [] }));
}

const BASE_OPTIONS = {
	projectId: "my-project",
	serviceAccountEmail: "sa@my-project.iam.gserviceaccount.com",
	githubRepo: "myorg/myrepo",
} as const;

// ── tests ─────────────────────────────────────────────────────────────────────

describe("setupWIF", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetAccessToken.mockResolvedValue({ token: "fake-access-token" });
		mockGetClient.mockResolvedValue({ getAccessToken: mockGetAccessToken });
		MockGoogleAuth.mockImplementation(function () {
			return { getClient: mockGetClient };
		});
	});

	describe("happy path", () => {
		test("returns correct wifProvider string", async () => {
			mockSuccessfulSetup("987654321");

			const result = await setupWIF(BASE_OPTIONS);

			expect(result.wifProvider).toBe(
				"projects/987654321/locations/global/workloadIdentityPools/github-actions/providers/github-oidc",
			);
			expect(result.projectNumber).toBe("987654321");
			expect(result.poolId).toBe("github-actions");
			expect(result.providerId).toBe("github-oidc");
		});

		test("uses custom poolId and providerId when provided", async () => {
			mockSuccessfulSetup("111");

			const result = await setupWIF({
				...BASE_OPTIONS,
				poolId: "my-pool",
				providerId: "my-provider",
			});

			expect(result.poolId).toBe("my-pool");
			expect(result.providerId).toBe("my-provider");
			expect(result.wifProvider).toContain("my-pool/providers/my-provider");
		});

		test("passes keyFilePath to GoogleAuth when provided", async () => {
			mockSuccessfulSetup();

			await setupWIF({ ...BASE_OPTIONS, keyFilePath: "/tmp/sa-key.json" });

			expect(MockGoogleAuth).toHaveBeenCalledWith(
				expect.objectContaining({ keyFilename: "/tmp/sa-key.json" }),
			);
		});

		test("omits keyFilename when no keyFilePath is given (uses ADC)", async () => {
			mockSuccessfulSetup();

			await setupWIF(BASE_OPTIONS);

			expect(MockGoogleAuth).toHaveBeenCalledWith(
				expect.not.objectContaining({ keyFilename: expect.anything() }),
			);
		});

		test("invokes onProgress callback for each step", async () => {
			mockSuccessfulSetup();
			const onProgress = vi.fn();

			await setupWIF({ ...BASE_OPTIONS, onProgress });

			expect(onProgress).toHaveBeenCalledWith(expect.stringContaining("Authenticating"));
			expect(onProgress).toHaveBeenCalledWith(expect.stringContaining("project number"));
			expect(onProgress).toHaveBeenCalledWith(expect.stringContaining("Pool"));
			expect(onProgress).toHaveBeenCalledWith(expect.stringContaining("Provider"));
			expect(onProgress).toHaveBeenCalledWith(expect.stringContaining("Binding"));
		});

		test("authenticates with cloud-platform scope", async () => {
			mockSuccessfulSetup();

			await setupWIF(BASE_OPTIONS);

			expect(MockGoogleAuth).toHaveBeenCalledWith(
				expect.objectContaining({
					scopes: ["https://www.googleapis.com/auth/cloud-platform"],
				}),
			);
		});
	});

	describe("idempotency (409 conflict)", () => {
		test("ignores 409 when pool already exists and continues", async () => {
			mockFetch
				.mockResolvedValueOnce(jsonResponse({ projectNumber: "123" }))
				// Pool creation returns 409
				.mockResolvedValueOnce(jsonResponse({ error: { message: "already exists" } }, 409))
				// Provider creation succeeds
				.mockResolvedValueOnce(
					jsonResponse({ name: "projects/p/locations/global/workloadIdentityPools/p/operations/op", done: true }),
				)
				.mockResolvedValueOnce(jsonResponse({ bindings: [], etag: "e" }))
				.mockResolvedValueOnce(jsonResponse({}));

			const result = await setupWIF(BASE_OPTIONS);
			expect(result.wifProvider).toContain("github-actions/providers/github-oidc");
		});

		test("ignores 409 when provider already exists and continues", async () => {
			mockFetch
				.mockResolvedValueOnce(jsonResponse({ projectNumber: "123" }))
				// Pool succeeds
				.mockResolvedValueOnce(
					jsonResponse({ name: "p/op", done: true }),
				)
				// Provider returns 409
				.mockResolvedValueOnce(jsonResponse({ error: { message: "already exists" } }, 409))
				.mockResolvedValueOnce(jsonResponse({ bindings: [], etag: "e" }))
				.mockResolvedValueOnce(jsonResponse({}));

			await expect(setupWIF(BASE_OPTIONS)).resolves.not.toThrow();
		});

		test("does not add duplicate IAM member if already bound", async () => {
			const existingMember =
				"principalSet://iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/github-actions/attribute.repository/myorg/myrepo";
			mockFetch
				.mockResolvedValueOnce(jsonResponse({ projectNumber: "123" }))
				.mockResolvedValueOnce(jsonResponse({ name: "p/op1", done: true }))
				.mockResolvedValueOnce(jsonResponse({ name: "p/op2", done: true }))
				.mockResolvedValueOnce(
					jsonResponse({
						bindings: [
							{
								role: "roles/iam.workloadIdentityUser",
								members: [existingMember],
							},
						],
						etag: "e",
					}),
				);
			// setIamPolicy should NOT be called because member already exists

			await setupWIF(BASE_OPTIONS);

			// 4 calls: getProjectNumber, createPool, createProvider, getIamPolicy
			// setIamPolicy is NOT called
			expect(mockFetch).toHaveBeenCalledTimes(4);
		});

		test("adds the IAM member to an existing workloadIdentityUser binding when missing", async () => {
			mockFetch
				.mockResolvedValueOnce(jsonResponse({ projectNumber: "123" }))
				.mockResolvedValueOnce(jsonResponse({ name: "p/op1", done: true }))
				.mockResolvedValueOnce(jsonResponse({ name: "p/op2", done: true }))
				.mockResolvedValueOnce(
					jsonResponse({
						bindings: [
							{
								role: "roles/iam.workloadIdentityUser",
								members: ["principalSet://iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/github-actions/attribute.repository/other/repo"],
							},
						],
						etag: "e",
					}),
				)
				.mockResolvedValueOnce(jsonResponse({ bindings: [] }));

			await setupWIF(BASE_OPTIONS);

			const setCall = mockFetch.mock.calls[4];
			const body = JSON.parse(setCall[1].body as string) as {
				policy: { bindings: Array<{ role: string; members: string[] }> };
			};
			expect(body.policy.bindings[0].members).toContain(
				"principalSet://iam.googleapis.com/projects/123/locations/global/workloadIdentityPools/github-actions/attribute.repository/myorg/myrepo",
			);
		});
	});
	describe("error handling", () => {
		test("throws GcpApiError with status for non-409 API errors", async () => {
			mockFetch
				.mockResolvedValueOnce(jsonResponse({ projectNumber: "123" }))
				.mockResolvedValueOnce(
					jsonResponse({ error: { message: "Permission denied" } }, 403),
				);

			await expect(setupWIF(BASE_OPTIONS)).rejects.toThrow(GcpApiError);
		});

		test("throws when getAccessToken returns no token", async () => {
			mockGetAccessToken.mockResolvedValueOnce({ token: null });
			mockGetClient.mockResolvedValueOnce({ getAccessToken: mockGetAccessToken });

			await expect(setupWIF(BASE_OPTIONS)).rejects.toThrow(
				"Failed to obtain a Google Cloud access token",
			);
		});

		test("throws for invalid githubRepo format", async () => {
			await expect(
				setupWIF({ ...BASE_OPTIONS, githubRepo: "invalid-repo-no-slash" }),
			).rejects.toThrow('githubRepo must be in "owner/repo" format');
		});

		test("throws when operation fails with error", async () => {
			mockFetch
				.mockResolvedValueOnce(jsonResponse({ projectNumber: "123" }))
				.mockResolvedValueOnce(
					jsonResponse({
						name: "projects/p/operations/op1",
						done: true,
						error: { code: 7, message: "operation failed" },
					}),
				);

			await expect(setupWIF(BASE_OPTIONS)).rejects.toThrow("Operation failed: operation failed");
		});

		test("throws when a pending pool operation resolves with an error", async () => {
			mockFetch
				.mockResolvedValueOnce(jsonResponse({ projectNumber: "123" }))
				.mockResolvedValueOnce(jsonResponse({ name: "projects/p/operations/op1", done: false }))
				.mockResolvedValueOnce(jsonResponse({ name: "projects/p/operations/op1", done: true, error: { code: 7, message: "pool failed" } }));

			vi.useFakeTimers();
			const promise = setupWIF(BASE_OPTIONS);
			const assertion = expect(promise).rejects.toThrow("Operation failed: pool failed");
			await vi.runAllTimersAsync();
			await assertion;
			vi.useRealTimers();
		});

		test("throws when the provider operation payload is done with an error", async () => {
			mockFetch
				.mockResolvedValueOnce(jsonResponse({ projectNumber: "123" }))
				.mockResolvedValueOnce(jsonResponse({ name: "p/op1", done: true }))
				.mockResolvedValueOnce(jsonResponse({ name: "p/op2", done: true, error: { code: 7, message: "provider op failed" } }));

			await expect(setupWIF(BASE_OPTIONS)).rejects.toThrow("Operation failed: provider op failed");
		});
		test("rethrows non-409 provider errors", async () => {
			mockFetch
				.mockResolvedValueOnce(jsonResponse({ projectNumber: "123" }))
				.mockResolvedValueOnce(jsonResponse({ name: "p/op1", done: true }))
				.mockResolvedValueOnce(jsonResponse({ error: { message: "provider forbidden" } }, 403));

			await expect(setupWIF(BASE_OPTIONS)).rejects.toThrow(GcpApiError);
		});
	});

	describe("long-running operation polling", () => {
		test("polls until operation is done when initial response is pending", async () => {
			// Pool creation returns pending; needs a poll round-trip before being done
			const pendingOp = { name: "projects/p/locations/global/workloadIdentityPools/pool/operations/op", done: false };
			const doneOp = { name: "projects/p/locations/global/workloadIdentityPools/pool/operations/op", done: true };

			mockFetch
				.mockResolvedValueOnce(jsonResponse({ projectNumber: "123" }))
				// createPool returns pending operation
				.mockResolvedValueOnce(jsonResponse(pendingOp))
				// poll: done
				.mockResolvedValueOnce(jsonResponse(doneOp))
				// createProvider returns done immediately (no poll)
				.mockResolvedValueOnce(jsonResponse({ name: "p/op2", done: true }))
				.mockResolvedValueOnce(jsonResponse({ bindings: [], etag: "e" }))
				.mockResolvedValueOnce(jsonResponse({}));

			vi.useFakeTimers();
			const promise = setupWIF(BASE_OPTIONS);

			// Advance timers to trigger the polling delay
			await vi.runAllTimersAsync();

			const result = await promise;
			expect(result.wifProvider).toContain("github-actions");
			vi.useRealTimers();
		});

		test("polls provider operation when provider creation returns pending", async () => {
			const pendingProviderOp = {
				name: "projects/p/locations/global/workloadIdentityPools/pool/providers/provider/operations/op2",
				done: false,
			};
			const doneProviderOp = {
				name: "projects/p/locations/global/workloadIdentityPools/pool/providers/provider/operations/op2",
				done: true,
			};

			mockFetch
				.mockResolvedValueOnce(jsonResponse({ projectNumber: "123" }))
				// createPool immediate done
				.mockResolvedValueOnce(jsonResponse({ name: "p/op1", done: true }))
				// createProvider pending -> must poll
				.mockResolvedValueOnce(jsonResponse(pendingProviderOp))
				// provider poll done
				.mockResolvedValueOnce(jsonResponse(doneProviderOp))
				.mockResolvedValueOnce(jsonResponse({ bindings: [], etag: "e" }))
				.mockResolvedValueOnce(jsonResponse({}));

			vi.useFakeTimers();
			const promise = setupWIF(BASE_OPTIONS);
			await vi.runAllTimersAsync();
			await expect(promise).resolves.toMatchObject({ projectNumber: "123" });
			vi.useRealTimers();
		});

		test("times out when the operation never reaches done", async () => {
			const pendingOp = { name: "projects/p/locations/global/workloadIdentityPools/pool/operations/op", done: false };
			mockFetch.mockImplementation(() => jsonResponse(pendingOp));
			mockFetch
				.mockResolvedValueOnce(jsonResponse({ projectNumber: "123" }))
				.mockResolvedValueOnce(jsonResponse(pendingOp));

			vi.useFakeTimers();
			const promise = setupWIF(BASE_OPTIONS);
			const assertion = expect(promise).rejects.toThrow(/Operation timed out after 60 s/);
			await vi.advanceTimersByTimeAsync(62_000);
			await assertion;
			vi.useRealTimers();
		});

		describe("URL validation in pollOperation", () => {
			test("accepts https URLs with iam.googleapis.com hostname", async () => {
				mockFetch
					.mockResolvedValueOnce(jsonResponse({ projectNumber: "123" }))
					.mockResolvedValueOnce(jsonResponse({ name: "p/op1", done: true }))
					.mockResolvedValueOnce(jsonResponse({ name: "p/op2", done: true }))
					.mockResolvedValueOnce(jsonResponse({ bindings: [], etag: "e" }))
					.mockResolvedValueOnce(jsonResponse({}));

				vi.useFakeTimers();
				const promise = setupWIF(BASE_OPTIONS);
				await vi.runAllTimersAsync();
				await expect(promise).resolves.toMatchObject({ projectNumber: "123" });
				vi.useRealTimers();
			});

			test("rejects URLs with non-Google hostnames", async () => {
				mockFetch
					.mockResolvedValueOnce(jsonResponse({ projectNumber: "123" }))
					// Return a full URL with non-Google hostname
					.mockResolvedValueOnce(
						jsonResponse({
							name: "https://evil.com/v1/operation",
							done: false,
						}),
					);

				vi.useFakeTimers();
				const promise = setupWIF(BASE_OPTIONS);
				const assertion = expect(promise).rejects.toThrow(
					/Invalid operation URL: hostname must be a Google API endpoint/,
				);
				await vi.runAllTimersAsync();
				await assertion;
				vi.useRealTimers();
			});

			test("rejects URLs with google.com in path but wrong hostname", async () => {
				mockFetch
					.mockResolvedValueOnce(jsonResponse({ projectNumber: "123" }))
					// Try to trick with "google.com" in the URL but at attacker.com
					.mockResolvedValueOnce(
						jsonResponse({
							name: "https://attacker.com/google.com/operation",
							done: false,
						}),
					);

				vi.useFakeTimers();
				const promise = setupWIF(BASE_OPTIONS);
				const assertion = expect(promise).rejects.toThrow(
					/Invalid operation URL: hostname must be a Google API endpoint/,
				);
				await vi.runAllTimersAsync();
				await assertion;
				vi.useRealTimers();
			});

			test("accepts URLs with googleapis.com subdomains", async () => {
				mockFetch
					.mockResolvedValueOnce(jsonResponse({ projectNumber: "123" }))
					.mockResolvedValueOnce(
						jsonResponse({
							name: "https://custom.googleapis.com/v1/operation",
							done: true,
						}),
					)
					.mockResolvedValueOnce(jsonResponse({ name: "p/op2", done: true }))
					.mockResolvedValueOnce(jsonResponse({ bindings: [], etag: "e" }))
					.mockResolvedValueOnce(jsonResponse({}));

				vi.useFakeTimers();
				const promise = setupWIF(BASE_OPTIONS);
				await vi.runAllTimersAsync();
				await expect(promise).resolves.toMatchObject({ projectNumber: "123" });
				vi.useRealTimers();
			});

			test("rejects malformed URLs", async () => {
				mockFetch
					.mockResolvedValueOnce(jsonResponse({ projectNumber: "123" }))
					.mockResolvedValueOnce(
						jsonResponse({
							name: "https://not a valid url at all",
							done: false,
						}),
					);

				vi.useFakeTimers();
				const promise = setupWIF(BASE_OPTIONS);
				const assertion = expect(promise).rejects.toThrow(
					/Invalid operation URL: hostname must be a Google API endpoint/,
				);
				await vi.runAllTimersAsync();
				await assertion;
				vi.useRealTimers();
			});

			test("accepts regular operation names without http prefix", async () => {
				mockFetch
					.mockResolvedValueOnce(jsonResponse({ projectNumber: "123" }))
					.mockResolvedValueOnce(jsonResponse({ name: "p/op1", done: true }))
					// Regular operation name should NOT trigger URL validation
					.mockResolvedValueOnce(jsonResponse({ name: "projects/p/operations/op2", done: true }))
					.mockResolvedValueOnce(jsonResponse({ bindings: [], etag: "e" }))
					.mockResolvedValueOnce(jsonResponse({}));

				vi.useFakeTimers();
				const promise = setupWIF(BASE_OPTIONS);
				await vi.runAllTimersAsync();
				await expect(promise).resolves.toMatchObject({ projectNumber: "123" });
				vi.useRealTimers();
			});
		});;
	});
});

describe("grantDrivePermissions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetAccessToken.mockResolvedValue({ token: "fake-access-token" });
		mockGetClient.mockResolvedValue({ getAccessToken: mockGetAccessToken });
		MockGoogleAuth.mockImplementation(function () {
			return { getClient: mockGetClient };
		});
	});

	test("adds drive.file binding when not already present", async () => {
		mockFetch
			.mockResolvedValueOnce(jsonResponse({ bindings: [], etag: "e" }))
			.mockResolvedValueOnce(jsonResponse({ bindings: [] }));

		await grantDrivePermissions({
			projectId: "my-project",
			serviceAccountEmail: "sa@my-project.iam.gserviceaccount.com",
		});

		// setIamPolicy was called
		expect(mockFetch).toHaveBeenCalledTimes(2);
		const setCall = mockFetch.mock.calls[1];
		const body = JSON.parse(setCall[1].body as string) as {
			policy: { bindings: Array<{ role: string; members: string[] }> };
		};
		expect(body.policy.bindings).toContainEqual({
			role: "roles/drive.file",
			members: ["serviceAccount:sa@my-project.iam.gserviceaccount.com"],
		});
	});

	test("does not call setIamPolicy if binding already exists", async () => {
		mockFetch.mockResolvedValueOnce(
			jsonResponse({
				bindings: [
					{
						role: "roles/drive.file",
						members: ["serviceAccount:sa@my-project.iam.gserviceaccount.com"],
					},
				],
				etag: "e",
			}),
		);

		await grantDrivePermissions({
			projectId: "my-project",
			serviceAccountEmail: "sa@my-project.iam.gserviceaccount.com",
		});

		// only getIamPolicy is called, no setIamPolicy
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	test("adds the service account to an existing drive.file binding when missing", async () => {
		mockFetch
			.mockResolvedValueOnce(
				jsonResponse({
					bindings: [
						{
							role: "roles/drive.file",
							members: ["serviceAccount:someone-else@my-project.iam.gserviceaccount.com"],
						},
					],
					etag: "e",
				}),
			)
			.mockResolvedValueOnce(jsonResponse({ bindings: [] }));

		await grantDrivePermissions({
			projectId: "my-project",
			serviceAccountEmail: "sa@my-project.iam.gserviceaccount.com",
		});

		const setCall = mockFetch.mock.calls[1];
		const body = JSON.parse(setCall[1].body as string) as {
			policy: { bindings: Array<{ role: string; members: string[] }> };
		};
		expect(body.policy.bindings[0].members).toContain(
			"serviceAccount:sa@my-project.iam.gserviceaccount.com",
		);
	});

	test("passes keyFilePath to GoogleAuth", async () => {
		mockFetch
			.mockResolvedValueOnce(jsonResponse({ bindings: [], etag: "e" }))
			.mockResolvedValueOnce(jsonResponse({}));

		await grantDrivePermissions({
			projectId: "my-project",
			serviceAccountEmail: "sa@my-project.iam.gserviceaccount.com",
			keyFilePath: "/tmp/key.json",
		});

		expect(MockGoogleAuth).toHaveBeenCalledWith(
			expect.objectContaining({ keyFilename: "/tmp/key.json" }),
		);
	});
});

describe("GcpApiError", () => {
	test("has correct name and status", () => {
		const err = new GcpApiError("Permission denied", 403);
		expect(err.name).toBe("GcpApiError");
		expect(err.status).toBe(403);
		expect(err.message).toBe("Permission denied");
		expect(err).toBeInstanceOf(Error);
	});

	test("handles full https://iam.googleapis.com operation URL in setupWIF", async () => {
		mockFetch
			.mockResolvedValueOnce(jsonResponse({ projectNumber: "123456789" }))
			.mockResolvedValueOnce(
				jsonResponse({
					name: "https://iam.googleapis.com/v1/projects/proj/locations/global/workloadIdentityPools/pool/operations/op1",
					done: true,
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					name: "https://iam.googleapis.com/v1/projects/proj/locations/global/workloadIdentityPools/pool/operations/op2",
					done: true,
				}),
			)
			.mockResolvedValueOnce(jsonResponse({ bindings: [], etag: "etag1" }))
			.mockResolvedValueOnce(jsonResponse({ bindings: [] }));

		const result = await setupWIF(BASE_OPTIONS);
		expect(result.poolId).toBe("github-actions");
	});
});
