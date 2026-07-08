/**
 * Aggressive Bing cleanup: remove site, sign out (gmail port), setup (mail port).
 */
const gmailPort = Number(process.env.BING_GMAIL_EDGE_PORT || 9225);
const mailPort = Number(process.env.BING_EDGE_PORT || 9224);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const siteUrl = 'https://hundesalon-nika.com/';
const siteQ = encodeURIComponent(siteUrl);

let nextId = 1;

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
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getPageTarget(port) {
  const list = await getJson(`http://127.0.0.1:${port}/json/list`);
  return list.find(t => t.type === 'page' && hasAllowedHost(t.url, ['bing.com'])) || list.find(t => t.type === 'page');
}

async function withCdp(port, fn) {
  const target = await getPageTarget(port);
  if (!target?.webSocketDebuggerUrl) throw new Error(`No Edge page on port ${port}`);

  const pending = new Map();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });

  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (!m.id) return;
    const entry = pending.get(m.id);
    if (!entry) return;
    pending.delete(m.id);
    if (m.error) entry.reject(new Error(m.error.message));
    else entry.resolve(m.result);
  });

  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const id = nextId++;
      pending.set(id, { resolve: res, reject: rej });
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send('Runtime.enable');
  await send('Page.enable');

  try {
    return await fn(send);
  } finally {
    ws.close();
  }
}

async function navigate(send, url) {
  await send('Page.navigate', { url });
  await wait(8000);
}

async function evalPage(send, body, retries = 4) {
  const expr = `(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    const norm = s => (s || '').replace(/\\s+/g, ' ').trim();
    const txt = el => norm(el.innerText || el.value || el.getAttribute('aria-label') || '');
    const clickMatch = pattern => {
      const re = new RegExp(pattern, 'i');
      for (const el of document.querySelectorAll('a, button, [role="button"], [role="menuitem"], span, div')) {
        if (!visible(el) || el.disabled) continue;
        const t = txt(el);
        if (re.test(t)) { el.click(); return t; }
      }
      return null;
    };
    ${body}
  })()`;

  for (let i = 0; i < retries; i++) {
    try {
      const result = await send('Runtime.evaluate', {
        expression: expr,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description || 'eval error');
      }
      return result.result?.value;
    } catch (error) {
      if (/destroyed|closed/i.test(String(error.message)) && i < retries - 1) {
        await wait(2500);
        continue;
      }
      throw error;
    }
  }
}

async function cleanupGmail(port) {
  return withCdp(port, async send => {
    const log = [];

    await navigate(send, `https://www.bing.com/webmasters/settings/site?siteUrl=${siteQ}`);
    const s1 = await evalPage(
      send,
      `
      const found = Array.from(document.querySelectorAll('*'))
        .filter(el => visible(el))
        .map(el => txt(el))
        .filter(t => t && /remove|delete|удалить/i.test(t) && t.length < 80);
      let c = clickMatch('remove site|delete site|удалить сайт|удалить этот');
      await sleep(2000);
      if (!c) c = clickMatch('remove|delete|удалить');
      await sleep(2000);
      clickMatch('^yes$|^delete$|^remove$|^удалить$|confirm|подтверд|да');
      await sleep(3000);
      return { step: 'settings-site', found: [...new Set(found)].slice(0, 12), click: c, hasSite: (document.body.innerText||'').includes('hundesalon-nika') };
    `
    );
    log.push(s1);

    if (s1?.hasSite) {
      await navigate(send, `https://www.bing.com/webmasters/home?siteUrl=${siteQ}`);
      const s2 = await evalPage(
        send,
        `
        clickMatch('configuration|конфигурац');
        await sleep(1000);
        clickMatch('site settings|настройки сайта|general');
        await sleep(1500);
        const c = clickMatch('remove site|delete site|удалить');
        await sleep(2000);
        clickMatch('confirm|yes|удалить|да|delete');
        await sleep(3000);
        return { step: 'home-config', click: c, hasSite: (document.body.innerText||'').includes('hundesalon-nika') };
      `
      );
      log.push(s2);
    }

    await navigate(send, 'https://www.bing.com/webmasters/');
    const signout = await evalPage(
      send,
      `
      clickMatch('profile|профиль|AR');
      await sleep(1500);
      const out = clickMatch('sign out|log out|выход|выйти');
      await sleep(5000);
      const body = document.body?.innerText || '';
      return {
        signOut: out,
        emails: [...body.matchAll(/[\\w.+-]+@[\\w.-]+\\.[a-z]{2,}/gi)].map(m => m[0]),
        hasSite: body.includes('hundesalon-nika'),
        welcome: /add your site|добавьте свой сайт/i.test(body),
      };
    `
    );
    log.push(signout);

    return { port, log, clean: signout?.welcome || !signout?.hasSite };
  });
}

async function setupMail(port) {
  return withCdp(port, async send => {
    await navigate(send, `https://www.bing.com/webmasters/home?siteUrl=${siteQ}`);
    let state = await evalPage(
      send,
      `
      const body = document.body?.innerText || '';
      return {
        emails: [...body.matchAll(/[\\w.+-]+@[\\w.-]+\\.[a-z]{2,}/gi)].map(m => m[0]),
        hasSite: body.includes('hundesalon-nika'),
        url: location.href,
      };
    `
    );

    if (!state?.emails?.some(e => e.includes('mail.ru'))) {
      return { port, error: 'NOT_MAIL_RU', state, hint: 'npm run bing:edge → sign in snaiper1984@mail.ru' };
    }

    if (!state?.hasSite) {
      await navigate(send, 'https://www.bing.com/webmasters/');
      const add = await evalPage(
        send,
        `
        const input = document.querySelector('input');
        if (input) {
          const v = 'https://hundesalon-nika.com/';
          input.focus();
          input.value = v;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        await sleep(600);
        clickMatch('^add$|добавить');
        await sleep(6000);
        return { added: true, text: (document.body.innerText||'').slice(0,600) };
      `
      );
      state = { ...state, add };
    }

    await navigate(send, `https://www.bing.com/webmasters/sitemaps?siteUrl=${siteQ}`);
    const sitemap = await evalPage(
      send,
      `
      const input = document.querySelector('input');
      if (input) { input.value = 'https://hundesalon-nika.com/sitemap.xml'; input.dispatchEvent(new Event('input',{bubbles:true})); }
      await sleep(400);
      clickMatch('submit|add|добав|отправ');
      await sleep(2000);
      return { ok: true };
    `
    );

    await navigate(send, `https://www.bing.com/webmasters/usermgmt?siteUrl=${siteQ}`);
    const users = await evalPage(
      send,
      `
      const gmail = 'snaiper1984@gmail.com';
      let removed = 0;
      for (const el of document.querySelectorAll('button, a, [role="button"]')) {
        if (!visible(el)) continue;
        const row = el.closest('tr, li, [role="row"]');
        if (row && row.innerText && row.innerText.includes(gmail) && /remove|delete|удалить/i.test(txt(el))) {
          el.click(); removed++; await sleep(1200);
          clickMatch('confirm|yes|удалить|да'); await sleep(1200);
        }
      }
      return { gmailUsersRemoved: removed };
    `
    );

    await navigate(
      send,
      `https://www.bing.com/webmasters/urlinspection?siteUrl=${siteQ}&urlToInspect=${encodeURIComponent('https://hundesalon-nika.com/de/')}`
    );
    const inspect = await evalPage(
      send,
      `
      clickMatch('inspect|провер');
      await sleep(3500);
      const r = clickMatch('request indexing|запросить индекс|indexierung');
      return { requestIndexing: r };
    `
    );

    return { port, state, sitemap, users, inspect, ok: true };
  });
}

console.log('Gmail cleanup port', gmailPort);
const gmail = await cleanupGmail(gmailPort).catch(e => ({ error: String(e.message) }));
console.log(JSON.stringify(gmail, null, 2));

console.log('\nMail.ru setup port', mailPort);
const mail = await setupMail(mailPort).catch(e => ({ error: String(e.message) }));
console.log(JSON.stringify(mail, null, 2));

console.log('\nIndexNow…');
const { spawn } = await import('node:child_process');
await new Promise((resolve, reject) => {
  const p = spawn(npmCommand, ['run', 'seo:indexnow'], { stdio: 'inherit' });
  p.on('close', c => (c === 0 ? resolve() : reject(new Error('indexnow failed'))));
});

console.log('\nDone.');
