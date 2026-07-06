/**
 * Fetch Bing Webmaster API key via Edge CDP and save to .dev.vars.
 * Requires: npm run bing:edge → sign in as snaiper1984@mail.ru
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getJson, openBingWebmasterSession } from './lib/browser-cdp.mjs';
import { upsertDevVar } from './lib/cloudflare-auth.mjs';
import { MAIL_ACCOUNT, SITE_URL, siteQuery } from './lib/bing-wmt.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.BING_MAIL_EDGE_PORT || process.env.BING_EDGE_PORT || 9224);
const siteQ = siteQuery(SITE_URL);
const mailAccount = MAIL_ACCOUNT;

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function extractKey(payload) {
  if (!payload) return '';
  if (typeof payload === 'string') {
    const match = payload.match(UUID_RE);
    return match ? match[0] : '';
  }
  for (const value of Object.values(payload)) {
    const found = extractKey(value);
    if (found) return found;
  }
  return '';
}

try {
  await getJson(`http://127.0.0.1:${port}/json/version`);
} catch {
  console.error(`Edge CDP not on port ${port}. Run: npm run bing:edge`);
  console.error('Sign in as snaiper1984@mail.ru, then rerun: npm run bing:fetch-api-key');
  process.exit(1);
}

const report = { at: new Date().toISOString(), steps: {} };
const session = await openBingWebmasterSession({ port, siteQ, waitMs: 8000, reloadAttempts: 2 });

try {
  report.steps.account = await session.eval(`
    const body = document.body?.innerText || '';
    const emails = [...new Set([...body.matchAll(/[\\w.+-]+@[\\w.-]+\\.[a-z]{2,}/gi)].map(m => m[0].toLowerCase()))];
    return { emails, isMail: emails.some(e => e.includes('mail.ru')), url: location.href };
  `);

  const verified =
    /search performance|total clicks|hundesalon-nika/i.test(report.steps.account?.url || '') ||
    /hundesalon-nika/i.test(JSON.stringify(report.steps.account || {}));

  if (!report.steps.account?.isMail && !verified) {
    console.error(`Sign in to Bing Webmaster as ${mailAccount} in Edge (npm run bing:edge).`);
    console.error(JSON.stringify(report.steps.account, null, 2));
    process.exit(2);
  }

  const apiPaths = ['settings/apiaccess', 'settings/api', 'settings/user', 'settings'];
  let apiPage = null;

  for (const apiPath of apiPaths) {
    await session.nav(apiPath);
    apiPage = await session.eval(`
      const body = document.body?.innerText || '';
      return {
        path: '${apiPath}',
        url: location.href,
        hasApi: /api\\s*access|api\\s*key|ключ\\s*api|generate\\s*api/i.test(body),
        notFound: /not found|не найдено|страниц не найдено/i.test(body),
        sample: body.slice(0, 600),
      };
    `);
    report.steps[`probe_${apiPath.replace(/\//g, '_')}`] = apiPage;
    if (apiPage?.hasApi && !apiPage?.notFound) break;
  }

  report.steps.apiPage = await session.eval(`
    const accept = clickMatch('accept|принять|agree|соглас');
    await sleep(1500);
    const terms = clickMatch('terms|условия|conditions');
    await sleep(1000);
    let generate = clickMatch('generate api key|создать ключ api|generate key|сгенерировать ключ|new api key|создать api');
    if (!generate) generate = clickMatch('generate|создать|сгенерировать');
    await sleep(2500);
    const copy = clickMatch('copy|копировать|скопировать');
    await sleep(800);

    const candidates = [];
    for (const el of document.querySelectorAll('input, textarea, code, pre, [data-copy], [data-clipboard-text]')) {
      const value =
        el.value ||
        el.textContent ||
        el.getAttribute('data-clipboard-text') ||
        el.getAttribute('data-copy') ||
        '';
      const trimmed = (value || '').trim();
      if (trimmed.length >= 32) candidates.push(trimmed);
    }

    const body = document.body?.innerText || '';
    const bodyMatch = body.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

    return {
      acceptClicked: accept,
      termsClicked: terms,
      generateClicked: generate,
      copyClicked: copy,
      candidates: [...new Set(candidates)].slice(0, 8),
      bodyMatch: bodyMatch ? bodyMatch[0] : '',
      url: location.href,
      sample: body.slice(0, 900),
    };
  `);

  const apiKey =
    extractKey(report.steps.apiPage?.candidates) ||
    report.steps.apiPage?.bodyMatch ||
    '';

  if (!apiKey) {
    const out = path.join(root, 'temp', 'bing-fetch-api-key-report.json');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
    console.error('Could not read Bing API key from the page.');
    console.error('Open manually: https://www.bing.com/webmasters/settings/apiaccess');
    console.error(`Report: ${path.relative(root, out)}`);
    console.error('Then: npm run bing:set-api-key');
    process.exit(3);
  }

  upsertDevVar('BING_WEBMASTER_API_KEY', apiKey);
  report.saved = true;
  report.keyHint = `${apiKey.slice(0, 8)}…${apiKey.slice(-4)}`;

  const out = path.join(root, 'temp', 'bing-fetch-api-key-report.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Saved BING_WEBMASTER_API_KEY to .dev.vars (${report.keyHint}).`);
  console.log(`Report: ${path.relative(root, out)}`);
  console.log('Next: npm run bing:api');
} finally {
  session.close();
}
