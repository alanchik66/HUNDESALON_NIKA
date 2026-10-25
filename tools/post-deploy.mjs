/**
 * Post-deploy checks: optional CDN purge, then live HTML + GSC audit.
 * Sends deploy notifications to the configured Telegram operations channel.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadDevVars } from './lib/cloudflare-auth.mjs';
import { sendTelegramMessage, siteNotificationsEnabled } from '../functions/_lib/platform-integrations.js';
import { hasBingApiKey } from './lib/bing-api.mjs';

loadDevVars();

if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
  delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
}

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

async function notifyTelegram(status, details = '') {
  if (!siteNotificationsEnabled(process.env)) return;
  const ok = status === 'success';
  const title = ok ? '✅ Деплой успешно завершён' : '⚠️ Ошибка post-deploy проверки';
  const text = `${title} — hundesalon-nika.com\n${details}\n${new Date().toISOString()}`;
  try {
    const result = await sendTelegramMessage(process.env, { text, category: 'messages' });
    if (!result?.ok) {
      console.error('[post-deploy] Telegram notification was not accepted', JSON.stringify({ status: result?.status || 0 }));
    }
  } catch (error) {
    console.error('[post-deploy] Telegram notification failed', String(error?.name || 'Error').slice(0, 80));
  }
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

await runNpm('cf:ensure-api-token', { optional: true });
await runNpm('cf:purge-cache', { optional: true });

try {
  await runNpm('check:live-html');
  await runNpm('check:live-prays-list');
  await runNpm('price:smoke:prod', { optional: true });
  await runNpm('seo:indexnow', { optional: true });
  if (hasBingApiKey()) {
    await runNpm('bing:api', { optional: true });
  }
  await runNpm('google:gsc:audit');
  await runNpm('check:message-draft', { optional: true });
  await notifyTelegram('success', 'CDN очищен, live HTML в норме, IndexNow и аудит GSC выполнены.');
} catch (error) {
  await notifyTelegram('failed', `Этап проверки: ${String(error.message || 'неизвестная ошибка').slice(0, 240)}`);
  throw error;
}
