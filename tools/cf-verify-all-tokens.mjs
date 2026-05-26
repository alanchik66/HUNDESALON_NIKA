/**
 * Verify Cloudflare API token permissions + list Dashboard tokens via Chrome CDP.
 * npm run cf:verify-tokens
 */
import {
  auditToken,
  isFullToken,
  loadAllCredentials,
  printAudit,
  resolveCfAuth,
} from './lib/cf-api-token.mjs';
import { resolveZoneId } from './lib/cloudflare-auth.mjs';

const LIST_SCAN = `(async () => {
  const norm = s => (s || '').replace(/\\s+/g, ' ').trim();
  const rows = [];
  for (const tr of document.querySelectorAll('tr')) {
    const t = norm(tr.innerText);
    if (t.length < 8 || t.length > 500) continue;
    if (/token name|token-?name|api-?token/i.test(t) && rows.length === 0) continue;
    const name = t.split(/\\s{2,}/)[0] || t.slice(0, 80);
    rows.push({
      name: name.slice(0, 100),
      hasNika: /NIKA-Purge-Cache/i.test(t),
      hasAgent: /cloudflare agent|konto\\.access/i.test(t),
      snippet: t.slice(0, 160),
    });
  }
  const uniq = [];
  const seen = new Set();
  for (const r of rows) {
    const k = r.snippet.slice(0, 80);
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(r);
  }
  return {
    url: location.href,
    title: document.title,
    onEdit: /\\/edit/.test(location.href),
    rows: uniq.slice(0, 25),
    bodyHasNika: /NIKA-Purge-Cache/i.test(document.body?.innerText || ''),
    bodyHasZoneRules: /zonen.?regeln|zone rules/i.test(document.body?.innerText || ''),
  };
})()`;

async function scanCdp(port, label) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const t = list.find(x => x.type === 'page' && x.url?.includes('cloudflare.com'));
    if (!t?.webSocketDebuggerUrl) return { label, port, ok: false, err: 'no_cf_tab' };

    let nextId = 1;
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
        const id = nextId++;
        pending.set(id, { resolve: res, reject: rej });
        ws.send(JSON.stringify({ id, method, params }));
      });
    const r = await send('Runtime.evaluate', {
      expression: LIST_SCAN,
      awaitPromise: true,
      returnByValue: true,
      timeout: 30000,
    });
    ws.close();
    return { label, port, ok: true, tab: t.url, scan: r.result?.value };
  } catch (e) {
    const msg = String(e?.message || 'unknown');
    if (/fetch failed|ECONNREFUSED|connect|network/i.test(msg)) {
      return { label, port, ok: null, skipped: true, reason: 'debug_port_unavailable' };
    }
    return { label, port, ok: false, err: msg };
  }
}

loadAllCredentials();
const auth = resolveCfAuth();
const zoneId = await resolveZoneId(auth);
const audit = await auditToken(auth, zoneId);

console.log('=== API token in .dev.vars (live checks) ===\n');
printAudit(audit);
console.log('Full token:', isFullToken(audit) ? 'YES' : 'NO');

console.log('\n=== Browser tabs (Cloudflare Dashboard) ===\n');
for (const { port, label } of [
  { port: 9226, label: 'Chrome debug' },
  { port: 9225, label: 'Edge debug' },
]) {
  const r = await scanCdp(port, label);
  console.log(JSON.stringify(r, null, 2));
  console.log('');
}

console.log('Note: skipped debug ports are informational and do not affect token validity.');

process.exit(isFullToken(audit) ? 0 : 1);
