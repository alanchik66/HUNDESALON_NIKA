export async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

export function pageScript(body, options = {}) {
  const clickSelectors = options.clickSelectors || 'a, button, [role="button"], input[type="submit"]';

  return `(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    const norm = s => (s || '').replace(/\\s+/g, ' ').trim();
    const txt = el => norm(el.innerText || el.value || el.getAttribute('aria-label') || '');
    const setNativeValue = (el, value) => {
      const proto = Object.getPrototypeOf(el);
      const d = Object.getOwnPropertyDescriptor(proto, 'value');
      if (d?.set) d.set.call(el, value);
      else el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const clickMatch = (pattern, scopeOrOptions = document) => {
      const re = new RegExp(pattern, 'i');
      const options =
        scopeOrOptions && typeof scopeOrOptions === 'object' && Object.hasOwn(scopeOrOptions, 'exclude')
          ? scopeOrOptions
          : {};
      const root = options.exclude ? document : scopeOrOptions || document;
      const ex = options.exclude ? new RegExp(options.exclude, 'i') : null;
      for (const el of root.querySelectorAll(${JSON.stringify(clickSelectors)})) {
        if (!visible(el) || el.disabled) continue;
        const t = txt(el);
        if (ex && ex.test(t)) continue;
        if (re.test(t)) { el.click(); return t; }
      }
      return null;
    };
    ${body}
  })()`;
}

export async function evalPage(send, body, options = {}) {
  const retries = options.retries ?? 4;
  let lastError;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const result = await send('Runtime.evaluate', {
        expression: pageScript(body, options),
        awaitPromise: true,
        returnByValue: true,
      });

      if (result.exceptionDetails) {
        const detail = result.exceptionDetails.exception?.description || 'eval failed';
        if (/execution context was destroyed/i.test(detail) && attempt < retries - 1) {
          await sleep(1200 + attempt * 800);
          continue;
        }
        throw new Error(detail);
      }

      return result.result?.value;
    } catch (error) {
      lastError = error;
      if (/execution context was destroyed/i.test(error.message) && attempt < retries - 1) {
        await sleep(1200 + attempt * 800);
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('eval failed');
}

export async function openCdpSession(options = {}) {
  const port = Number(options.port || 9224);
  const targetPattern = options.targetPattern || /bing/i;
  const list = await getJson(`http://127.0.0.1:${port}/json/list`);
  const target =
    list.find(item => item.type === 'page' && targetPattern.test(item.url || '')) ||
    (options.fallbackAny === false ? null : list.find(item => item.type === 'page'));

  if (!target?.webSocketDebuggerUrl) throw new Error('NO_CDP_TARGET');

  let nextId = 1;
  const pending = new Map();
  const ws = new WebSocket(target.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });

  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id) return;

    const entry = pending.get(message.id);
    if (!entry) return;

    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  if (options.enableRuntime !== false) await send('Runtime.enable');
  if (options.enablePage !== false) await send('Page.enable');

  return {
    target,
    ws,
    send,
    close: () => ws.close(),
    evaluate: async (expression, retries = 4) => {
      let lastError;
      for (let attempt = 0; attempt < retries; attempt += 1) {
        try {
          const result = await send('Runtime.evaluate', {
            expression,
            awaitPromise: true,
            returnByValue: true,
          });
          if (result.exceptionDetails) {
            const detail = result.exceptionDetails.exception?.description || 'evaluate failed';
            if (/execution context was destroyed/i.test(detail) && attempt < retries - 1) {
              await sleep(1200 + attempt * 800);
              continue;
            }
            throw new Error(detail);
          }
          return result.result?.value;
        } catch (error) {
          lastError = error;
          if (/execution context was destroyed/i.test(error.message) && attempt < retries - 1) {
            await sleep(1200 + attempt * 800);
            continue;
          }
          throw error;
        }
      }
      throw lastError || new Error('evaluate failed');
    },
    evalPage: (body, evalOptions = {}) => evalPage(send, body, evalOptions),
  };
}

export async function withCdpSession(options, task) {
  const session = await openCdpSession(options);
  try {
    return await task(session);
  } finally {
    session.close();
  }
}

export async function openBingWebmasterSession(options = {}) {
  const {
    port = 9224,
    siteQ,
    waitMs = 6500,
    reloadAttempts = 0,
    clickSelectors = 'a, button, [role="button"], input[type="submit"]',
  } = options;

  if (!siteQ) throw new Error('siteQ is required');

  const session = await openCdpSession({
    port,
    targetPattern: /bing/i,
    enableRuntime: true,
    enablePage: true,
  });

  const evaluatePage = body => session.evalPage(body, { clickSelectors });

  return {
    ...session,
    async nav(sectionPath, extra = '') {
      const url = /^https?:\/\//i.test(sectionPath)
        ? sectionPath
        : `https://www.bing.com/webmasters/${sectionPath}?siteUrl=${siteQ}${extra}`;
      await session.send('Page.navigate', { url, transitionType: 'reload' });
      await sleep(waitMs);

      for (let i = 0; i < reloadAttempts; i += 1) {
        const ok = await session.evaluate(
          `!location.href.startsWith('chrome-error') && (document.body?.innerText || '').length > 100`
        );
        if (ok) break;

        await sleep(2000);
        await session.send('Page.reload', { ignoreCache: true });
        await sleep(6000);
      }

      return url;
    },
    eval: evaluatePage,
    scrape() {
      return evaluatePage(`
        const body = document.body?.innerText || '';
        return {
          title: document.title,
          url: location.href,
          sample: body.slice(0, 900),
          hasError: /error|ошибк|not verified|не проверено/i.test(body),
          hasData: body.length > 200,
        };
      `);
    },
    getStarted() {
      return evaluatePage(`
        const btn = clickMatch('get started|начать|loslegen|view report|просмотреть|enable|включить');
        await sleep(2500);
        return { clicked: btn, sample: (document.body?.innerText || '').slice(0, 500) };
      `);
    },
  };
}
