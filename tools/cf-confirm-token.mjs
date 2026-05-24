/** Continue after manual Cloudflare token edit. npm run cf:confirm-token */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'cf-interactive-token.mjs');
const child = spawn(process.execPath, [script, 'confirm'], { stdio: 'inherit' });
child.on('exit', code => process.exit(code ?? 1));
