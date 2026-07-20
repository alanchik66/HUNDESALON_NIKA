/**
 * Open Cloudflare dashboard — create HUNDESALON_NIKA — Automation token.
 * Alias for cf:open-unified-token.
 */
import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
spawn(npmCommand, ['run', 'cf:open-unified-token'], { stdio: 'inherit', shell: true });
