/**
 * Full CDP flow: list → Bearbeiten → add Zone Rules → save.
 */
process.env.CF_CDP_BROWSER = 'chrome';
process.env.CF_CDP_PORT = process.env.CF_CDP_PORT || '9222';

import {
  auditToken,
  EXISTING_PURGE_TOKEN_ID,
  isFullToken,
  loadAllCredentials,
  printAudit,
  resolveCfAuth,
  saveApiToken,
  verifyBearerToken,
} from './lib/cf-api-token.mjs';
import { resolveZoneId } from './lib/cloudflare-auth.mjs';
import { connectCfTab, ensureCfCdp, sleep } from './lib/cf-cdp.mjs';

const LIST = 'https://dash.cloudflare.com/profile/api-tokens';
const TOKEN_ID = EXISTING_PURGE_TOKEN_ID;

const FLOW = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const norm = s => (s || '').replace(/\\s+/g, ' ').trim();
  const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const inCookie = el => !!el?.closest('#onetrust-consent-sdk');

  const out = { steps: [], url: location.href };

  if (/prüfcode senden|verifizierung/i.test(document.body?.innerText || '')) {
    return { ...out, blocked: 'email_verify' };
  }

  for (const b of document.querySelectorAll('button')) {
    if (!visible(b) || inCookie(b)) continue;
    if (/alle erlauben|allow all/i.test(norm(b.innerText))) { b.click(); out.steps.push('cookies'); await sleep(600); break; }
  }

  if (!location.href.includes('/profile/api-tokens')) {
    location.href = '${LIST}';
    await sleep(10000);
    out.steps.push('goto_list');
  }

  const row = [...document.querySelectorAll('tr')].find(r => /NIKA-Purge-Cache/i.test(r.innerText || ''));
  if (row) {
    const menu = row.querySelector('button[aria-label="Aktionen"], button[aria-label="Actions"]');
    if (menu) { menu.click(); out.steps.push('menu'); await sleep(1000); }
    let clicked = false;
    for (const el of document.querySelectorAll('[role=menuitem], button, a')) {
      if (/^bearbeiten$|^edit$/i.test(norm(el.innerText))) {
        el.click();
        out.steps.push('bearbeiten');
        clicked = true;
        await sleep(18000);
        break;
      }
    }
    if (!clicked) {
      const a = row.querySelector('a[href*="${TOKEN_ID}"]');
      if (a) { a.click(); out.steps.push('href'); await sleep(18000); }
    }
  } else {
    location.assign('${LIST}/${TOKEN_ID}/edit');
    await sleep(14000);
    out.steps.push('direct_edit');
  }

  out.url = location.href;
  out.selects = document.querySelectorAll('select').length;
  out.sample = norm(document.body?.innerText || '').slice(0, 500);

  if (/prüfcode senden|verifizierung/i.test(document.body?.innerText || '')) {
    return { ...out, blocked: 'email_verify' };
  }

  for (const el of document.querySelectorAll('button, a')) {
    if (!visible(el) || inCookie(el)) continue;
    if (/weitere hinzufügen|add more/i.test(norm(el.innerText))) { el.click(); out.steps.push('add_row'); await sleep(1500); break; }
  }

  const selects = [...document.querySelectorAll('select')].filter(visible);
  if (selects.length >= 3) {
    const s = selects.slice(-3);
    const pick = (sel, re) => {
      const o = [...sel.options].find(x => re.test(norm(x.text)));
      if (o) { sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); return o.text; }
      return null;
    };
    out.h1 = pick(s[0], /^zone$/i);
    out.h2 = pick(s[1], /zonen.?regeln|zone rules/i);
    out.h3 = pick(s[2], /bearbeiten|^edit$/i);
    out.steps.push('selects');
  }

  const clickBtn = re => {
    for (const b of document.querySelectorAll('button')) {
      if (!visible(b) || inCookie(b) || b.disabled) continue;
      if (re.test(norm(b.innerText))) { b.click(); return norm(b.innerText); }
    }
    return null;
  };

  out.cont = clickBtn(/weiter zur zusammenfassung|continue to summary/i);
  await sleep(3000);
  out.save = clickBtn(/token aktualisieren|update token/i);
  await sleep(3000);
  out.confirm = clickBtn(/bestätigen|confirm/i);
  await sleep(2000);

  const tok = (document.body?.innerText || '').match(/cfk_[A-Za-z0-9_-]{20,}/);
  out.newToken = tok ? tok[0].slice(0, 12) + '…' : null;
  out.selectsAfter = document.querySelectorAll('select').length;
  return out;
})()`;

loadAllCredentials();
const auth = resolveCfAuth();
const zoneId = await resolveZoneId(auth);

await ensureCfCdp(LIST);
console.log('Wait 25s for SPA…');
await sleep(25000);

const session = await connectCfTab();
try {
  const r = await session.eval(FLOW, 120000);
  console.log(JSON.stringify(r, null, 2));

  if (r?.blocked === 'email_verify') {
    console.error('\nНужен код из почты — нажмите Prüfcode senden в окне Chrome (9226).');
    process.exit(1);
  }

} finally {
  session.close();
}

let audit = await auditToken(auth, zoneId);
console.log('\nAudit:\n');
printAudit(audit);
process.exit(isFullToken(audit) ? 0 : 1);
