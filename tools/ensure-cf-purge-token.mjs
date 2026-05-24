/** @deprecated Use npm run cf:ensure-api-token */
import { spawnSync } from 'node:child_process';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const r = spawnSync(npm, ['run', 'cf:ensure-api-token'], { stdio: 'inherit', shell: true });
process.exit(r.status ?? 1);
