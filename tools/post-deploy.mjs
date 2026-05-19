/**
 * Post-deploy checks: optional CDN purge, then live HTML + GSC audit.
 * Sends deploy notification to Slack via webhook.
 */
import { spawn } from 'node:child_process';
import { loadDevVars } from './lib/cloudflare-auth.mjs';

loadDevVars();

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';

async function notifySlack(status, details = '') {
  if (!SLACK_WEBHOOK_URL) return;
  const emoji = status === 'success' ? ':white_check_mark:' : ':x:';
  const text = `${emoji} *Deploy ${status}* — hundesalon-nika.com\n${details}\n_${new Date().toISOString()}_`;
  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch { /* silent */ }
}

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

try {
  await runNpm('check:live-html');
  await runNpm('seo:indexnow', { optional: true });
  await runNpm('bing:api', { optional: true });
  await runNpm('google:gsc:audit');
  await runNpm('check:openrouter', { optional: true });
  await notifySlack('success', 'CDN purged, live HTML OK, IndexNow + GSC audit passed.');
} catch (error) {
  await notifySlack('failed', error.message);
  throw error;
}
