import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => readFileSync(path.join(ROOT, relativePath), 'utf8');
const locales = ['de', 'en', 'ru', 'uk'];
const SENDPULSE_LOADER = '//web.webpushs.com/js/push/ad3860c1c56016022bf413f3d7ab36f6_1.js';
const SENDPULSE_WORKER = 'https://web.webpushs.com/sp-push-worker-fb.js?ver=2.0';

test('SendPulse Web Push and PWA share one root-scoped worker', () => {
  const pwa = read('assets/js/pwa.js');
  const pwaWorker = read('sp-push-worker-fb.js');
  const cacheWorker = read('sw.js');

  assert.match(pwa, /navigator\.serviceWorker\.register\('\/sp-push-worker-fb\.js', \{ updateViaCache: 'none' \}\)/);
  assert.doesNotMatch(pwa, /navigator\.serviceWorker\.register\('\/sw\.js'/);
  assert.match(pwaWorker, /importScripts\('\/sw\.js'\)/);
  assert.match(pwaWorker, new RegExp(SENDPULSE_WORKER.replace(/[.?]/g, '\\$&')));
  assert.match(cacheWorker, /key\.startsWith\('hundesalon-nika-static-'\) && key !== CACHE_NAME/);
});

test('production output has the exact opt-in loader and required CSP permissions', () => {
  const build = read('tools/build-production.js');
  const headers = read('_headers');

  assert.match(build, /'sp-push-worker-fb\.js'/);
  assert.match(build, new RegExp(SENDPULSE_LOADER.replace(/[.?]/g, '\\$&')));
  assert.match(build, /const pushHomePages = new Set\(\['de\/index\.html', 'en\/index\.html', 'ru\/index\.html', 'uk\/index\.html'\]\)/);
  for (const origin of [
    'https://web.webpushs.com',
    'https://hundesalon-nika.spulse.net',
    'https://pushdata.sendpulse.com:4434',
    'https://click.pushpush.io',
    'https://fcm.googleapis.com',
    'https://android.googleapis.com',
  ]) {
    assert.ok(headers.includes(origin), `missing CSP origin: ${origin}`);
  }
  assert.match(headers, /\/sp-push-worker-fb\.js\n  Cache-Control: public, max-age=0, must-revalidate/);
});

test('each homepage offers an explicit localized opt-in and documents it locally', () => {
  for (const locale of locales) {
    const index = read(`${locale}/index.html`);
    const privacy = read(`${locale}/datenschutz.html`);

    assert.match(index, /<button type="button" class="btn-neon sp_notify_prompt"/);
    assert.match(index, /newsletter-push-note/);
    assert.match(privacy, /SendPulse/);
    assert.match(privacy, /https:\/\/sendpulse\.com\/legal\/processing/);
  }
});
