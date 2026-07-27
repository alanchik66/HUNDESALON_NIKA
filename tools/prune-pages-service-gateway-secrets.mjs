/**
 * Remove obsolete service gateway configuration from Pages.
 * Keeps the existing Gemini inference key; does not touch RESEND_API_KEY.
 */
import { spawnSync } from 'node:child_process';

const PROJECT = 'hundesalon-nika';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const REMOVE = [
  'SERVICE_GATEWAY_SITE_URL',
  'SERVICE_GATEWAY_SITE_NAME',
  'SERVICE_GATEWAY_DEFAULT_MODEL',
];

for (const name of REMOVE) {
  const result = spawnSync(
    npx,
    ['wrangler', 'pages', 'secret', 'delete', name, '--project-name', PROJECT],
    { encoding: 'utf8', input: 'y\n' }
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

console.log('Done. Remaining secrets should include SERVICE_GATEWAY_API_KEY only (+ RESEND if configured).');
