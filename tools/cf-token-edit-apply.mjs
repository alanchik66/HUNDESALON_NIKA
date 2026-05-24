/**
 * Edit NIKA-Purge-Cache via Cloudflare Dashboard CDP (Edge 9225).
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
const EDIT_HREF = `/profile/api-tokens/${EXISTING_PURGE_TOKEN_ID}/edit`;

async function connect() {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = list.find(t => t.type === 'page' && t.url?.includes('cloudflare.com'));
  if (!target?.webSocketDebuggerUrl) throw new Error('NO_CF_TAB');

  let nextId = 1;
  const pending = new Map();
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

  return { send, close: () => ws.close() };
}

loadAllCredentials();
const auth = resolveCfAuth();

const { send, close } = await connect();
let result;
let clicks;
try {
  await send('Runtime.enable');
  const { result: evalResult } = await send('Runtime.evaluate', {
    expression: `({
      href: location.href,
      editLinks: [...document.querySelectorAll('a[href]')]
        .filter(a => a.href.includes('${EXISTING_PURGE_TOKEN_ID}'))
        .map(a => ({ href: a.href, text: (a.innerText||'').trim() })),
      purgeRow: [...document.querySelectorAll('tr,[role="row"]')]
        .filter(r => /NIKA-Purge-Cache/i.test(r.innerText||''))
        .map(r => (r.innerText||'').replace(/\\s+/g,' ').slice(0,150)),
    })`,
    returnByValue: true,
  });
  result = evalResult?.value;
  console.log('Page state:', JSON.stringify(result, null, 2));

  if (!locationHasEdit(result?.href)) {
    const editLink = result?.editLinks?.find(l => l.href.includes('/edit'));
    if (editLink) {
      await send('Page.navigate', { url: editLink.href });
      await new Promise(r => setTimeout(r, 18000));
    }
  }

  const clickResult = await send('Runtime.evaluate', {
    expression: `(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const zr = /zone rules|zonen.?regeln|zonenregeln/i;
      const ed = /edit|bearbeiten/i;
      const hits = [];
      const boxes = [...document.querySelectorAll('input[type=checkbox]')];
      for (const el of boxes) {
        const row = (el.closest('tr,li,motion.div,div')?.innerText || '').replace(/\\s+/g,' ');
        if (zr.test(row) && ed.test(row) && !el.checked) {
          el.click();
          hits.push(row.slice(0,100));
        }
      }
      const click = re => {
        for (const b of document.querySelectorAll('button,[role=button]')) {
          const t = (b.innerText||b.getAttribute('aria-label')||'').trim();
          if (re.test(t)) { b.click(); return t; }
        }
        return null;
      };
      await sleep(800);
      const cont = click(/weiter|continue|fortfahren/i);
      await sleep(2000);
      const save = click(/aktualisieren|update token|speichern|save/i);
      await sleep(2000);
      const ok = click(/bestätigen|confirm/i);
      return { hits, cont, save, ok, checks: boxes.length };
    })()`,
    awaitPromise: true,
    returnByValue: true,
    timeout: 20000,
  });
  clicks = clickResult.result?.value;
  console.log('Clicks:', JSON.stringify(clicks, null, 2));
} finally {
  close();
}

function locationHasEdit(href) {
  return href?.includes(EXISTING_PURGE_TOKEN_ID) && href?.includes('/edit');
}

let audit;
try {
  const zoneId = await resolveZoneId(auth);
  audit = await auditToken(auth, zoneId);
  console.log('\nToken audit:\n');
  printAudit(audit);
  process.exit(isFullToken(audit) ? 0 : 1);
} catch (e) {
  console.error('\nAPI audit skipped:', e.message);
  process.exit(clicks?.hits?.length ? 0 : 1);
}
