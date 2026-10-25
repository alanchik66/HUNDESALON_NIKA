/**
 * Remove obsolete service gateway configuration from Pages.
 * The production runtime uses only OPENAI_API_KEY and the server-fixed approved model.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { ACCOUNT_ID } from './lib/cloudflare-auth.mjs';
import { resolveDeployToken } from './lib/cf-api-token.mjs';

const PROJECT = 'hundesalon-nika';
const wrangler = path.resolve('node_modules/wrangler/bin/wrangler.js');
const REMOVE = [
  'OPENROUTER_API_KEY',
  'SERVICE_GATEWAY_API_KEY',
  'SERVICE_GATEWAY_SITE_URL',
  'SERVICE_GATEWAY_SITE_NAME',
  'SERVICE_GATEWAY_DEFAULT_MODEL',
  'SERVICE_GATEWAY_FALLBACK_MODEL',
];

const token = await resolveDeployToken(PROJECT);
const env = {
  ...process.env,
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || ACCOUNT_ID,
  ...(token ? { CLOUDFLARE_API_TOKEN: token } : {}),
};

for (const name of REMOVE) {
  const result = spawnSync(
    process.execPath,
    [wrangler, 'pages', 'secret', 'delete', name, '--project-name', PROJECT],
    { encoding: 'utf8', input: 'y\n', env }
  );
  if (result.status !== 0) {
    const out = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    if (!out || /not found|does not exist|Unknown secret/i.test(out)) {
      console.log(`skip ${name} (not set)`);
      continue;
    }
    throw new Error(`Failed to delete ${name}: ${out}`);
  }
  console.log(`deleted ${name}`);
}

console.log('Done. The production AI runtime now uses only OPENAI_API_KEY.');
