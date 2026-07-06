/**
 * Bing Webmaster URL API — optional layer on top of IndexNow.
 * IndexNow already notifies Bing (and Yandex); API adds batch SubmitUrl when a key is set.
 */
import { loadDevVars } from './cloudflare-auth.mjs';

export const BING_INDEXNOW_COVERAGE =
  'IndexNow уже уведомляет Bing (apex + www). Bing URL API — опциональное дополнение для batch SubmitUrl.';

export function getBingApiKey() {
  loadDevVars();
  return String(process.env.BING_WEBMASTER_API_KEY || process.env.BING_API_KEY || '').trim();
}

export function hasBingApiKey() {
  return Boolean(getBingApiKey());
}

/** Calm one-liner for pipelines when API key is not configured (not an error). */
export function logBingApiNotConfigured({ verbose = false } = {}) {
  console.log(`Bing URL API: не настроен — ${BING_INDEXNOW_COVERAGE}`);
  if (verbose) {
    console.log('Настройка (опционально): npm run bing:api:setup  или  npm run bing:set-api-key');
  }
}
