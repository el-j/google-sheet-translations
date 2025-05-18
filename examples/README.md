# Google Sheet Translations Examples

This directory contains example code demonstrating how to use the Google Sheet Translations package.

## Prerequisites

Before running any examples, make sure you:

1. Create a `.env` file in this directory with your Google API credentials (you can copy `example.env` and fill in your details)
2. Have a Google Sheet set up with the appropriate structure (see the main README)

## Available Examples

### Basic Usage (`basic-usage.ts`)

Demonstrates basic usage of the package to fetch translations from a Google Sheet.

```bash
# Run with ts-node
npx ts-node basic-usage.ts
```

### Bidirectional Sync (`bidirectional-sync.ts`)

Shows how to use the bidirectional sync feature to push local changes back to the spreadsheet.

```bash
# Run with ts-node
npx ts-node bidirectional-sync.ts
```

### Auto-Translation Feature (`auto-translation-example.ts`)

Demonstrates the auto-translation feature that automatically adds Google Translate formulas for missing translations.

```bash
# Run with ts-node
npx ts-node auto-translation-example.ts
```

This example:
1. Fetches initial translations
2. Simulates adding new translation keys locally
3. Pushes changes back with auto-translation enabled

The auto-translation feature will add Google Translate formulas in the spreadsheet for any missing translations of a new key.

### Next.js Integration (`nextjs-instrumentation.ts`)

Shows how to use Google Sheet Translations in a Next.js project using the instrumentation feature.

## Running Examples

To run any example, install the dependencies first:

```bash
# From the project root
npm install

# Then run the example
npx ts-node examples/auto-translation-example.ts
```

## What to Expect

When running the examples, you should see output in your terminal showing the various steps of the process. If you have access to the Google Sheet, you can also see the changes being made in real-time.

For the auto-translation example, you'll see new rows being added to your spreadsheet with Google Translate formulas automatically inserted for missing translations.
