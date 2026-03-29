# Contributing to @el-j/google-sheet-translations

Thank you for your interest in contributing! This guide covers the conventions and workflow for this project.

## Conventional Commits

This project uses [Conventional Commits](https://www.conventionalcommits.org/) to automate semantic versioning and changelog generation via [semantic-release](https://semantic-release.gitbook.io/).

Every commit message **must** follow this format:

```
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

### Commit Types

| Type | Description | Version bump |
|------|-------------|-------------|
| `feat` | A new feature | **minor** |
| `fix` | A bug fix | **patch** |
| `perf` | A performance improvement | **patch** |
| `refactor` | Code refactoring (no feature/fix) | **patch** |
| `docs` | Documentation only | none |
| `style` | Formatting, white-space | none |
| `test` | Adding or updating tests | none |
| `build` | Build system changes | none |
| `ci` | CI/CD configuration changes | none |
| `chore` | Other changes | none |
| `revert` | Reverts a previous commit | **patch** |

### Breaking Changes → Major Version

Append `!` after the type or add `BREAKING CHANGE:` in the footer:

```
feat!: drop Node 14 support

BREAKING CHANGE: Minimum Node.js version is now 16.
```

### Examples

```bash
git commit -m "feat(sync): add retry logic for failed API calls"
git commit -m "fix(fileWriter): sanitize locale names before writing files"
git commit -m "docs: update README with bidirectional sync example"
git commit -m "chore(deps): update google-spreadsheet to v5"
git commit -m "feat!: rename getSpreadSheetData to fetchTranslations"
```

## Development Workflow

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run lint
npm run lint

# Build
npm run build
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-new-feature`
3. Commit using conventional commits
4. Push and open a PR against `main`
5. Ensure CI passes (tests, lint, build)

## Release Process

Releases are fully automated by semantic-release on every push to `main`. **Do not manually create GitHub releases or manually update `package.json` version.**

The semantic-release bot will:
- Determine the new version from commit messages
- Update `CHANGELOG.md`
- Create a git tag
- Create a GitHub release
- Publish to npm

## Release Gate & Branch Ruleset

Merges to `main` are protected by a branch ruleset (`.github/rulesets/main-branch.json`).
Before any PR can be merged, **all of the following status checks must pass**:

| Check | Workflow |
|-------|----------|
| `Quality Gate (Node 20)` | `release.yml` |
| `Quality Gate (Node 22)` | `release.yml` |
| `Quality Gate (Node 24)` | `release.yml` |
| `test (20)` | `ci.yml` |
| `test (22)` | `ci.yml` |
| `test (24)` | `ci.yml` |

Additionally, at least **1 pull-request review** is required.

To apply or update the ruleset from the stored JSON file, run the **Apply Branch Rulesets** workflow (`apply-ruleset.yml`) via GitHub Actions → Manual dispatch. You need an `ADMIN_TOKEN` secret (a fine-grained PAT with repo rule administration access).

## Changelog Preview

Before pushing a batch of commits, you can preview what the next changelog entry would look like:

```bash
npm run changelog:preview
```

This runs `semantic-release --dry-run` and prints the planned release notes without publishing anything. Requires `GITHUB_TOKEN` set in your environment for a complete preview.

## Docs Automation

Documentation is automatically rebuilt and deployed to [GitHub Pages](https://el-j.github.io/google-sheet-translations/) on every:

- Successful release (via `workflow_run` trigger in `docs.yml`)
- Push to `main` that changes `website/**`, `README.md`, or `CHANGELOG.md`
- Manual dispatch of the **Deploy Documentation** workflow

The `website/changelog.md` page automatically includes the root `CHANGELOG.md` via VitePress file includes — no manual sync needed.

See [Release Process guide](https://el-j.github.io/google-sheet-translations/guide/release-process) for the full pipeline.
