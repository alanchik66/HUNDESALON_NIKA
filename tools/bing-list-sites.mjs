/**
 * Open Bing Webmaster site picker and list all sites on the account.
 */
const port = Number(process.env.BING_EDGE_PORT || 9224);

let nextId = 1;
const pending = new Map();

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
  });
  return new Promise((resolve, reject) => {
    ws.addEventListener('open', () => {
      const send = (method, params = {}) =>
        new Promise((res, rej) => {
          const id = nextId++;
          pending.set(id, { resolve: res, reject: rej });
          ws.send(JSON.stringify({ id, method, params }));
        });
      resolve({ ws, send });
    });
    ws.addEventListener('error', reject);
  });
}

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const list = await getJson(`http://127.0.0.1:${port}/json/list`);
const target = list.find(t => t.type === 'page' && t.url.includes('bing.com')) || list.find(t => t.type === 'page');
if (!target?.webSocketDebuggerUrl) {
  console.error('Edge not found. Run: npm run bing:edge');
  process.exit(1);
}

const { ws, send } = await connect(target.webSocketDebuggerUrl);

try {
  await send('Runtime.enable');
  await send('Page.navigate', { url: 'https://www.bing.com/webmasters/home?siteUrl=https://hundesalon-nika.com/' });
  await wait(6000);

  const result = await send('Runtime.evaluate', {
    expression: `(async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
      const norm = s => (s || '').replace(/\\s+/g, ' ').trim();

      const headerText = norm(document.querySelector('header')?.innerText || document.body?.innerText?.slice(0, 500));

      const profileBtn = Array.from(document.querySelectorAll('button, [role="button"], a'))
        .find(el => visible(el) && /^(AR|profile|профиль|account)$/i.test(norm(el.innerText).slice(0, 20)));
      if (profileBtn) {
        profileBtn.click();
        await sleep(2000);
      }

      const siteSwitcher = Array.from(document.querySelectorAll('button, [role="button"], a'))
        .find(el => visible(el) && /hundesalon-nika\\.com/i.test(norm(el.innerText)));
      if (siteSwitcher) {
        siteSwitcher.click();
        await sleep(2500);
      }

      const siteLines = Array.from(document.querySelectorAll('a, li, button, [role="option"], [role="menuitem"]'))
        .map(el => norm(el.innerText))
        .filter(t => t && t.length < 100 && (/\\.com\\b|hundesalon|www\\./i.test(t) || /add site|добавить сайт/i.test(t)));

      const accountHints = Array.from(document.querySelectorAll('[aria-label], img[alt], [class*="user"], [class*="profile"]'))
        .map(el => norm(el.getAttribute('aria-label') || el.getAttribute('alt') || el.innerText))
        .filter(t => t && t.length < 80);

      const hundesalon = [...new Set(siteLines.filter(t => /hundesalon|nika/i.test(t)))];
      const allDomains = [...new Set(siteLines.filter(t => /[a-z0-9-]+\\.[a-z]{2,}/i.test(t)))];

      return {
        url: location.href,
        title: document.title,
        headerText,
        hundesalonSites: hundesalon,
        allDomains,
        accountHints: [...new Set(accountHints)].slice(0, 15),
        duplicateHundesalon: hundesalon.length > 1,
        bodySample: norm(document.body?.innerText || '').slice(0, 2000),
      };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  const data = result.result?.value || result.value;
  console.log(JSON.stringify(data, null, 2));

  if (data.duplicateHundesalon) {
    console.log('\n⚠ Найдено несколько записей hundesalon — проверьте вручную в переключателе сайтов.');
  } else if (data.hundesalonSites?.length === 1) {
    console.log('\n✓ Один сайт hundesalon-nika.com на этом аккаунте Microsoft.');
  } else if (data.hundesalonSites?.length === 0) {
    console.log('\n? Сайт не найден в списке — возможно другой аккаунт Microsoft или сайт не добавлен.');
  }
} finally {
  ws.close();
}
