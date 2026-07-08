/**
 * Consolidate Bing Webmaster to snaiper1984@mail.ru only.
 *
 * Phases (argv):
 *   gmail-remove-site  — logged in as @gmail.com: delete hundesalon-nika.com property
 *   gmail-signout      — sign out Microsoft session
 *   mail-setup         — logged in as @mail.ru: users, sitemap, indexnow, inspection
 *   status             — show current profile email on active port (default)
 *   gmail-status       — status on Gmail Edge port 9225
 *   mail-status        — status on mail.ru Edge port 9224
 *   auto               — detect account on open tab; gmail-remove+signout OR mail-setup
 *
 * Edge CDP port 9224. For gmail phase: npm run bing:edge-gmail then sign in as gmail.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { BING_HOME_URL, GMAIL_ACCOUNT, MAIL_ACCOUNT, SITE_HOST, SITE_URL } from './lib/bing-wmt.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const phase = process.argv[2] || 'status';
const port = Number(
  process.env.BING_EDGE_PORT ||
    (phase === 'gmail-status' || phase.startsWith('gmail') || phase === 'auto'
      ? process.env.BING_GMAIL_EDGE_PORT || 9225
      : 9224)
);
const siteUrl = SITE_URL;
const domain = SITE_HOST;
const mailAccount = MAIL_ACCOUNT;
const gmailAccount = GMAIL_ACCOUNT;
const BING_HOME = BING_HOME_URL;
let nextId = 1;
const pending = new Map();

function getEmailDomain(email) {
  const value = String(email || '')
    .trim()
    .toLowerCase();
  const at = value.lastIndexOf('@');
  return at > 0 ? value.slice(at + 1) : '';
}

function isEmailOnDomain(email, domain) {
  return getEmailDomain(email) === String(domain || '').toLowerCase();
}

function hasAllowedHost(rawUrl, allowedHosts) {
  try {
    const host = new URL(String(rawUrl || '')).hostname.toLowerCase();
    return allowedHosts.some(allowed => {
      const value = String(allowed || '').toLowerCase();
      return host === value || host.endsWith(`.${value}`);
    });
  } catch {
    return false;
  }
}

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

async function getTarget() {
  const list = await getJson(`http://127.0.0.1:${port}/json/list`);
  const pages = list.filter(t => t.type === 'page');
  return pages.find(t => hasAllowedHost(t.url, ['bing.com', 'login.live.com'])) || pages[0];
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (!m.id) return;
    const entry = pending.get(m.id);
    if (!entry) return;
    pending.delete(m.id);
    if (m.error) entry.reject(new Error(m.error.message));
    else entry.resolve(m.result);
  });
  return new Promise((resolve, reject) => {
    ws.addEventListener('open', () => {
      const send = (method, params = {}) =>
        new Promise((res, rej) => {
          const id = nextId++;
          pending.set(id, { resolve: res, reject: rej });
          ws.send(JSON.stringify({ id, method, params }));
        });
      resolve({ ws, send });
    });
    ws.addEventListener('error', reject);
  });
}

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function evaluate(send, expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    const desc = result.exceptionDetails.exception?.description || result.exceptionDetails.text || 'evaluate failed';
    throw new Error(desc);
  }
  if (result.result?.type === 'undefined' && result.result?.value === undefined) {
    return null;
  }
  return result.result?.value;
}

function pageScript(body) {
  return `(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    const norm = s => (s || '').replace(/\\s+/g, ' ').trim();
    const buttonText = el => norm(el.innerText || el.value || el.getAttribute('aria-label') || '');
    const clickButton = pattern => {
      const buttons = Array.from(document.querySelectorAll('button, [role="button"], a, input[type="submit"]'))
        .filter(el => visible(el) && !el.disabled);
      const match = buttons.find(el => pattern.test(buttonText(el)));
      if (match) { match.click(); return buttonText(match); }
      return null;
    };
    const setNativeValue = (el, value) => {
      const proto = Object.getPrototypeOf(el);
      const d = Object.getOwnPropertyDescriptor(proto, 'value');
      if (d?.set) d.set.call(el, value);
      else el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    ${body}
  })()`;
}

async function readProfile(send) {
  await send('Page.navigate', { url: BING_HOME });
  await wait(6000);
  const home = await evaluate(
    send,
    pageScript(`
      clickButton(/profile|профиль|^AR$/i);
      await sleep(2000);
      const text = document.body?.innerText || '';
      const emails = [...text.matchAll(/[\\w.+-]+@[\\w.-]+\\.[a-z]{2,}/gi)].map(m => m[0].toLowerCase());
      const siteNames = [...text.matchAll(/hundesalon[-\\w.]*\\.(com|de)/gi)].map(m => m[0]);
      const verified = /search performance|total clicks|клик|показ/i.test(text) && /hundesalon-nika/i.test(text);
      return {
        url: location.href,
        title: document.title,
        emails: [...new Set(emails)],
        sites: [...new Set(siteNames)],
        verified,
        body: text.slice(0, 1500),
      };
    `)
  );

  if (home?.emails?.length) return home;

  await send('Page.navigate', {
    url: `https://www.bing.com/webmasters/usermgmt?siteUrl=${encodeURIComponent(siteUrl)}`,
  });
  await wait(5000);
  const users = await evaluate(
    send,
    pageScript(`
      const text = document.body?.innerText || '';
      const emails = [...text.matchAll(/[\\w.+-]+@[\\w.-]+\\.[a-z]{2,}/gi)].map(m => m[0].toLowerCase());
      return { emails: [...new Set(emails)], sample: text.slice(0, 800) };
    `)
  );

  return {
    ...home,
    emails: [...new Set([...(home?.emails || []), ...(users?.emails || [])])],
    userMgmtSample: users?.sample,
  };
}

async function removeSiteFromAccount(send) {
  const settingsUrls = [
    `https://www.bing.com/webmasters/settings/site?siteUrl=${encodeURIComponent(siteUrl)}`,
    `https://www.bing.com/webmasters/settings/general?siteUrl=${encodeURIComponent(siteUrl)}`,
    `https://www.bing.com/webmasters/settings?siteUrl=${encodeURIComponent(siteUrl)}`,
  ];

  for (const url of settingsUrls) {
    await send('Page.navigate', { url });
    await wait(5500);
    const attempt = await evaluate(
      send,
      pageScript(`
        const clicks = [];
        const tryClick = label => {
          const hit = clickButton(new RegExp(label, 'i'));
          if (hit) clicks.push(hit);
          return hit;
        };
        tryClick('configuration|конфигурац');
        await sleep(1200);
        tryClick('site settings|настройки сайта|параметры сайта|general');
        await sleep(1200);
        const removeLabels = Array.from(document.querySelectorAll('a, button, [role="button"]'))
          .filter(el => visible(el))
          .map(el => buttonText(el))
          .filter(t => /remove|delete|удалить|entfernen/i.test(t));
        tryClick('remove site|delete site|удалить сайт|удалить этот|remove this|delete this');
        await sleep(2000);
        tryClick('^yes$|^delete$|^remove$|^удалить$|^да$|confirm|подтверд');
        await sleep(3000);
        return {
          url: location.href,
          removeLabels: removeLabels.slice(0, 15),
          clicks,
          hasSite: (document.body?.innerText || '').includes('hundesalon-nika'),
        };
      `)
    );
    if (attempt && !attempt.hasSite) {
      return { ...attempt, removed: true, via: url };
    }
  }

  return { removed: false, note: 'Delete manually: Configuration → Site settings → Remove site' };
}

async function signOutMicrosoft(send) {
  await send('Page.navigate', { url: 'https://www.bing.com/webmasters/' });
  await wait(4000);
  return evaluate(
    send,
    pageScript(`
      clickButton(/profile|профиль|AR/i);
      await sleep(1500);
      const signedOut = clickButton(/sign out|log out|выход|выйти/i);
      await sleep(3000);
      return { signedOut, url: location.href, text: (document.body?.innerText || '').slice(0, 800) };
    `)
  );
}

async function removeGmailUsersFromSite(send) {
  const url = `https://www.bing.com/webmasters/usermgmt?siteUrl=${encodeURIComponent(siteUrl)}`;
  await send('Page.navigate', { url });
  await wait(6000);

  return evaluate(
    send,
    pageScript(`
      const gmail = '${gmailAccount}';
      const rows = Array.from(document.querySelectorAll('tr, li, [role="row"], div'))
        .filter(el => visible(el) && el.innerText && el.innerText.includes(gmail));
      const actions = [];
      for (const row of rows) {
        const btn = Array.from(row.querySelectorAll('button, a, [role="button"]'))
          .find(el => visible(el) && /remove|delete|удалить/i.test(buttonText(el)));
        if (btn) { btn.click(); actions.push('clicked-remove'); await sleep(1500); clickButton(/confirm|yes|удалить|да/i); await sleep(1500); }
      }
      return {
        url: location.href,
        gmailRows: rows.length,
        actions,
        text: (document.body?.innerText || '').slice(0, 2000),
      };
    `)
  );
}

async function mailFullSetup(send) {
  const results = {};

  await send('Page.navigate', {
    url: `https://www.bing.com/webmasters/sitemaps?siteUrl=${encodeURIComponent(siteUrl)}`,
  });
  await wait(6000);
  results.sitemaps = await evaluate(
    send,
    pageScript(`
      const input = document.querySelector('input[type="url"], input[type="text"]');
      if (input) { setNativeValue(input, 'https://hundesalon-nika.com/sitemap.xml'); await sleep(500); }
      clickButton(/submit|add|добав|отправ/i);
      await sleep(3000);
      return { url: location.href, text: (document.body?.innerText || '').slice(0, 1500) };
    `)
  );

  await send('Page.navigate', {
    url: `https://www.bing.com/webmasters/indexnow?siteUrl=${encodeURIComponent(siteUrl)}`,
  });
  await wait(5000);
  results.indexnow = { url: 'checked', note: 'IndexNow key on site; npm run seo:indexnow from CLI' };

  await send('Page.navigate', {
    url: `https://www.bing.com/webmasters/urlinspection?siteUrl=${encodeURIComponent(siteUrl)}&urlToInspect=${encodeURIComponent('https://hundesalon-nika.com/de/')}`,
  });
  await wait(6000);
  results.inspection = await evaluate(
    send,
    pageScript(`
      clickButton(/inspect|провер|prüf/i);
      await sleep(3500);
      const req = clickButton(/request indexing|запросить индекс|indexierung/i);
      await sleep(2000);
      return { requestIndexing: req, text: (document.body?.innerText || '').slice(0, 1500) };
    `)
  );

  results.users = await removeGmailUsersFromSite(send);

  return results;
}

async function ensureEdge() {
  try {
    await getJson(`http://127.0.0.1:${port}/json/version`);
    return true;
  } catch {
    return false;
  }
}

async function startEdgeProfile(profileDir, startUrl) {
  const candidates = [
    path.join(process.env['ProgramFiles'] || '', 'Microsoft/Edge/Application/msedge.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
  ].filter(existsSync);
  if (!candidates.length) throw new Error('Edge not found');
  const userDataDir = path.join(process.env.TEMP || '.', profileDir);
  spawn(
    candidates[0],
    [`--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`, '--no-first-run', startUrl],
    { detached: true, stdio: 'ignore' }
  ).unref();
  for (let i = 0; i < 15; i++) {
    if (await ensureEdge()) return;
    await wait(2000);
  }
}

async function main() {
  if (!(await ensureEdge())) {
    if (phase.startsWith('gmail')) {
      console.log('Starting Edge for GMAIL login… Sign in as', gmailAccount);
      await startEdgeProfile(
        'hundesalon-nika-edge-gmail',
        'https://login.live.com/login.srf?wa=wsignin1.0&rpsnv=13&ct=1700000000&rver=7.0.6737.0&wp=MBI_SSL&wreply=https%3A%2F%2Fwww.bing.com%2Fwebmasters%2F&id=264960'
      );
    } else {
      console.log('Starting Edge for MAIL.RU…');
      await startEdgeProfile(
        'hundesalon-nika-edge-debug',
        `https://www.bing.com/webmasters/home?siteUrl=${encodeURIComponent(siteUrl)}`
      );
    }
    await wait(4000);
  }

  const target = await getTarget().catch(() => null);
  if (!target?.webSocketDebuggerUrl) {
    console.error('Edge CDP unavailable on port', port);
    process.exit(1);
  }

  const { ws, send } = await connect(target.webSocketDebuggerUrl);
  await send('Runtime.enable');
  await send('Page.enable');

  try {
    let result;
    if (phase === 'status' || phase === 'gmail-status' || phase === 'mail-status') {
      result = await readProfile(send);
      const emails = result?.emails || [];
      const isGmail = emails.some(e => isEmailOnDomain(e, 'gmail.com'));
      const isMail = emails.some(e => isEmailOnDomain(e, 'mail.ru'));
      console.log(JSON.stringify({ phase, port, emails, isGmail, isMail, ...result }, null, 2));
      if (!emails.length && !result?.verified) {
        console.warn('No email in UI — sign in to Microsoft in the open Edge window, then rerun.');
        process.exit(2);
      }
      if (!emails.length && result?.verified) {
        console.warn('Email hidden in UI, but site is verified and dashboard is active — continuing.');
      }
      if (phase === 'gmail-status' && !isGmail) {
        console.error('Expected', gmailAccount, '— sign in with Gmail Microsoft account first.');
        process.exit(2);
      }
      if (phase === 'mail-status' && !isMail && !result?.verified) {
        console.error('Expected', mailAccount, '— sign in with mail.ru Microsoft account first.');
        process.exit(2);
      }
      if (phase === 'mail-status' && !isMail && result?.verified) {
        console.warn('Account email not visible; site verified — OK for automation.');
      }
    } else if (phase === 'gmail-remove-site') {
      const profile = await readProfile(send);
      if (!profile.emails?.some(e => isEmailOnDomain(e, 'gmail.com'))) {
        console.error('Not signed in as gmail. Sign in as', gmailAccount, 'then rerun.');
        process.exit(2);
      }
      result = await removeSiteFromAccount(send);
      console.log(JSON.stringify({ phase, profile: profile.emails, remove: result }, null, 2));
    } else if (phase === 'gmail-signout') {
      result = await signOutMicrosoft(send);
      console.log(JSON.stringify({ phase, ...result }, null, 2));
    } else if (phase === 'mail-setup') {
      const profile = await readProfile(send);
      if (!profile.emails?.some(e => isEmailOnDomain(e, 'mail.ru'))) {
        console.error('Not signed in as mail.ru. Sign in as', mailAccount, 'then rerun.');
        process.exit(2);
      }
      result = await mailFullSetup(send);
      console.log(JSON.stringify({ phase, profile: profile.emails, setup: result }, null, 2));
      console.log('\nRun: npm run seo:indexnow');
    } else if (phase === 'auto') {
      const profile = await readProfile(send);
      const emails = profile?.emails || [];
      const isGmail = emails.some(e => isEmailOnDomain(e, 'gmail.com'));
      const isMail = emails.some(e => isEmailOnDomain(e, 'mail.ru'));
      console.log('Detected:', { emails, isGmail, isMail, url: profile?.url });

      if (isGmail) {
        console.log('→ Gmail account: removing site, then sign out…');
        const remove = await removeSiteFromAccount(send);
        const signout = await signOutMicrosoft(send);
        console.log(JSON.stringify({ remove, signout }, null, 2));
        console.log('\nNext: npm run bing:edge → sign in', mailAccount, '→ npm run bing:mail-setup');
      } else if (isMail) {
        console.log('→ Mail.ru account: full setup…');
        result = await mailFullSetup(send);
        console.log(JSON.stringify({ setup: result }, null, 2));
        console.log('\nRun: npm run seo:indexnow');
      } else {
        console.warn('Sign in to Microsoft in Edge (gmail or mail.ru), then: npm run bing:consolidate auto');
        process.exit(2);
      }
    } else {
      console.error('Unknown phase:', phase);
      process.exit(1);
    }
  } finally {
    ws.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
