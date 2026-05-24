/**
 * Complete Bing site verification via HTML meta tag (msvalidate.01 on site).
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const mailPort = Number(process.env.BING_MAIL_EDGE_PORT || 9224);
const siteUrl = 'https://hundesalon-nika.com/';
const siteQ = encodeURIComponent(siteUrl);

let nextId = 1;

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function withCdp(fn) {
  const list = await getJson(`http://127.0.0.1:${mailPort}/json/list`);
  const target = list.find(t => t.type === 'page') || list[0];
  const pending = new Map();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
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

async function evalPage(send, body) {
  const expr = `(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    const norm = s => (s || '').replace(/\\s+/g, ' ').trim();
    const txt = el => norm(el.innerText || el.value || el.getAttribute('aria-label') || '');
    const clickMatch = pattern => {
      const re = new RegExp(pattern, 'i');
      for (const el of document.querySelectorAll('a, button, [role="button"], input[type="submit"]')) {
        if (!visible(el) || el.disabled) continue;
        if (re.test(txt(el))) { el.click(); return txt(el); }
      }
      return null;
    };
    ${body}
  })()`;
  const result = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description);
  return result.result?.value;
}

const report = await withCdp(async send => {
  await send('Page.navigate', { url: `https://www.bing.com/webmasters/home?siteUrl=${siteQ}` });
  await wait(7000);

  const start = await evalPage(
    send,
    `
    const body = document.body?.innerText || '';
    return {
      verified: /verified|подтвержд/i.test(body) && !/not verified|не подтвержд/i.test(body),
      pending: /verification pending|ожидает подтвержд/i.test(body),
      hasVerifyBtn: !!clickMatch('verify now|подтвердить|verify'),
    };
  `
  );

  if (start.verified) {
    return { alreadyVerified: true, start };
  }

  const flow = await evalPage(
    send,
    `
    const rowVerify = () => {
      for (const row of document.querySelectorAll('tr, [role="row"], li')) {
        const t = row.innerText || '';
        if (t.includes('hundesalon-nika.com/') && !t.includes('sitemap.xml')) {
          for (const el of row.querySelectorAll('a, button')) {
            if (/verify|проверить/i.test(txt(el))) { el.click(); return 'row-verify'; }
          }
        }
      }
      return clickMatch('verify now|проверить сейчас|proceed to verification|перейти к проверке');
    };
    if (!location.href.includes('verifySite')) rowVerify();
    await sleep(5000);
    const meta = clickMatch('мета-тег html|html meta tag|meta tag');
    await sleep(3000);
    const finalVerify = () => {
      for (const el of document.querySelectorAll('button, a, input[type="submit"]')) {
        if (!visible(el) || el.disabled) continue;
        const t = txt(el);
        if (/проверить сейчас|verify now/i.test(t)) continue;
        if (/^verify$|^проверить$|verify ownership|проверить владение|подтвердить/i.test(t)) {
          el.click();
          return t;
        }
      }
      return clickMatch('verify|подтвердить|check');
    };
    const v = finalVerify();
    await sleep(10000);
    return { metaSelected: meta, verifyClicked: v, url: location.href };
  `
  );

  await wait(5000);
  const after = await evalPage(
    send,
    `
    const body = document.body?.innerText || '';
    return {
      bodySample: body.slice(0, 1200),
      verified: /site verified|verified successfully|подтвержден/i.test(body),
      notVerified: /not verified|не подтвержд/i.test(body),
    };
  `
  );

  return { start, flow, after };
});

console.log(JSON.stringify(report, null, 2));
