const port = Number(process.env.GSC_EDGE_PORT || process.argv.find(arg => arg.startsWith('--port='))?.split('=')[1] || 9224);
const property = 'sc-domain:hundesalon-nika.com';
const sitemapPath = 'sitemap.xml';
const sitemapsUrl = `https://search.google.com/search-console/sitemaps?resource_id=${encodeURIComponent(property)}`;

let nextId = 1;
const pending = new Map();

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function getTarget() {
  const targets = await getJson(`http://127.0.0.1:${port}/json/list`);
  const pages = targets.filter(target => target.type === 'page');
  return (
    pages.find(target => target.url.includes('search.google.com/search-console')) ||
    pages.find(target => target.url.includes('accounts.google.com')) ||
    pages[0]
  );
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
      const send = (method, params = {}) => new Promise((resolveCommand, rejectCommand) => {
        const id = nextId++;
        pending.set(id, { resolve: resolveCommand, reject: rejectCommand });
        ws.send(JSON.stringify({ id, method, params }));
      });
      resolve({ ws, send });
    });
    ws.addEventListener('error', reject);
  });
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function evaluate(send, expression, awaitPromise = true) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
  });

  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime.evaluate failed');
  return result.result.value;
}

async function pageSummary(send) {
  return evaluate(send, `(() => ({
    url: location.href,
    title: document.title,
    text: document.body ? document.body.innerText.slice(0, 3000) : '',
    inputs: Array.from(document.querySelectorAll('input, textarea')).map((el, index) => ({
      index,
      type: el.type || el.tagName.toLowerCase(),
      aria: el.getAttribute('aria-label') || '',
      placeholder: el.getAttribute('placeholder') || '',
      value: el.value || '',
      visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
      disabled: !!el.disabled
    })),
    buttons: Array.from(document.querySelectorAll('button, [role="button"]')).map((el, index) => ({
      index,
      text: (el.innerText || el.getAttribute('aria-label') || '').trim(),
      visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
      disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true'
    })).slice(0, 80)
  }))()`);
}

async function submitSitemap(send) {
  return evaluate(send, `(async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const visible = el => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    const setNativeValue = (el, value) => {
      const proto = Object.getPrototypeOf(el);
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
      if (descriptor?.set) descriptor.set.call(el, value);
      else el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const inputs = Array.from(document.querySelectorAll('input, textarea'))
      .filter(el => visible(el) && !el.disabled && el.type !== 'hidden');
    const sitemapInput =
      inputs.find(el => /sitemap|карта сайта|файл sitemap/i.test([el.placeholder, el.getAttribute('aria-label'), el.name, el.id].join(' '))) ||
      inputs.find(el => !el.value || /sitemap/i.test(el.value)) ||
      inputs[0];

    if (!sitemapInput) return { ok: false, reason: 'NO_VISIBLE_INPUT', url: location.href, title: document.title };

    sitemapInput.focus();
    setNativeValue(sitemapInput, '${sitemapPath}');
    await sleep(700);

    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'))
      .filter(el => visible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true');
    const submitButton =
      buttons.find(el => /^(submit|send|отправить|надіслати)$/i.test((el.innerText || el.getAttribute('aria-label') || '').trim())) ||
      buttons.find(el => /(submit|send|отправить|надіслати)/i.test(el.innerText || el.getAttribute('aria-label') || ''));

    if (!submitButton) {
      return {
        ok: false,
        reason: 'NO_SUBMIT_BUTTON',
        value: sitemapInput.value,
        buttons: buttons.map(el => (el.innerText || el.getAttribute('aria-label') || '').trim()).slice(0, 30),
        url: location.href,
        title: document.title
      };
    }

    submitButton.click();
    await sleep(3500);

    return {
      ok: true,
      value: sitemapInput.value,
      clicked: (submitButton.innerText || submitButton.getAttribute('aria-label') || '').trim(),
      url: location.href,
      title: document.title,
      text: document.body ? document.body.innerText.slice(0, 3000) : ''
    };
  })()`);
}

const target = await getTarget();
if (!target?.webSocketDebuggerUrl) {
  console.error(`No debuggable Edge page found on port ${port}.`);
  process.exit(1);
}

const { ws, send } = await connect(target.webSocketDebuggerUrl);

try {
  await send('Runtime.enable');
  await send('Page.enable');

  await send('Page.navigate', { url: sitemapsUrl });
  await wait(6000);

  const summary = await pageSummary(send);
  if (summary.url.includes('accounts.google.com')) {
    console.log(JSON.stringify({
      status: 'LOGIN_REQUIRED',
      message: 'Google asks for sign-in in the controlled Edge window. Sign in there, then run npm run google:gsc:browser again.',
      url: summary.url,
      title: summary.title,
      inputs: summary.inputs,
    }, null, 2));
    process.exit(2);
  }

  const result = await submitSitemap(send);
  console.log(JSON.stringify({ status: result.ok ? 'SUBMIT_ATTEMPTED' : 'NEEDS_MANUAL_REVIEW', result }, null, 2));
} finally {
  ws.close();
}
