import fs from 'node:fs';
import path from 'node:path';

const bundlePath = path.resolve(process.cwd(), 'dist-action/index.mjs');

if (!fs.existsSync(bundlePath)) {
  throw new Error(`Action bundle not found at ${bundlePath}`);
}

let content = fs.readFileSync(bundlePath, 'utf8');

// Target the Google URL host sanitization pattern in google-auth-library
// to satisfy GitHub CodeQL security scanning
const targetRegex = /const url\s*=\s*\(opts\.url\s*\|\|\s*["']["']\)\.toString\(\);[\s\r\n]*if\s*\(!url\.includes\(["']googleapis\.com["']\)\s*&&\s*!url\.includes\(["']google\.com["']\)\)(?:\s*\{|\s*opts\.agent\s*=\s*await\s*this\.getCaAgent\(\);)/;

const replacement = `const url = (opts.url || "").toString();
        let isGoogleHost = false;
        try {
          const parsedUrl = new URL(url);
          const hostname = (parsedUrl.hostname || "").toLowerCase();
          isGoogleHost = hostname === "googleapis.com" || hostname.endsWith(".googleapis.com") || hostname === "google.com" || hostname.endsWith(".google.com");
        } catch {
          isGoogleHost = false;
        }
        if (!isGoogleHost) opts.agent = await this.getCaAgent();`;

if (!targetRegex.test(content)) {
  // If not found, check if it was already patched
  if (!content.includes('isGoogleHost')) {
    throw new Error('Expected host-check snippet not found in dist-action bundle');
  }
} else {
  content = content.replace(targetRegex, replacement);
  fs.writeFileSync(bundlePath, content, 'utf8');
  console.log('Successfully applied CodeQL host-check patch to dist-action/index.mjs');
}
