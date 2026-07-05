/**
 * Setup Bing Webmaster on mail.ru account (Edge port 9224).
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { evalPage as runEvalPage, getJson, sleep as wait, withCdpSession } from './lib/browser-cdp.mjs';

const mailPort = Number(process.env.BING_MAIL_EDGE_PORT || 9224);
const siteUrl = 'https://hundesalon-nika.com/';
const siteQ = encodeURIComponent(siteUrl);
const mailAccount = 'snaiper1984@mail.ru';

async function ensureMailEdge() {
  try {
    await getJson(`http://127.0.0.1:${mailPort}/json/version`);
    return true;
  } catch {
    const candidates = [
      path.join(process.env['ProgramFiles'] || '', 'Microsoft/Edge/Application/msedge.exe'),
      path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
    ].filter(existsSync);
    if (!candidates.length) throw new Error('Edge not found');
    const loginUrl = `https://login.live.com/oauth20_authorize.srf?client_id=0000000048060c6a&response_type=code&scope=service::bingmaster.ms.com::MBI_SSL&redirect_uri=https%3A%2F%2Fwww.bing.com%2Fwebmasters%2F`;
    const userDataDir = path.join(process.env.TEMP || '.', 'hundesalon-nika-edge-debug');
    spawn(
      candidates[0],
      [`--remote-debugging-port=${mailPort}`, `--user-data-dir=${userDataDir}`, '--no-first-run', loginUrl],
      { detached: true, stdio: 'ignore' }
    ).unref();
    for (let i = 0; i < 20; i++) {
      await wait(2000);
      try {
        await getJson(`http://127.0.0.1:${mailPort}/json/version`);
        return false;
      } catch {
        /* wait */
      }
    }
    throw new Error('Edge mail profile did not start');
  }
}

const withCdp = task => withCdpSession({ port: mailPort, targetPattern: /.*/ }, ({ send }) => task(send));

const evalPage = (send, body) =>
  runEvalPage(send, body, { clickSelectors: 'a, button, [role="button"], [role="menuitem"]' });

const hadEdge = await ensureMailEdge();
if (!hadEdge) {
  console.log('Sign in as', mailAccount, 'in the Edge window, then rerun: npm run bing:mail-setup');
  process.exit(2);
}

const report = await withCdp(async send => {
  await send('Page.navigate', { url: `https://www.bing.com/webmasters/home?siteUrl=${siteQ}` });
  await wait(7000);

  let state = await evalPage(
    send,
    `
    clickMatch('profile|профиль|AR');
    await sleep(2000);
    const body = document.body?.innerText || '';
    const emails = [...body.matchAll(/[\\w.+-]+@[\\w.-]+\\.[a-z]{2,}/gi)].map(m => m[0].toLowerCase());
    return {
      emails: [...new Set(emails)],
      hasSite: body.includes('hundesalon-nika'),
      url: location.href,
    };
  `
  );

  const isGmail = state.emails?.some(e => e.includes('gmail.com'));
  const isMail = state.emails?.some(e => e.includes('mail.ru'));

  if (isGmail && !isMail) {
    return { error: 'WRONG_ACCOUNT_GMAIL', state, hint: 'Sign out and use ' + mailAccount };
  }

  if (!isMail && !state.hasSite) {
    return { error: 'NOT_MAIL_RU', state, hint: 'Sign in with ' + mailAccount };
  }

  if (!state.hasSite) {
    await send('Page.navigate', { url: 'https://www.bing.com/webmasters/' });
    await wait(6000);
    state.add = await evalPage(
      send,
      `
      const input = document.querySelector('input');
      if (input) { input.value = 'https://hundesalon-nika.com/'; input.dispatchEvent(new Event('input',{bubbles:true})); }
      await sleep(500);
      clickMatch('^add$|добавить');
      await sleep(8000);
      return { url: location.href, hasSite: (document.body.innerText||'').includes('hundesalon-nika') };
    `
    );
  }

  await send('Page.navigate', { url: `https://www.bing.com/webmasters/sitemaps?siteUrl=${siteQ}` });
  await wait(6000);
  const sitemap = await evalPage(
    send,
    `
    const input = document.querySelector('input');
    if (input) { input.value = 'https://hundesalon-nika.com/sitemap.xml'; input.dispatchEvent(new Event('input',{bubbles:true})); }
    await sleep(400);
    clickMatch('submit|add|добав|отправ');
    return { ok: true };
  `
  );

  await send('Page.navigate', { url: `https://www.bing.com/webmasters/usermgmt?siteUrl=${siteQ}` });
  await wait(6000);
  const users = await evalPage(
    send,
    `
    let n = 0;
    for (const el of document.querySelectorAll('button, a')) {
      const row = el.closest('tr, li');
      if (row && row.innerText && row.innerText.includes('gmail.com') && /remove|delete|удалить/i.test(txt(el))) {
        el.click(); n++; await sleep(1200);
        clickMatch('confirm|yes|удалить|да'); await sleep(1200);
      }
    }
    return { gmailRemoved: n };
  `
  );

  await send('Page.navigate', {
    url: `https://www.bing.com/webmasters/urlinspection?siteUrl=${siteQ}&urlToInspect=${encodeURIComponent('https://hundesalon-nika.com/de/')}`,
  });
  await wait(7000);
  const inspect = await evalPage(
    send,
    `
    clickMatch('inspect|провер');
    await sleep(3500);
    return { requestIndexing: clickMatch('request indexing|запросить индекс|indexierung') };
  `
  );

  return { state, sitemap, users, inspect, ok: true };
});

console.log(JSON.stringify(report, null, 2));
