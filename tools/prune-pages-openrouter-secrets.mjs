/**
 * Remove redundant OpenRouter Pages secrets (defaults live in functions/*.js).
 * Keeps OPENROUTER_API_KEY; does not touch RESEND_API_KEY.
 */
import { spawnSync } from 'node:child_process';

const PROJECT = 'hundesalon-nika';
const REMOVE = [
  'OPENROUTER_SITE_URL',
  'OPENROUTER_SITE_NAME',
  'OPENROUTER_DEFAULT_MODEL',
  'OPENROUTER_FALLBACK_MODEL',
];

for (const name of REMOVE) {
  const result = spawnSync(
    'npx',
    ['wrangler', 'pages', 'secret', 'delete', name, '--project-name', PROJECT],
    { encoding: 'utf8', shell: true, input: 'y\n' }
  );
  if (result.status !== 0) {
    const out = `${result.stdout}\n${result.stderr}`;
    if (/not found|does not exist|Unknown secret/i.test(out)) {
      console.log(`skip ${name} (not set)`);
      continue;
    }
    throw new Error(`Failed to delete ${name}: ${out}`);
  }
  console.log(`deleted ${name}`);
}

console.log('Done. Remaining secrets should include OPENROUTER_API_KEY only (+ RESEND if configured).');
