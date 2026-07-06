/**
 * One-shot Bing URL API setup: launch Edge CDP → fetch API key → test submit.
 */
console.log('Bing URL API setup…');
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getJson, openBingWebmasterSession } from './lib/browser-cdp.mjs';
import { upsertDevVar } from './lib/cloudflare-auth.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.BING_MAIL_EDGE_PORT || process.env.BING_EDGE_PORT || 9224);
const siteQ = encodeURIComponent('https://hundesalon-nika.com/');
const mailAccount = 'snaiper1984@mail.ru';
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

async function ensureCdp() {
  try {
    await getJson(`http://127.0.0.1:${port}/json/version`);
    return true;
  } catch {
    // continue
  }

  const candidates = [
    path.join(process.env.ProgramFiles || '', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
  ].filter(existsSync);

  if (!candidates.length) {
    console.error('Microsoft Edge not found.');
    process.exit(1);
  }

  const userDataDir = path.join(process.env.TEMP || '.', 'hundesalon-nika-edge-debug');
  const startUrl = `https://www.bing.com/webmasters/settings/apiaccess?siteUrl=${siteQ}`;

  spawn(
    candidates[0],
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      startUrl,
    ],
    { detached: true, stdio: 'ignore' }
  ).unref();

  console.log(`Starting Edge (port ${port})…`);

  for (let i = 0; i < 24; i += 1) {
    try {
      await getJson(`http://127.0.0.1:${port}/json/version`);
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return false;
}

if (!(await ensureCdp())) {
  console.error(`Edge CDP not ready on port ${port}.`);
  console.error('Run manually: npm run bing:edge → sign in as mail.ru → npm run bing:fetch-api-key');
  process.exit(1);
}

async function readAccount(session) {
  return session.eval(`
    const body = document.body?.innerText || '';
    const emails = [...new Set([...body.matchAll(/[\\w.+-]+@[\\w.-]+\\.[a-z]{2,}/gi)].map(m => m[0].toLowerCase()))];
    const needsLogin = /sign in|войти|anmelden|login/i.test(body) && !/sign out|выйти|abmelden/i.test(body);
    return { emails, isMail: emails.some(e => e.includes('mail.ru')), needsLogin, url: location.href };
  `);
}

const report = { at: new Date().toISOString(), steps: {} };
const session = await openBingWebmasterSession({ port, siteQ, waitMs: 8000, reloadAttempts: 2 });

try {
  await session.nav('home');
  report.steps.account = await readAccount(session);

  if (!report.steps.account?.isMail) {
    console.log(`Waiting for ${mailAccount} sign-in in Edge (up to 90s)…`);
    console.log('If prompted: npm run bing:prefill-mail → enter password → continue here.');
    for (let i = 0; i < 18; i += 1) {
      await new Promise(r => setTimeout(r, 5000));
      await session.nav('home');
      report.steps.account = await readAccount(session);
      if (report.steps.account?.isMail) break;
    }
  }

  if (!report.steps.account?.isMail) {
    console.error(`Sign in to Bing Webmaster as ${mailAccount} in Edge, then rerun: npm run bing:api:setup`);
    console.error('Quick path: npm run bing:edge → npm run bing:prefill-mail → password → npm run bing:api:setup');
    process.exit(2);
  }

  await session.nav('settings/apiaccess');

  report.steps.apiPage = await session.eval(`
    clickMatch('accept|принять|agree|соглас');
    await sleep(1200);
    clickMatch('terms|условия|conditions');
    await sleep(800);
    let generate = clickMatch('generate api key|создать ключ api|generate key|сгенерировать ключ|new api key|создать api');
    if (!generate) generate = clickMatch('generate|создать|сгенерировать');
    await sleep(2500);
    clickMatch('copy|копировать|скопировать');
    await sleep(600);

    const candidates = [];
    for (const el of document.querySelectorAll('input, textarea, code, pre, [data-copy], [data-clipboard-text]')) {
      const value = el.value || el.textContent || el.getAttribute('data-clipboard-text') || el.getAttribute('data-copy') || '';
      const trimmed = (value || '').trim();
      if (trimmed.length >= 32) candidates.push(trimmed);
    }

    const body = document.body?.innerText || '';
    const bodyMatch = body.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);

    return {
      generateClicked: generate,
      candidates: [...new Set(candidates)].slice(0, 8),
      bodyMatch: bodyMatch ? bodyMatch[0] : '',
      url: location.href,
      sample: body.slice(0, 900),
    };
  `);

  const apiKey = extractKey(report.steps.apiPage?.candidates) || report.steps.apiPage?.bodyMatch || '';

  if (!apiKey) {
    const out = path.join(root, 'temp', 'bing-api-setup-report.json');
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
    console.error('Could not read API key from Bing Webmaster.');
    console.error('Open: https://www.bing.com/webmasters/settings/apiaccess');
    console.error(`Report: ${path.relative(root, out)}`);
    console.error('Paste key manually: npm run bing:set-api-key');
    process.exit(3);
  }

  upsertDevVar('BING_WEBMASTER_API_KEY', apiKey);
  report.saved = true;
  report.keyHint = `${apiKey.slice(0, 8)}…${apiKey.slice(-4)}`;
  console.log(`Saved BING_WEBMASTER_API_KEY (${report.keyHint}).`);
} finally {
  session.close();
}

const verify = spawn(process.execPath, [path.join(root, 'tools', 'bing-url-submit.mjs')], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

verify.on('close', code => {
  const out = path.join(root, 'temp', 'bing-api-setup-report.json');
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  process.exit(code || 0);
});
