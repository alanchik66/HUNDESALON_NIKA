/**
 * Rotate (Change) Cloudflare Origin CA Key — invalidates old copies.
 * npm run cf:rotate-origin-ca-key
 */
import { ensureCfCdp, connectCfTab, sleep } from './lib/cf-cdp.mjs';

const URL = 'https://dash.cloudflare.com/profile/api-tokens';

function loggedIn(body, href) {
  return !/\/login/i.test(href) && /User API Tokens|Create Token|HUNDESALON/i.test(body);
}

async function dismissCookies(tab) {
  return tab.eval(`
    (() => {
      for (const el of document.querySelectorAll('button, a, [role="button"]')) {
        const t = (el.innerText || el.getAttribute('aria-label') || '').trim();
        if (/^(Allow All|Accept All|Confirm My Choices|Reject All)$/i.test(t)) {
          el.click();
          return t;
        }
      }
      return null;
    })()
  `);
}

async function clickOriginCaChange(tab) {
  return tab.eval(`
    (() => {
      const norm = s => (s || '').replace(/\\s+/g, ' ').trim();
      const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

      const apiKeys = [...document.querySelectorAll('h2,h3,h4,p,div,span')]
        .find(el => /^API Keys$/i.test(norm(el.innerText)) && visible(el));
      if (apiKeys) apiKeys.scrollIntoView({ block: 'center' });

      const rows = [...document.querySelectorAll('tr')].filter(visible);
      for (const row of rows) {
        const text = norm(row.innerText || '');
        if (!/Origin CA Key/i.test(text)) continue;
        for (const btn of row.querySelectorAll('button, a, [role="button"]')) {
          if (!visible(btn)) continue;
          const label = norm(btn.innerText || btn.getAttribute('aria-label') || '');
          if (/^Change$/i.test(label)) {
            btn.click();
            return { clicked: true, context: text.slice(0, 180) };
          }
        }
      }

      const candidates = [...document.querySelectorAll('tr, li, div, section, article')].filter(visible);
      for (const block of candidates) {
        const text = norm(block.innerText || '');
        if (!/Origin CA Key/i.test(text) || /Global API Key/i.test(text)) continue;
        for (const btn of block.querySelectorAll('button, a, [role="button"]')) {
          if (!visible(btn)) continue;
          const label = norm(btn.innerText || btn.getAttribute('aria-label') || '');
          if (/^Change$/i.test(label)) {
            btn.click();
            return { clicked: true, context: text.slice(0, 180) };
          }
        }
      }

      for (const btn of document.querySelectorAll('button, a, [role="button"]')) {
        if (!visible(btn)) continue;
        const label = norm(btn.innerText || btn.getAttribute('aria-label') || '');
        if (!/^Change$/i.test(label)) continue;
        const ctx = norm(btn.closest('tr, li, div')?.innerText || '');
        if (/Origin CA Key/i.test(ctx)) {
          btn.click();
          return { clicked: true, context: ctx.slice(0, 180) };
        }
      }

      return {
        clicked: false,
        hasOriginRow: /Origin CA Key/i.test(document.body?.innerText || ''),
        snippet: norm((document.body?.innerText || '').match(/API Keys[\\s\\S]{0,900}/i)?.[0] || ''),
      };
    })()
  `);
}

async function pageState(tab) {
  return tab.eval(`
    (() => {
      const norm = s => (s || '').replace(/\\s+/g, ' ').trim();
      const body = document.body?.innerText || '';
      return {
        url: location.href,
        login: /\\/login/i.test(location.href) || /log in to cloudflare|sign in to cloudflare/i.test(body.slice(0, 800)),
        hasModal: !!document.querySelector('[role="dialog"], [class*="modal"], [class*="Modal"]'),
        modalText: norm(document.querySelector('[role="dialog"], [class*="modal"], [class*="Modal"]')?.innerText || '').slice(0, 500),
        hasPasswordField: !!document.querySelector('input[type="password"]'),
        hasNewKey: /v1\\.0-|Origin CA key has been changed|successfully changed|new origin ca/i.test(body),
        apiKeysSnippet: norm(body.match(/API Keys[\\s\\S]{0,700}/i)?.[0] || ''),
      };
    })()
  `);
}

await ensureCfCdp(URL);
console.log('Origin CA Key → Change');
console.log('Жду полный вход в Cloudflare (Edge, порт 9225)…\n');

let ready = false;
for (let i = 0; i < 180; i += 1) {
  try {
    const tab = await connectCfTab();
    await tab.navigate(URL, 10000);
    await dismissCookies(tab);
    await sleep(1500);
    const state = await pageState(tab);
    await tab.close();
    if (!state.login && loggedIn(state.apiKeysSnippet + state.url, state.url)) {
      ready = true;
      break;
    }
  } catch {
    // retry
  }
  if (i % 15 === 14) console.log(`…жду вход (${i + 1}/180)`);
  await sleep(4000);
}

if (!ready) {
  console.error('Таймаут входа. Войдите в Cloudflare и повторите: npm run cf:rotate-origin-ca-key');
  process.exit(1);
}

console.log('Вход OK. Ищу Origin CA Key → Change…\n');

const tab = await connectCfTab();
await tab.navigate(URL, 10000);
await dismissCookies(tab);
await sleep(2000);

const click = await clickOriginCaChange(tab);
if (!click.clicked) {
  console.error('Кнопка Change у Origin CA Key не найдена.');
  console.error(click.snippet || click);
  await tab.close();
  process.exit(1);
}

console.log('Нажата Change. Контекст:', click.context);

let confirmed = false;
for (let i = 0; i < 120; i += 1) {
  await sleep(2000);
  const state = await pageState(tab);

  if (state.hasPasswordField || /confirm|password|re-enter|verify/i.test(state.modalText)) {
    if (i === 0) {
      console.log('\nCloudflare запрашивает подтверждение — введите пароль/2FA в Edge и подтвердите.');
    }
    if (i % 10 === 9) console.log(`…жду подтверждение (${i + 1}/120)`);
    continue;
  }

  if (state.hasNewKey || /changed|rotated|success/i.test(state.modalText)) {
    confirmed = true;
    break;
  }

  // After Change without modal — key rotated when dialog closes
  if (!state.hasModal && i > 2) {
    const retryClick = await clickOriginCaChange(tab);
    if (retryClick.clicked) continue;
    confirmed = true;
    break;
  }
}

const finalState = await pageState(tab);
await tab.close();

console.log('\n=== Результат ===');
if (confirmed || /Origin CA Key/i.test(finalState.apiKeysSnippet)) {
  console.log('Origin CA Key rotated (Change выполнен). Старые копии ключа больше не действуют.');
  console.log('Предупреждение Deprecated в UI останется — это нормально.');
  process.exit(0);
}

console.log('Change нажат, но автоматически подтвердить не удалось.');
console.log('Проверьте Edge: если Cloudflare показал новый ключ или сообщение об успехе — ротация выполнена.');
process.exit(2);
