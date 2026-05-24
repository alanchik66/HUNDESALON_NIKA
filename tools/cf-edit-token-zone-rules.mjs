/**
 * Add Zone Rules Edit to NIKA-Purge-Cache token via Cloudflare Dashboard (Edge 9225).
 * npm run cf:edge-dashboard → login → npm run cf:edit-token-zone-rules
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

const TOKEN_ID = EXISTING_PURGE_TOKEN_ID;
const TOKEN_NAME_HINT = /NIKA|Purge-Cache/i;
const port = Number(process.env.CF_EDGE_PORT || 9225);

let nextId = 1;
const pending = new Map();

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

function pageScript(body) {
  return `(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    const norm = s => (s || '').replace(/\\s+/g, ' ').trim();
    const txt = el => norm(el.innerText || el.textContent || el.value || el.getAttribute('aria-label') || '');
    const clickMatch = pattern => {
      const re = new RegExp(pattern, 'i');
      for (const el of document.querySelectorAll('button, a, [role="button"], label, span')) {
        if (!visible(el) || el.disabled) continue;
        if (re.test(txt(el))) { el.click(); return txt(el); }
      }
      return null;
    };
    const allText = () => {
      const out = [];
      const w = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        const t = n.textContent.trim();
        if (t.length > 1 && t.length < 300) out.push(t);
      }
      return [...new Set(out)].join(' ');
    };
    ${body}
  })()`;
}

async function openSession() {
  await getJson(`http://127.0.0.1:${port}/json/version`);
  const list = await getJson(`http://127.0.0.1:${port}/json/list`);
  const target =
    list.find(t => t.type === 'page' && t.url?.includes('cloudflare.com')) ||
    list.find(t => t.type === 'page') ||
    list[0];
  if (!target?.webSocketDebuggerUrl) throw new Error('NO_EDGE');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
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
      const id = nextId++;
      pending.set(id, { resolve: res, reject: rej });
      ws.send(JSON.stringify({ id, method, params }));
    });

  return {
    async nav(url, waitMs = 18000) {
      await send('Page.navigate', { url });
      await new Promise(r => setTimeout(r, waitMs));
    },
    async reload(waitMs = 22000) {
      await send('Page.reload', { ignoreCache: false });
      await new Promise(r => setTimeout(r, waitMs));
    },
    eval: async body => {
      const r = await send('Runtime.evaluate', {
        expression: pageScript(body),
        awaitPromise: true,
        returnByValue: true,
      });
      return r.result?.value;
    },
    close: () => ws.close(),
  };
}

loadAllCredentials();
const auth = resolveCfAuth();
const zoneId = await resolveZoneId(auth);
let audit = await auditToken(auth, zoneId);
if (isFullToken(audit)) {
  console.log('Token already complete:\n');
  printAudit(audit);
  process.exit(0);
}

let s;
try {
  s = await openSession();
} catch {
  spawn('npm', ['run', 'cf:edge-dashboard'], { shell: true, detached: true, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 25000));
  s = await openSession();
}

try {
  await s.nav('https://dash.cloudflare.com/profile/api-tokens', 8000);

  const prep = await s.eval(`
    const cookies = clickMatch('allow all|alle erlauben|alle cookies|accept all');
    await sleep(2500);
    const body = allText();
    return { cookies, hasToken: ${TOKEN_NAME_HINT}.test(body), hasLogin: /log in|anmelden|sign in/i.test(body), sample: body.slice(0, 400) };
  `);
  console.log('Prep:', JSON.stringify(prep));

  if (prep?.hasLogin && !prep?.hasToken) {
    console.error('\nNot signed in to Cloudflare in Edge (port ' + port + ').');
    console.error('Run: npm run cf:edge-dashboard — sign in — then re-run this script.');
    process.exit(1);
  }

  if (!prep?.hasToken) {
    await s.reload(25000);
  }

  const opened = await s.eval(`
    if (!${TOKEN_NAME_HINT}.test(allText())) {
      return { error: 'token_row_missing', sample: allText().slice(0, 500) };
    }

    let editClicked = null;
    for (const row of document.querySelectorAll('tr, [role="row"], li')) {
      const t = (row.innerText || '').replace(/\\s+/g, ' ');
      if (!${TOKEN_NAME_HINT}.test(t)) continue;
      for (const el of row.querySelectorAll('a, button, [role="button"]')) {
        if (!visible(el)) continue;
        if (/bearbeiten|edit/i.test(txt(el))) {
          el.click();
          editClicked = txt(el);
          break;
        }
      }
      if (editClicked) break;
    }

    if (!editClicked) {
      const direct = document.querySelector('a[href*="${TOKEN_ID}"]');
      if (direct) { direct.click(); editClicked = 'href'; }
    }

    if (!editClicked) {
      location.href = 'https://dash.cloudflare.com/profile/api-tokens/${TOKEN_ID}/edit';
      editClicked = 'navigate';
    }

    await sleep(12000);
    return { editClicked, url: location.href, sample: allText().slice(0, 600) };
  `);
  console.log('Open edit:', JSON.stringify(opened));

  if (opened?.error === 'token_row_missing') {
    console.error('\nNIKA-Purge-Cache row not found. Sign in and open API tokens list first.');
    process.exit(1);
  }

  const result = await s.eval(`
    const body = allText();
    if (/log in|anmelden|sign in/i.test(body) && !/zone|berechtigung|permission/i.test(body)) {
      return { error: 'not_logged_in', sample: body.slice(0, 300) };
    }

    const hits = [];
    const zr = /zone rules|zonen.regeln|zonenregeln|zone ruleset/i;
    const ed = /edit|bearbeiten/i;

    clickMatch('custom token|benutzerdefiniert|create custom|token erstellen');
    await sleep(500);

    for (const el of document.querySelectorAll('button, [role="button"], summary, label, span, a, div')) {
      if (!visible(el)) continue;
      const t = txt(el);
      if (zr.test(t) && t.length < 80) { el.click(); hits.push('open:' + t); await sleep(600); }
    }

    for (const el of document.querySelectorAll('input[type="checkbox"], [role="checkbox"]')) {
      if (!visible(el)) continue;
      const row = (el.closest('tr,li,div,label')?.innerText || '').replace(/\\s+/g, ' ');
      if (zr.test(row) && ed.test(row) && !el.checked) {
        el.click();
        hits.push('check:' + row.slice(0, 100));
        await sleep(400);
      }
    }

    for (const el of document.querySelectorAll('label, span, button, [role="option"]')) {
      if (!visible(el)) continue;
      const t = txt(el);
      if (zr.test(t) && ed.test(t) && t.length < 120) {
        el.click();
        hits.push('tap:' + t.slice(0, 80));
        await sleep(250);
      }
    }

    await sleep(2000);
    const cont = clickMatch('continue to summary|weiter zur zusammenfassung|fortfahren|continue|weiter');
    await sleep(3500);
    const upd = clickMatch('token aktualisieren|update token|speichern|save|aktualisieren');
    await sleep(3500);
    const ok = clickMatch('token aktualisieren|update token|bestätigen|confirm|fertig');

    await sleep(5000);
    return { hits, cont, upd, ok, url: location.href, sample: allText().slice(0, 1400) };
  `);

  console.log(JSON.stringify(result, null, 2));
  if (result?.error === 'not_logged_in') {
    console.error('\nSign in via: npm run cf:edge-dashboard');
    process.exit(1);
  }
} finally {
  s.close();
}

audit = await auditToken(auth, zoneId);
console.log('\nToken audit:\n');
printAudit(audit);
process.exit(isFullToken(audit) ? 0 : 1);
