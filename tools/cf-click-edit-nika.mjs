/**
 * NIKA-Purge-Cache: Aktionen → Bearbeiten → Zone Rules Edit → Save.
 */
import {
  auditToken,
  EXISTING_PURGE_TOKEN_ID,
  isFullToken,
  loadAllCredentials,
  printAudit,
  resolveCfAuth,
} from './lib/cf-api-token.mjs';
import { resolveZoneId } from './lib/cloudflare-auth.mjs';

const port = Number(process.env.CF_EDGE_PORT || 9225);
const EDIT_URL = `https://dash.cloudflare.com/profile/api-tokens/${EXISTING_PURGE_TOKEN_ID}/edit`;

async function connect() {
  let id = 1;
  const p = new Map();
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const t = list.find(x => x.type === 'page' && x.url?.includes('cloudflare'));
  if (!t) throw new Error('NO_TAB');
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => {
    ws.addEventListener('open', r);
    ws.addEventListener('error', j);
  });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (!m.id) return;
    const x = p.get(m.id);
    p.delete(m.id);
    m.error ? x.reject(new Error(m.error.message)) : x.resolve(m.result);
  };
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const i = id++;
      p.set(i, { resolve: res, reject: rej });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  return { send, close: () => ws.close() };
}

loadAllCredentials();
const auth = resolveCfAuth();

const { send, close } = await connect();
try {
  const r = await send('Runtime.evaluate', {
    expression: `(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const norm = s => (s || '').replace(/\\s+/g, ' ').trim();
      const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
      const clickBtn = re => {
        for (const b of document.querySelectorAll('button,[role=button]')) {
          const t = norm(b.innerText || b.getAttribute('aria-label') || '');
          if (re.test(t) && visible(b) && !b.disabled) { b.click(); return t; }
        }
        return null;
      };

      clickBtn(/^allow all$|alle erlauben|alle cookies akzeptieren/i);
      await sleep(1000);

      const row = [...document.querySelectorAll('tr')].find(r => /NIKA-Purge-Cache/i.test(r.innerText || ''));
      if (!row) return { err: 'no_row', url: location.href };

      const aktionen = row.querySelector('button[aria-label="Aktionen"], button[aria-label="Actions"]');
      if (!aktionen) return { err: 'no_aktionen' };
      aktionen.click();
      await sleep(800);

      let editClicked = null;
      for (const item of document.querySelectorAll('[role=menuitem],button,a')) {
        const t = norm(item.innerText || item.getAttribute('aria-label') || '');
        if (/^bearbeiten$|^edit$/i.test(t) && visible(item)) {
          item.click();
          editClicked = t;
          break;
        }
      }
      await sleep(10000);

      return { editClicked, url: location.href };
    })()`,
    awaitPromise: true,
    returnByValue: true,
    timeout: 25000,
  });
  console.log('Step 9:', JSON.stringify(r.result?.value, null, 2));

  await new Promise(res => setTimeout(res, 5000));

  const r2 = await send('Runtime.evaluate', {
    expression: `(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const norm = s => (s || '').replace(/\\s+/g, ' ').trim();
      const zr = /zone rules|zonen.?regeln|zonenregeln/i;
      const ed = /edit|bearbeiten/i;
      const hits = [];

      for (const el of document.querySelectorAll('input[type=checkbox]')) {
        const row = norm(el.closest('tr,li,motion.div,motion,motion,motion,motion,motion,motion,div,label')?.innerText || '');
        if (zr.test(row) && ed.test(row)) {
          if (!el.checked) { el.click(); hits.push('checked:' + row.slice(0, 90)); }
          else hits.push('already:' + row.slice(0, 90));
          await sleep(300);
        }
      }

      const clickBtn = re => {
        for (const b of document.querySelectorAll('button,[role=button]')) {
          const t = norm(b.innerText || b.getAttribute('aria-label') || '');
          if (re.test(t) && !b.disabled) { b.click(); return t; }
        }
        return null;
      };

      await sleep(800);
      const cont = clickBtn(/weiter zur zusammenfassung|continue to summary|fortfahren/i);
      await sleep(3000);
      const save = clickBtn(/token aktualisieren|update token/i);
      await sleep(3000);
      const ok = clickBtn(/bestätigen|confirm/i);

      const texts = [];
      const w = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        const t = n.textContent.trim();
        if (t.length > 2 && t.length < 200) texts.push(t);
      }
      const uniq = [...new Set(texts)];

      return {
        url: location.href,
        hits,
        cont,
        save,
        ok,
        zr: uniq.filter(t => zr.test(t)),
        boxes: document.querySelectorAll('input[type=checkbox]').length,
      };
    })()`,
    awaitPromise: true,
    returnByValue: true,
    timeout: 25000,
  });
  console.log('Step 10:', JSON.stringify(r2.result?.value, null, 2));
} finally {
  close();
}

const zoneId = await resolveZoneId(auth);
const audit = await auditToken(auth, zoneId);
console.log('\nStep 11 audit:');
printAudit(audit);
process.exit(isFullToken(audit) ? 0 : 1);
