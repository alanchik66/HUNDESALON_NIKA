/** @deprecated Use npm run cf:set-api-token */
import { spawnSync } from 'node:child_process';
const token = process.argv[2];
if (!token) {
  console.error('Usage: npm run cf:set-api-token -- <token>');
  process.exit(1);
}
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const r = spawnSync(npm, ['run', 'cf:set-api-token', '--', token], { stdio: 'inherit', shell: true });
process.exit(r.status ?? 1);
