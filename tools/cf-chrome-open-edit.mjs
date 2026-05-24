/**
 * Open NIKA-Purge-Cache edit form in Chrome CDP (no Page.navigate — click Bearbeiten).
 */
process.env.CF_CDP_BROWSER = 'chrome';
process.env.CF_CDP_PORT = process.env.CF_CDP_PORT || '9226';

const { EXISTING_PURGE_TOKEN_ID } = await import('./lib/cf-api-token.mjs');
const { connectCfTab, ensureCfCdp, sleep } = await import('./lib/cf-cdp.mjs');

const LIST = 'https://dash.cloudflare.com/profile/api-tokens';

await ensureCfCdp(LIST);
const session = await connectCfTab();

const OPEN = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const norm = s => (s || '').replace(/\\s+/g, ' ').trim();
  if (!location.href.includes('/profile/api-tokens')) {
    location.href = '${LIST}';
    await sleep(8000);
  }
  for (const b of document.querySelectorAll('button')) {
    if (/alle erlauben|allow all/i.test(norm(b.innerText))) { b.click(); await sleep(500); break; }
  }
  const row = [...document.querySelectorAll('tr')].find(r => /NIKA-Purge-Cache/i.test(r.innerText || ''));
  if (!row) return { ok: false, err: 'no_row', url: location.href };
  const menu = row.querySelector('button[aria-label="Aktionen"], button[aria-label="Actions"]');
  if (menu) { menu.click(); await sleep(900); }
  for (const el of document.querySelectorAll('[role=menuitem], button, a')) {
    if (/^bearbeiten$|^edit$/i.test(norm(el.innerText))) {
      el.click();
      await sleep(12000);
      return { ok: true, step: 'menu', url: location.href, selects: document.querySelectorAll('select').length };
    }
  }
  const link = row.querySelector('a[href*="${EXISTING_PURGE_TOKEN_ID}"]');
  if (link) { link.click(); await sleep(12000); return { ok: true, step: 'link', url: location.href, selects: document.querySelectorAll('select').length }; }
  return { ok: false, err: 'no_edit', url: location.href };
})()`;

try {
  console.log('Opening edit via menu click…');
  const r = await session.eval(OPEN, 60000);
  console.log(JSON.stringify(r, null, 2));
  await sleep(5000);
  const dump = await import('./cf-dump-edit-form.mjs').catch(() => null);
} finally {
  session.close();
}
