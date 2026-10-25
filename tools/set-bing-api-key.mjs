#!/usr/bin/env node
/**
 * Save Bing Webmaster API key to .dev.vars (local post-deploy / bing:api).
 * Bing Webmaster -> Settings -> API access -> API Key.
 */
import fs from 'node:fs';
import { upsertDevVar } from './lib/cloudflare-auth.mjs';

const args = process.argv.slice(2);
const positional = args.filter(arg => !arg.startsWith('--'));

function readStdinIfPiped() {
  try {
    if (process.stdin.isTTY) return '';
    return fs.readFileSync(0, 'utf8').trim();
  } catch {
    return '';
  }
}

function looksLikeBingApiKey(value) {
  const key = String(value || '').trim();
  if (key.length < 32 || key.length > 80) return false;
  if (!/^[0-9a-f-]+$/i.test(key)) return false;
  return /^(?:[0-9a-f]{32,64}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(key);
}

const apiKey = String(process.env.BING_WEBMASTER_API_KEY || positional[0] || readStdinIfPiped()).trim();

if (!apiKey) {
  console.error('BING_WEBMASTER_API_KEY is missing.');
  console.error('');
  console.error('Option A - read an existing key from the verified Bing session:');
  console.error('  npm run bing:edge');
  console.error('  npm run bing:fetch-api-key');
  console.error('  To create a missing key after approval: npm run bing:fetch-api-key -- --generate');
  console.error('');
  console.error('Option B - manual:');
  console.error('  Bing Webmaster -> Settings -> API access -> API Key');
  console.error('  $env:BING_WEBMASTER_API_KEY="<key>"; npm run bing:set-api-key');
  console.error('  "<key>" | npm run bing:set-api-key');
  process.exit(2);
}

if (!looksLikeBingApiKey(apiKey)) {
  console.error('BING_WEBMASTER_API_KEY does not look like a Bing Webmaster API key (32-64 hex or UUID).');
  process.exit(2);
}

upsertDevVar('BING_WEBMASTER_API_KEY', apiKey);
console.log('Saved BING_WEBMASTER_API_KEY to .dev.vars (gitignored).');
console.log('Verify: npm run bing:api');
