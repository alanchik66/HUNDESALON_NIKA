/** @deprecated Use npm run cf:open-api-token */
import { spawnSync } from 'node:child_process';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
spawnSync(npm, ['run', 'cf:open-api-token'], { stdio: 'inherit', shell: true });
