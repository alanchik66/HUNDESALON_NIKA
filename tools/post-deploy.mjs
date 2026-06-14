/**
 * Post-deploy checks: optional CDN purge, then live HTML + GSC audit.
 * Sends deploy notification to Slack via webhook.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadDevVars } from './lib/cloudflare-auth.mjs';

loadDevVars();

if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
  delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
}

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';

function npmRunner() {
  if (process.env.npm_execpath && existsSync(process.env.npm_execpath)) {
    return { command: process.execPath, argsPrefix: [process.env.npm_execpath] };
  }

  const bundledNpm = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  if (existsSync(bundledNpm)) {
    return { command: process.execPath, argsPrefix: [bundledNpm] };
  }

  return { command: 'npm', argsPrefix: [] };
}

const npmCommand = npmRunner();

function childEnv() {
  const env = { ...process.env };
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    delete env.NODE_TLS_REJECT_UNAUTHORIZED;
  }
  return env;
}

async function notifySlack(status, details = '') {
  if (!SLACK_WEBHOOK_URL) return;
  const ok = status === 'success';
  const emoji = ok ? ':white_check_mark:' : ':x:';
  const title = ok ? 'Деплой успешно завершен' : 'Ошибка деплоя';
  const text = `${emoji} *${title}* — hundesalon-nika.com\n${details}\n_${new Date().toISOString()}_`;
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
    const child = spawn(npmCommand.command, [...npmCommand.argsPrefix, 'run', script], {
      stdio: 'inherit',
      env: childEnv(),
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
  await runNpm('check:message-draft', { optional: true });
  await notifySlack('success', 'CDN очищен, live HTML в норме, IndexNow и аудит GSC выполнены.');
} catch (error) {
  await notifySlack('failed', `Детали: ${error.message}`);
  throw error;
}
