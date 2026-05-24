/**
 * Interactive Cloudflare token fix: auto when possible, else wait for user then continue.
 *
 * npm run cf:fix-token-interactive     — start / wait for you
 * npm run cf:confirm-token           — after you clicked in Edge 9225, continue automation
 */
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  auditToken,
  EXISTING_PURGE_TOKEN_ID,
  isFullToken,
  loadAllCredentials,
  printAudit,
  resolveCfAuth,
} from './lib/cf-api-token.mjs';
import { resolveZoneId } from './lib/cloudflare-auth.mjs';
import { connectCfTab, ensureCfEdge, sleep } from './lib/cf-edge-cdp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FLAG = path.join(root, 'temp', 'cf-token-user-ready.flag');
const EDIT = `https://dash.cloudflare.com/profile/api-tokens/${EXISTING_PURGE_TOKEN_ID}/edit`;
const mode = process.argv[2] || 'auto';
const WAIT_SPA_MS = Number(process.env.CF_SPA_WAIT_MS || 40000);
const POLL_MS = Number(process.env.CF_POLL_MS || 8000);
const MAX_WAIT_MS = Number(process.env.CF_MAX_WAIT_MS || 600000);

const SCAN = `(() => {
  const norm = s => (s || '').replace(/\\s+/g, ' ').trim();
  const zr = /zone rules|zonen.?regeln|zonenregeln|rulesets?|regelsätze/i;
  const ed = /edit|bearbeiten|ändern/i;
  const texts = [];
  const w = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const t = n.textContent.trim();
    if (t.length > 2 && t.length < 200) texts.push(t);
  }
  const uniq = [...new Set(texts)];
  const boxes = [...document.querySelectorAll('input[type=checkbox]')].map(el => ({
    checked: el.checked,
    row: norm(el.closest('tr,li,motion.div,motion,motion,motion,motion,motion,motion,div,label,section')?.innerText || '').slice(0, 120),
  }));
  const zrBoxes = boxes.filter(b => zr.test(b.row) && ed.test(b.row));
  const hasNika = uniq.some(t => /NIKA-Purge-Cache/i.test(t));
  return {
    url: location.href,
    hasNika,
    onEdit: location.href.includes('/edit'),
    count: uniq.length,
    zrBoxes,
    zrLabels: uniq.filter(t => zr.test(t)).slice(0, 8),
    title: document.title,
  };
})()`;

const OPEN_MENU = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const norm = s => (s || '').replace(/\\s+/g, ' ').trim();
  for (const b of document.querySelectorAll('button')) {
    if (/alle erlauben|^allow all$/i.test(norm(b.innerText))) { b.click(); await sleep(500); break; }
  }
  const row = [...document.querySelectorAll('tr')].find(r => /NIKA-Purge-Cache/i.test(r.innerText || ''));
  if (!row) return { ok: false, err: 'no_row' };
  row.querySelector('button[aria-label="Aktionen"], button[aria-label="Actions"]')?.click();
  await sleep(900);
  for (const el of document.querySelectorAll('[role=menuitem]')) {
    if (/^bearbeiten$|^edit$/i.test(norm(el.innerText))) { el.click(); return { ok: true, step: 'bearbeiten' }; }
  }
  return { ok: false, err: 'no_menu' };
})()`;

const APPLY_AND_SAVE = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const norm = s => (s || '').replace(/\\s+/g, ' ').trim();
  const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const inCookie = el => !!el?.closest('#onetrust-consent-sdk, #onetrust-banner-sdk');
  const zr = /zone rules|zonen.?regeln|zonenregeln|rulesets?|regelsätze/i;
  const ed = /edit|bearbeiten|ändern/i;
  const hits = [];

  const clickBtn = (re, skipCookie = true) => {
    for (const b of document.querySelectorAll('button,[role=button]')) {
      if (!visible(b) || b.disabled) continue;
      if (skipCookie && inCookie(b)) continue;
      const t = norm(b.innerText || b.getAttribute('aria-label') || '');
      if (re.test(t)) { b.click(); return t; }
    }
    return null;
  };

  for (const el of document.querySelectorAll('button, summary, [role=button], label, span, h3, h4')) {
    if (!visible(el) || inCookie(el)) continue;
    const t = norm(el.innerText || '');
    if (/^zone$/i.test(t) || /^zone permissions$/i.test(t)) { el.click(); hits.push('exp:' + t); await sleep(400); }
  }

  for (const el of document.querySelectorAll('input[type=checkbox], [role=checkbox]')) {
    if (!visible(el) || inCookie(el)) continue;
    const rowT = norm(el.closest('tr,li,motion.div,motion,motion,motion,motion,motion,motion,div,label,section')?.innerText || '');
    if (!rowT || /cookie|functional|targeting|performance/i.test(rowT)) continue;
    if (zr.test(rowT) && ed.test(rowT)) {
      if (!el.checked) { el.click(); hits.push('on:' + rowT.slice(0, 90)); }
      else hits.push('had:' + rowT.slice(0, 90));
      await sleep(300);
    }
  }

  for (const el of document.querySelectorAll('label, span, button, [role=option]')) {
    if (!visible(el) || inCookie(el)) continue;
    const t = norm(el.innerText || '');
    if (zr.test(t) && ed.test(t) && t.length < 100) { el.click(); hits.push('tap:' + t.slice(0, 70)); await sleep(200); }
  }

  await sleep(600);
  const cont = clickBtn(/weiter zur zusammenfassung|continue to summary|fortfahren/i);
  await sleep(2800);
  const save = clickBtn(/token aktualisieren|update token/i);
  await sleep(2800);
  const ok = clickBtn(/bestätigen|confirm/i);
  await sleep(2000);

  return { hits, cont, save, ok, url: location.href };
})()`;

function notifyUser() {
  const msg = `
╔══════════════════════════════════════════════════════════════════╗
║  НУЖНО ВАШЕ ДЕЙСТВИЕ — Cloudflare API Token                      ║
╠══════════════════════════════════════════════════════════════════╣
║  Окно Edge с отладкой (порт 9225), НЕ обычный браузер:           ║
║                                                                  ║
║  1) Список API-Token → строка NIKA-Purge-Cache                   ║
║  2) Кнопка ⋯ (Aktionen) → Bearbeiten                             ║
║  3) Раздел Zone → галочка Zone Rules → Edit                      ║
║     (Zonen-Regeln → Bearbeiten)                                  ║
║  4) Weiter zur Zusammenfassung → Token aktualisieren            ║
║                                                                  ║
║  Либо в обычном Edge (уже открыт):                               ║
║  ${EDIT}
║                                                                  ║
║  Когда сделали — в терминале:                                    ║
║    npm run cf:confirm-token                                      ║
║  или напишите в чат: готово                                      ║
╚══════════════════════════════════════════════════════════════════╝
`;
  console.log(msg);
  try {
    execSync(
      `powershell -NoProfile -Command "[console]::beep(880,400); [console]::beep(1100,400)"`,
      { stdio: 'ignore' }
    );
  } catch {
    // ignore
  }
  spawn('npm', ['run', 'cf:open-edit-token'], { shell: true, detached: true, stdio: 'ignore' }).unref();
}

function formReady(scan) {
  return scan?.zrBoxes?.length > 0 || (scan?.onEdit && scan?.zrLabels?.length > 0);
}

async function runSave(session) {
  console.log('Applying Zone Rules Edit + saving…');
  const applied = await session.eval(APPLY_AND_SAVE, 60000);
  console.log(JSON.stringify(applied, null, 2));
  return applied;
}

async function main() {
  loadAllCredentials();
  const auth = resolveCfAuth();
  const zoneId = await resolveZoneId(auth);

  let audit = await auditToken(auth, zoneId);
  if (isFullToken(audit)) {
    console.log('Token already complete:\n');
    printAudit(audit);
    return 0;
  }

  if (mode === 'confirm') {
    mkdirSync(path.dirname(FLAG), { recursive: true });
    writeFileSync(FLAG, new Date().toISOString(), 'utf8');
    console.log('Flag set — continuing automation…');
  } else if (existsSync(FLAG)) {
    unlinkSync(FLAG);
  }

  await ensureCfEdge();
  if (mode !== 'confirm') {
    console.log(`Waiting ${WAIT_SPA_MS / 1000}s for Cloudflare SPA…`);
    await sleep(WAIT_SPA_MS);
  }

  const session = await connectCfTab();
  try {
    let scan = await session.eval(SCAN);
    console.log('Scan:', JSON.stringify(scan, null, 2));

    if (!formReady(scan) && mode !== 'confirm') {
      const opened = await session.eval(OPEN_MENU, 15000);
      console.log('Open menu:', JSON.stringify(opened));
      await sleep(5000);
      scan = await session.eval(SCAN);
      console.log('Scan after Bearbeiten:', JSON.stringify(scan, null, 2));
    }

    if (formReady(scan)) {
      await runSave(session);
    } else if (mode === 'confirm') {
      notifyUser();
      console.error('Form still not visible in CDP. Complete steps in Edge 9225, then run cf:confirm-token again.');
      return 1;
    } else {
      notifyUser();
      mkdirSync(path.dirname(FLAG), { recursive: true });
      const deadline = Date.now() + MAX_WAIT_MS;
      console.log(`Polling every ${POLL_MS / 1000}s (max ${MAX_WAIT_MS / 60000} min)…\n`);

      while (Date.now() < deadline) {
        if (existsSync(FLAG)) {
          console.log('User confirmed via cf:confirm-token');
          break;
        }
        audit = await auditToken(auth, zoneId);
        if (isFullToken(audit)) {
          console.log('API reports token complete (you saved manually).');
          session.close();
          printAudit(audit);
          return 0;
        }
        await sleep(POLL_MS);
        scan = await session.eval(SCAN);
        if (formReady(scan)) {
          console.log('Edit form detected in CDP — continuing…');
          await runSave(session);
          break;
        }
        process.stdout.write(`\r…ожидание (${new Date().toLocaleTimeString()}) — npm run cf:confirm-token когда готово   `);
      }
      console.log('');
    }
  } finally {
    session.close();
  }

  if (existsSync(FLAG)) unlinkSync(FLAG);

  audit = await auditToken(auth, zoneId);
  console.log('\nFinal audit:');
  printAudit(audit);

  if (!isFullToken(audit)) {
    console.log('\nStill incomplete. Save token in Dashboard, then: npm run cf:confirm-token');
    return 1;
  }

  console.log('\nRunning post-token checks…');
  spawn('npm', ['run', 'check:live-robots'], { shell: true, stdio: 'inherit', cwd: root });
  return 0;
}

main().then(code => process.exit(code)).catch(e => {
  console.error(e.message);
  process.exit(1);
});
