/**
 * Full www robots setup: verify redirect, optional zone-rules token.
 * npm run cf:www-robots-setup
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(script) {
  const r = spawnSync(npm, ['run', script], { cwd: root, stdio: 'inherit' });
  return r.status ?? 1;
}

const redirect = run('cf:www-robots-redirect');
if (redirect !== 0) process.exit(redirect);

const token = run('cf:ensure-api-token');
process.exit(token);
