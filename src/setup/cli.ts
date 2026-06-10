/**
 * gst-setup-wif – Interactive CLI for configuring Workload Identity Federation.
 *
 * Usage:
 *   npx -p @el-j/google-sheet-translations gst-setup-wif
 *   npx -p @el-j/google-sheet-translations gst-setup-wif \
 *     --project=my-gcp-project \
 *     --service-account=deploy@my-gcp-project.iam.gserviceaccount.com \
 *     --repo=myorg/myrepo \
 *     --key-file=./service-account-key.json
 */

import * as readline from "readline";
import { setupWIF, grantDrivePermissions, type WifSetupOptions } from "./wifSetup.js";

// ── ANSI helpers ──────────────────────────────────────────────────────────────

const isTTY = process.stdout.isTTY;
const ansi = (code: string) => (isTTY ? `\x1b[${code}m` : "");

const reset = ansi("0");
const bold = (s: string) => `${ansi("1")}${s}${reset}`;
const dim = (s: string) => `${ansi("2")}${s}${reset}`;
const cyan = (s: string) => `${ansi("36")}${s}${reset}`;
const green = (s: string) => `${ansi("32")}${s}${reset}`;
const yellow = (s: string) => `${ansi("33")}${s}${reset}`;
const red = (s: string) => `${ansi("31")}${s}${reset}`;

// ── arg parsing ───────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): Record<string, string> {
	const result: Record<string, string> = {};
	for (const arg of argv.slice(2)) {
		const m = arg.match(/^--([^=]+)(?:=(.*))?$/);
		if (m) {
			result[m[1]] = m[2] ?? "true";
		}
	}
	return result;
}

// ── interactive prompt ────────────────────────────────────────────────────────

function ask(rl: readline.Interface, question: string): Promise<string> {
	return new Promise((resolve) => rl.question(question, resolve));
}

async function askRequired(
	rl: readline.Interface,
	label: string,
	defaultValue?: string,
): Promise<string> {
	const suffix = defaultValue ? ` ${dim(`(${defaultValue})`)} ` : " ";
	while (true) {
		const answer = (await ask(rl, cyan("? ") + label + suffix)).trim();
		const value = answer || defaultValue || "";
		if (value) return value;
		console.log(red("  This field is required."));
	}
}

// ── progress reporting ────────────────────────────────────────────────────────

let lastStepLength = 0;

function startStep(step: string): void {
	if (lastStepLength && isTTY) {
		// Overwrite the previous "⏳ …" line with a green tick
		process.stdout.write(`\r  ${green("✓")} ${" ".repeat(lastStepLength)}\n`);
	} else if (lastStepLength) {
		process.stdout.write(` ✓\n`);
	}
	lastStepLength = step.length;
	process.stdout.write(`  ⏳ ${step}`);
}

function finishStep(): void {
	if (lastStepLength && isTTY) {
		process.stdout.write(`\r  ${green("✓")} ${" ".repeat(lastStepLength)}\n`);
	} else if (lastStepLength) {
		process.stdout.write(` ✓\n`);
	}
	lastStepLength = 0;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const args = parseArgs(process.argv);

	// --help
	if ("help" in args || "h" in args) {
		console.log(`
${bold("gst-setup-wif")} – Configure Workload Identity Federation for GitHub Actions

${bold("USAGE")}
  npx -p @el-j/google-sheet-translations gst-setup-wif [OPTIONS]

${bold("OPTIONS")}
  --project=ID              Google Cloud project ID
  --service-account=EMAIL   Service account email
  --repo=OWNER/REPO         GitHub repository (owner/repo)
  --key-file=PATH           Path to service account JSON key (optional if ADC is set)
  --pool-id=ID              WIF pool ID (default: github-actions)
  --provider-id=ID          OIDC provider ID (default: github-oidc)
  --grant-drive             Also grant roles/drive.file to the service account
  --non-interactive         Fail instead of prompting for missing values
  --help                    Show this help

${bold("EXAMPLES")}
  # Interactive mode (prompts for any missing values)
  npx -p @el-j/google-sheet-translations gst-setup-wif

  # Fully non-interactive
  npx -p @el-j/google-sheet-translations gst-setup-wif \\
    --project=my-gcp-project \\
    --service-account=deploy@my-gcp-project.iam.gserviceaccount.com \\
    --repo=myorg/myrepo \\
    --key-file=./sa-key.json
`);
		return;
	}

	const nonInteractive = "non-interactive" in args;

	console.log();
	console.log(bold("🔐 Google Sheet Translations — WIF Setup"));
	console.log(dim("─".repeat(52)));
	console.log();
	console.log(
		"This tool configures Workload Identity Federation (WIF) so that\n" +
			"GitHub Actions can authenticate with Google Cloud without storing\n" +
			"a long-lived service account key.",
	);
	console.log();

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: isTTY,
	});

	try {
		// ── collect required inputs ──────────────────────────────────────────

		if (nonInteractive && (!args["project"] || !args["service-account"] || !args["repo"])) {
			console.error(
				red("❌ --non-interactive requires --project, --service-account, and --repo"),
			);
			process.exit(1);
		}

		const projectId =
			args["project"] ?? (await askRequired(rl, "Google Cloud Project ID:"));
		const serviceAccountEmail =
			args["service-account"] ?? (await askRequired(rl, "Service Account Email:"));
		const githubRepo =
			args["repo"] ?? (await askRequired(rl, "GitHub Repository (owner/repo):"));
		const keyFilePath = args["key-file"];
		const poolId = args["pool-id"] ?? "github-actions";
		const providerId = args["provider-id"] ?? "github-oidc";
		const grantDrive = "grant-drive" in args;

		// basic validation
		if (!githubRepo.includes("/")) {
			console.error(red('\n❌ GitHub repository must be in "owner/repo" format.'));
			process.exit(1);
		}

		// ── confirm configuration ────────────────────────────────────────────

		console.log();
		console.log(bold("📋 Configuration"));
		console.log(`  Project ID:       ${cyan(projectId)}`);
		console.log(`  Service Account:  ${cyan(serviceAccountEmail)}`);
		console.log(`  GitHub Repo:      ${cyan(githubRepo)}`);
		if (keyFilePath) console.log(`  Key File:         ${cyan(keyFilePath)}`);
		if (poolId !== "github-actions") console.log(`  Pool ID:          ${cyan(poolId)}`);
		if (providerId !== "github-oidc") console.log(`  Provider ID:      ${cyan(providerId)}`);
		if (grantDrive) console.log(`  Grant Drive:      ${cyan("yes")}`);
		console.log();

		// ── run setup ────────────────────────────────────────────────────────

		const options: WifSetupOptions = {
			projectId,
			serviceAccountEmail,
			githubRepo,
			poolId,
			providerId,
			keyFilePath,
			onProgress: startStep,
		};

		const result = await setupWIF(options);
		finishStep();

		// optional Drive permissions
		if (grantDrive) {
			startStep("Granting roles/drive.file on the project...");
			await grantDrivePermissions({ projectId, serviceAccountEmail, keyFilePath });
			finishStep();
		}

		// ── success output ───────────────────────────────────────────────────

		console.log();
		console.log(green("✅ WIF Setup Complete!"));
		console.log();
		console.log(dim("═".repeat(70)));
		console.log();
		console.log(bold("📋 Set this GitHub Environment Variable:"));
		console.log();
		console.log(`  ${bold("Name:")}  ${yellow("WIF_PROVIDER")}`);
		console.log(`  ${bold("Value:")} ${green(result.wifProvider)}`);
		console.log();
		console.log(
			dim(
				"Navigate to: Repository → Settings → Environments → github-pages → Variables",
			),
		);
		console.log();
		console.log(dim("═".repeat(70)));
		console.log();
		console.log(bold("📁 Remaining manual step:"));
		console.log(
			`  Share your Google Drive folder with ${cyan(serviceAccountEmail)}\n` +
				"  and give it Editor access (Drive UI → Right-click folder → Share).",
		);
		console.log();
	} finally {
		rl.close();
	}
}

main().catch((err: unknown) => {
	// make sure any in-progress step line is terminated cleanly
	if (lastStepLength) process.stdout.write("\n");
	const message = err instanceof Error ? err.message : String(err);
	console.error(`\n${red("❌")} ${message}`);
	if (
		message.includes("Could not load the default credentials") ||
		message.includes("Failed to obtain")
	) {
		console.error(
			"\n💡 " +
				yellow("Tip:") +
				" Provide a service account key with " +
				cyan("--key-file=./path/to/sa-key.json") +
				"\n   or run: " +
				cyan("gcloud auth application-default login"),
		);
	}
	process.exit(1);
});
