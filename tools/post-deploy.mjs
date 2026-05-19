/**
 * Post-deploy checks: optional CDN purge, then live HTML + GSC audit.
 */
import { spawn } from 'node:child_process';
import { loadDevVars } from './lib/cloudflare-auth.mjs';

loadDevVars();

function runNpm(script, { optional = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', script], {
      stdio: 'inherit',
      shell: true,
      env: process.env,
    });

    child.on('close', code => {
      if (code === 0) return resolve();
      if (optional) {
        console.warn(`[post-deploy] skipped ${script} (exit ${code})`);
        return resolve();
      }
      reject(new Error(`${script} failed with exit ${code}`));
    });
  });
}

await runNpm('cf:ensure-purge-token', { optional: true });
await runNpm('cf:purge-cache', { optional: true });
await runNpm('check:live-html');
await runNpm('google:gsc:audit');
await runNpm('check:openrouter');
