# NPM Publishing Setup

This document explains how to create releases and publish to the npm registry.

## Prerequisites

Before publishing to npm, you need to set up an NPM_TOKEN secret in your GitHub repository:

1. **Create an npm Access Token**:
   - Log in to [npmjs.com](https://www.npmjs.com/)
   - Go to your profile settings → Access Tokens
   - Generate a new token with "Automation" type (for CI/CD)
   - Copy the token (you won't be able to see it again)

2. **Add the token to GitHub Secrets**:
   - Go to your repository on GitHub
   - Navigate to Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Paste your npm token
   - Click "Add secret"

## Creating a Release

To publish a new version to npm:

1. **Tag and Release via GitHub**:
   - Go to your repository on GitHub
   - Click on "Releases" → "Draft a new release"
   - Choose a tag (e.g., `v1.0.0`, `v1.1.0`, etc.)
   - Add release title and description
   - Click "Publish release"

2. **Automated Publishing**:
   - The GitHub Actions workflow will automatically:
     - Run tests
     - Build the package
     - Extract the version from the release tag
     - Publish to npm registry with proper versioning
     - Tag pre-releases with `next` tag, regular releases with `latest` tag

## Version Tagging

- **Stable releases**: Use tags like `v1.0.0`, `v1.1.0`, `v2.0.0`
  - These will be published with the `latest` tag on npm
  
- **Pre-releases**: Mark the release as "pre-release" on GitHub
  - These will be published with the `next` tag on npm
  - Users can install with: `npm install @el-j/google-sheet-translations@next`

## Manual Publishing (Not Recommended)

If you need to publish manually:

```bash
# Ensure you're logged in to npm
npm login

# Build the package
npm run build

# Publish
npm publish --access public
```

Note: The version in `package.json` will be overridden by the GitHub workflow based on the release tag.
