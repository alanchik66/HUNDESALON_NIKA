#!/usr/bin/env node
/**
 * Read a Bing Webmaster API key through the current Settings panel and save it
 * to the gitignored .dev.vars file. Key generation requires --generate.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  bingApiKeyFingerprint,
  openBingApiAccess,
  readOrGenerateBingApiKey,
} from './lib/bing-api-access.mjs';
import { getJson, openBingWebmasterSession } from './lib/browser-cdp.mjs';
import { upsertDevVar } from './lib/cloudflare-auth.mjs';
import { SITE_HOST, SITE_URL, siteQuery } from './lib/bing-wmt.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.BING_MAIL_EDGE_PORT || process.env.BING_EDGE_PORT || 9224);
const siteQ = siteQuery(SITE_URL);
const allowGenerate = process.argv.includes('--generate');
const reportPath = path.join(root, 'temp', 'bing-fetch-api-key-report.json');
const report = { at: new Date().toISOString(), allowGenerate, steps: {} };

function writeReport() {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

async function main() {
  try {
    await getJson(`http://127.0.0.1:${port}/json/version`);
  } catch {
    const error = new Error(`Edge CDP is not available on port ${port}. Run: npm run bing:edge`);
    error.code = 'BING_CDP_NOT_READY';
    throw error;
  }

  const session = await openBingWebmasterSession({ port, siteQ, waitMs: 2500, reloadAttempts: 2 });
  try {
    report.steps.access = await openBingApiAccess(session, { expectedHost: SITE_HOST });
    const credential = await readOrGenerateBingApiKey(session, { allowGenerate });
    report.steps.credential = {
      hasApiKeyControl: credential.hasApiKeyControl,
      hasReadableKey: credential.hasReadableKey,
      keyLength: credential.keyLength,
      canGenerate: credential.canGenerate,
      canView: credential.canView,
      action: credential.action,
      confirmation: credential.confirmation,
    };

    if (!credential.apiKey) {
      const error = new Error(
        credential.canGenerate && !allowGenerate
          ? 'No API key exists for this Bing Webmaster account. Creation was not attempted without --generate.'
          : 'Bing Webmaster did not expose a readable API key after the requested action.'
      );
      error.code = credential.canGenerate && !allowGenerate
        ? 'BING_API_KEY_GENERATION_REQUIRED'
        : 'BING_API_KEY_NOT_READABLE';
      throw error;
    }

    upsertDevVar('BING_WEBMASTER_API_KEY', credential.apiKey);
    report.saved = true;
    report.fingerprint = bingApiKeyFingerprint(credential.apiKey);
    writeReport();

    console.log(`Saved BING_WEBMASTER_API_KEY to .dev.vars (SHA-256: ${report.fingerprint}).`);
    console.log(`Report: ${path.relative(root, reportPath)}`);
    console.log('Next: npm run bing:api');
  } finally {
    session.close();
  }
}

main().catch(error => {
  report.error = { code: error.code || 'BING_API_KEY_FETCH_FAILED', message: error.message };
  writeReport();
  console.error(error.message);
  if (error.code === 'BING_API_KEY_GENERATION_REQUIRED') {
    console.error('After explicit approval, run: npm run bing:fetch-api-key -- --generate');
  }
  console.error(`Report: ${path.relative(root, reportPath)}`);
  process.exitCode = error.code === 'BING_SESSION_NOT_READY' ? 2 : 1;
});
