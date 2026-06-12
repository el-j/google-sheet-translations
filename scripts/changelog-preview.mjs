#!/usr/bin/env node
/**
 * changelog-preview.mjs
 *
 * Runs semantic-release in dry-run mode and prints what the next changelog
 * entry would look like without actually publishing anything.
 *
 * Usage:
 *   npm run changelog:preview
 *   node scripts/changelog-preview.mjs
 */

import { execSync } from 'node:child_process'

console.log('🔍 Running semantic-release dry-run to preview next changelog entry…\n')

try {
  const output = execSync('npx semantic-release --dry-run --no-ci', {
    encoding: 'utf8',
    env: {
      ...process.env,
      // Ensure we don't accidentally publish
      NPM_TOKEN: process.env.NPM_TOKEN || 'dry-run-token',
      GITHUB_TOKEN: process.env.GITHUB_TOKEN || 'dry-run-token',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  // Extract the relevant sections from the dry-run output
  const lines = output.split('\n')
  let inNotes = false
  const notes = []

  for (const line of lines) {
    if (line.includes('Release note for version')) {
      inNotes = true
    }
    if (inNotes) {
      notes.push(line)
    }
    if (inNotes && line.trim() === '' && notes.length > 3) {
      break
    }
  }

  if (notes.length > 0) {
    console.log('📋 Next release preview:\n')
    console.log(notes.join('\n'))
  } else {
    console.log('ℹ️  Full dry-run output:')
    console.log(output)
  }
} catch (err) {
  const output = err.stdout?.toString() || ''
  const stderr = err.stderr?.toString() || ''

  // Check if "no release" was determined
  if (output.includes('no release') || stderr.includes('no release') ||
      output.includes('There are no relevant changes') || stderr.includes('There are no relevant changes')) {
    console.log('ℹ️  No release would be triggered by current commits.')
    console.log('   Add a conventional commit with type feat/fix/perf/refactor to trigger a release.')
  } else {
    console.error('⚠️  dry-run exited with error (this is normal without GitHub credentials):')
    console.error(stderr || err.message)
    console.log('\nTip: Set GITHUB_TOKEN and NPM_TOKEN env vars for a full dry-run.')
  }
}
