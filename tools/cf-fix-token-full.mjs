/**
 * Cloudflare: Aktionen → Bearbeiten → expand Zone → Zone Rules Edit → Save.
 * npm run cf:fix-token-full
 */
import { spawn } from 'node:child_process';
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
const EDIT = `https://dash.cloudflare.com/profile/api-tokens/${EXISTING_PURGE_TOKEN_ID}/edit`;
const WAIT_SPA_MS = Number(process.env.CF_SPA_WAIT_MS || 40000);

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

async function ensureEdge() {
  try {
    await getJson(`http://127.0.0.1:${port}/json/version`);
  } catch {
    spawn('npm', ['run', 'cf:edge-dashboard'], { shell: true, detached: true, stdio: 'ignore' }).unref();
    for (let i = 0; i < 25; i++) {
      await sleep(2000);
      try {
        await getJson(`http://127.0.0.1:${port}/json/version`);
        return;
      } catch {
        // retry
      }
    }
    throw new Error('CF Edge did not start');
  }
}

async function connect() {
  const list = await getJson(`http://127.0.0.1:${port}/json/list`);
  const t = list.find(x => x.type === 'page' && x.url?.includes('cloudflare.com'));
  if (!t) throw new Error('No CF tab');
  let id = 1;
  const pending = new Map();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (!m.id) return;
    const x = pending.get(m.id);
    pending.delete(m.id);
    m.error ? x.reject(new Error(m.error.message)) : x.resolve(m.result);
  };
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const i = id++;
      pending.set(i, { resolve: res, reject: rej });
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  return { send, close: () => ws.close() };
}

const FLOW = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const norm = s => (s || '').replace(/\\s+/g, ' ').trim();
  const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const inCookie = el => !!el?.closest('#onetrust-consent-sdk, #onetrust-banner-sdk');

  const clickBtn = (re, skipCookie = true) => {
    for (const b of document.querySelectorAll('button,[role=button]')) {
      if (!visible(b) || b.disabled) continue;
      if (skipCookie && inCookie(b)) continue;
      const t = norm(b.innerText || b.getAttribute('aria-label') || '');
      if (re.test(t)) { b.click(); return t; }
    }
    return null;
  };

  clickBtn(/^allow all$|^alle erlauben$/i, false);
  await sleep(600);

  let row = null;
  for (let i = 0; i < 25; i++) {
    row = [...document.querySelectorAll('tr')].find(r => /NIKA-Purge-Cache/i.test(r.innerText || ''));
    if (row) break;
    await sleep(400);
  }
  if (!row) return { err: 'no_row' };

  row.querySelector('button[aria-label="Aktionen"], button[aria-label="Actions"]')?.click();
  await sleep(900);
  let editLabel = null;
  for (const el of document.querySelectorAll('[role=menuitem]')) {
    const t = norm(el.innerText);
    if (/^bearbeiten$|^edit$/i.test(t)) { el.click(); editLabel = t; break; }
  }
  if (!editLabel) return { err: 'no_edit', menu: [...document.querySelectorAll('[role=menuitem]')].map(e => norm(e.innerText)) };

  await sleep(3000);
  location.assign('${EDIT}');
  await sleep(12000);

  const zr = /zone rules|zonen.?regeln|zonenregeln|rulesets?|regelsätze/i;
  const ed = /edit|bearbeiten|ändern/i;
  const permHits = [];

  for (const el of document.querySelectorAll('button, summary, [role=button], h3, h4, label, span')) {
    if (!visible(el) || inCookie(el)) continue;
    const t = norm(el.innerText || '');
    if (/^zone$/i.test(t) || t === 'Zone' || /zone permissions|berechtigungen.*zone/i.test(t)) {
      el.click();
      permHits.push('expand:' + t);
      await sleep(500);
    }
  }

  for (const el of document.querySelectorAll('input[type=checkbox], [role=checkbox]')) {
    if (!visible(el) || inCookie(el)) continue;
    const rowT = norm(el.closest('tr,li,motion.div,motion,motion,motion,motion,motion,motion,div,label,section')?.innerText || '');
    if (!rowT || /cookie|functional|targeting|performance/i.test(rowT)) continue;
    if (zr.test(rowT) && ed.test(rowT) && !el.checked) {
      el.click();
      permHits.push('on:' + rowT.slice(0, 100));
      await sleep(350);
    } else if (zr.test(rowT) && !ed.test(rowT)) {
      el.click();
      permHits.push('section:' + rowT.slice(0, 60));
      await sleep(350);
    }
  }

  for (const el of document.querySelectorAll('label, span, button')) {
    if (!visible(el) || inCookie(el)) continue;
    const t = norm(el.innerText);
    if (zr.test(t) && ed.test(t) && t.length < 100) {
      el.click();
      permHits.push('tap:' + t.slice(0, 80));
      await sleep(200);
    }
  }

  await sleep(600);
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
    editLabel,
    permHits,
    cont,
    save,
    ok,
    url: location.href,
    zrLabels: uniq.filter(t => zr.test(t)),
    permSample: uniq.filter(t => /zone\\.|cache|purge|page|regeln|rules/i.test(t)).slice(0, 15),
    count: uniq.length,
  };
})()`;

loadAllCredentials();
const auth = resolveCfAuth();
let audit = await auditToken(auth, await resolveZoneId(auth));
if (isFullToken(audit)) {
  console.log('Token already complete:\n');
  printAudit(audit);
  process.exit(0);
}

await ensureEdge();
console.log(`Wait ${WAIT_SPA_MS / 1000}s for SPA…`);
await sleep(WAIT_SPA_MS);

const { send, close } = await connect();
let result;
try {
  const r = await send('Runtime.evaluate', {
    expression: FLOW,
    awaitPromise: true,
    returnByValue: true,
    timeout: 90000,
  });
  result = r.result?.value;
  console.log(JSON.stringify(result, null, 2));
} finally {
  close();
}

await sleep(4000);
audit = await auditToken(auth, await resolveZoneId(auth));
console.log('\nAudit:');
printAudit(audit);

if (!isFullToken(audit)) {
  console.log('\nFallback: normal Edge opened via cf:open-edit-token and cf:open-api-token');
  console.log('Option A: edit NIKA-Purge-Cache → add Zone Rules Edit → save');
  console.log('Option B: create HUNDESALON — Zone API (all 4 perms) → npm run cf:set-api-token -- <token>');
  spawn('npm', ['run', 'cf:open-edit-token'], { shell: true, detached: true, stdio: 'ignore' }).unref();
}

process.exit(isFullToken(audit) ? 0 : 1);
