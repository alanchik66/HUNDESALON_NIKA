/**
 * List Bing Webmaster sites and signed-in account hints via Edge CDP (port 9224).
 * Run: npm run bing:edge  (sign in)  then  npm run bing:audit
 */
const port = Number(process.env.BING_EDGE_PORT || 9224);
const targets = [
  'https://www.bing.com/webmasters/home',
  'https://www.bing.com/webmasters/settings/user',
];

let nextId = 1;
const pending = new Map();

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function getTarget() {
  const list = await getJson(`http://127.0.0.1:${port}/json/list`);
  const pages = list.filter(t => t.type === 'page');
  return pages.find(t => t.url.includes('bing.com/webmaster')) || pages[0];
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

async function evaluate(send, expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'evaluate failed');
  }
  return result.result.value;
}

async function scrapePage(send) {
  return evaluate(
    send,
    `(() => {
      const text = document.body ? document.body.innerText : '';
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({ href: a.href, text: (a.innerText || '').trim().slice(0, 120) }))
        .filter(l => l.href.includes('webmaster') || /hundesalon|nika/i.test(l.text + l.href));
      const siteCards = Array.from(document.querySelectorAll('[class*="site"], [data-site], li, tr'))
        .map(el => (el.innerText || '').trim())
        .filter(t => t && t.length < 400 && /hundesalon|\\.com|nika/i.test(t));
      const emails = [...text.matchAll(/[\\w.+-]+@[\\w.-]+\\.[a-z]{2,}/gi)].map(m => m[0]);
      const microsoftIds = [...text.matchAll(/[a-z0-9._%+-]+@(outlook|hotmail|live|msn)\\.com/gi)].map(m => m[0]);
      return {
        url: location.href,
        title: document.title,
        emails: [...new Set(emails)].slice(0, 10),
        microsoftEmails: [...new Set(microsoftIds)].slice(0, 10),
        hundesalonLinks: links.filter(l => /hundesalon|nika/i.test(l.href + l.text)),
        siteSnippets: [...new Set(siteCards)].slice(0, 20),
        textSample: text.slice(0, 3500),
      };
    })()`
  );
}

const target = await getTarget().catch(() => null);
if (!target?.webSocketDebuggerUrl) {
  console.error(`Edge not on port ${port}. Run: npm run bing:edge`);
  process.exit(1);
}

const { ws, send } = await connect(target.webSocketDebuggerUrl);

try {
  await send('Runtime.enable');
  await send('Page.enable');

  const report = { scrapedAt: new Date().toISOString(), pages: [] };

  for (const url of targets) {
    await send('Page.navigate', { url });
    await wait(6000);
    const data = await scrapePage(send);
    report.pages.push(data);
  }

  const hundesalonEntries = report.pages.flatMap(p => p.hundesalonLinks || []);
  const uniqueSites = [...new Set(hundesalonEntries.map(l => l.href))];
  const allEmails = [...new Set(report.pages.flatMap(p => [...(p.emails || []), ...(p.microsoftEmails || [])]))];

  report.summary = {
    uniqueHundesalonUrls: uniqueSites,
    hundesalonLinkCount: hundesalonEntries.length,
    possibleDuplicateSite: uniqueSites.length > 1 || hundesalonEntries.length > 2,
    emailsFound: allEmails,
    projectVerification: {
      msvalidate: 'B67A37AB236F9D14E1F99A12DDCA531C',
      bingSiteAuthXml: 'BingSiteAuth.xml on site root',
      canonicalDomain: 'https://hundesalon-nika.com/',
    },
  };

  console.log(JSON.stringify(report, null, 2));
} finally {
  ws.close();
}
