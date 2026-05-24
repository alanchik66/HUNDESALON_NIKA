import {
  auditToken,
  isFullToken,
  loadAllCredentials,
  printAudit,
  resolveCfAuth,
} from './lib/cf-api-token.mjs';
import { resolveZoneId } from './lib/cloudflare-auth.mjs';

const port = 9225;
let id = 1;
const p = new Map();
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const t = list.find(x => x.type === 'page' && x.url?.includes('api-tokens'));
if (!t) throw new Error('CF tab missing');
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (!m.id) return;
  p.get(m.id).resolve(m.result);
  p.delete(m.id);
};
const send = (method, params = {}) =>
  new Promise(res => {
    const i = id++;
    p.set(i, { resolve: res });
    ws.send(JSON.stringify({ id: i, method, params }));
  });

const val = r => r?.result?.value;

const r = await send('Runtime.evaluate', {
  expression: `(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const norm = s => (s || '').replace(/\\s+/g, ' ').trim();

    const row = [...document.querySelectorAll('tr')].find(r => /NIKA-Purge-Cache/i.test(r.innerText || ''));
    if (!row) return { err: 'no_row' };

    const btn = row.querySelector('button[aria-label="Aktionen"]');
    if (!btn) return { err: 'no_btn' };
    btn.click();
    await sleep(1200);

    const items = [...document.querySelectorAll('[role=menuitem]')].map(el => norm(el.innerText)).filter(Boolean);
    let editClicked = null;
    for (const el of document.querySelectorAll('[role=menuitem]')) {
      const t = norm(el.innerText);
      if (/bearbeiten|edit/i.test(t)) { el.click(); editClicked = t; break; }
    }
    await sleep(14000);

    const texts = [];
    const w = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const t = n.textContent.trim();
      if (t.length > 2 && t.length < 200) texts.push(t);
    }
    const uniq = [...new Set(texts)];
    const zr = /zone rules|zonen.?regeln|zonenregeln/i;
    const ed = /edit|bearbeiten/i;
    const hits = [];

    for (const el of document.querySelectorAll('input[type=checkbox]')) {
      const rowT = norm(el.closest('tr,li,motion.div,div')?.innerText || '');
      if (zr.test(rowT) && ed.test(rowT) && !el.checked) {
        el.click();
        hits.push(rowT.slice(0, 90));
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

    await sleep(500);
    const cont = clickBtn(/weiter zur zusammenfassung|continue to summary|weiter|continue/i);
    await sleep(2500);
    const save = clickBtn(/token aktualisieren|update token|speichern/i);
    await sleep(2500);
    const ok = clickBtn(/bestätigen|confirm/i);

    return {
      items,
      editClicked,
      url: location.href,
      hits,
      cont,
      save,
      ok,
      zrLabels: uniq.filter(t => zr.test(t)),
      count: uniq.length,
    };
  })()`,
  awaitPromise: true,
  returnByValue: true,
  timeout: 35000,
});

const step = val(r);
console.log('Steps 9–11:', JSON.stringify(step, null, 2));
ws.close();

loadAllCredentials();
const auth = resolveCfAuth();
const zoneId = await resolveZoneId(auth);
const audit = await auditToken(auth, zoneId);
console.log('\nStep 12 audit:');
printAudit(audit);
process.exit(isFullToken(audit) ? 0 : 1);
