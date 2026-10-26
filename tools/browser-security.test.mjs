import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { applyApiResponseHeaders } from '../functions/_lib/http-security.js';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

class Element {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this._text = '';
  }
  append(...nodes) {
    this.children.push(...nodes);
  }
  appendChild(node) {
    this.append(node);
    return node;
  }
  insertBefore(node, before) {
    this.children.splice(this.children.indexOf(before), 0, node);
  }
  get textContent() {
    return this._text + this.children.map(node => node.textContent || '').join('');
  }
  set textContent(value) {
    this._text = String(value);
    this.children = [];
  }
  set innerHTML(_value) {
    throw new Error('HTML insertion is forbidden in these text-only renderers');
  }
  querySelector(selector) {
    const all = this.children.flatMap(node => (node instanceof Element ? [node, ...node.descendants()] : []));
    if (selector === '[type="submit"]') return all.find(node => node.type === 'submit') || null;
    const name = /^input\[name="([^"]+)"\]$/.exec(selector)?.[1];
    return all.find(node => node.tag === 'input' && node.name === name) || null;
  }
  descendants() {
    return this.children.flatMap(node => (node instanceof Element ? [node, ...node.descendants()] : []));
  }
}
const documentFixture = () => ({
  documentElement: { lang: 'de' },
  createElement: tag => new Element(tag),
  createTextNode: value => ({ textContent: String(value) }),
});

test('newsletter consent uses text nodes and a supported local privacy link for every language', () => {
  const source = read('assets/js/newsletter.js');
  const body = source.slice(source.indexOf('  const COPY ='), source.indexOf('  const setStatus'));
  for (const lang of ['de', 'en', 'ru', 'uk', '//', '__proto__']) {
    const document = documentFixture();
    const { ensureConsentField } = new Function('document', `${body}\nreturn { ensureConsentField };`)(document);
    const form = new Element('form'),
      language = new Element('input'),
      submit = new Element('button');
    language.name = 'lang';
    language.value = lang;
    submit.type = 'submit';
    form.append(language, submit);
    ensureConsentField(form);
    ensureConsentField(form);
    const checkbox = form.querySelector('input[name="newsletter_consent"]');
    assert.equal(checkbox.required, true);
    assert.equal(form.descendants().filter(node => node.name === 'newsletter_consent').length, 1);
    const link = form.descendants().find(node => node.tag === 'a');
    assert.equal(link.href, `/${['de', 'en', 'ru', 'uk'].includes(lang) ? lang : 'de'}/datenschutz.html`);
    assert.ok(link.textContent.length > 0);
  }
});

test('chat renders hostile markup as text and creates links only to the HTTPS site origin', () => {
  const source = read('assets/js/ai-chat.js');
  const fn = source.slice(source.indexOf('  function appendSafeAnswer('), source.indexOf('\n  let emojiDataPromise'));
  const append = new Function('document', 'SITE_ORIGIN', `${fn}\nreturn appendSafeAnswer;`)(
    documentFixture(),
    'https://hundesalon-nika.com'
  );
  const text =
    '<img src=x onerror=alert(1)> javascript:alert(1) https://hundesalon-nika.com.evil.invalid/ https://hundesalon-nika.com/ru/prays-list?x=%3Cscript%3E';
  const root = new Element('div');
  append(root, text);
  assert.equal(root.descendants().length, 1);
  assert.equal(root.descendants()[0].tag, 'a');
  assert.equal(new URL(root.descendants()[0].href).origin, 'https://hundesalon-nika.com');
  assert.ok(root.textContent.includes('<img src=x onerror=alert(1)>'));
});

test('upload identifiers use Web Crypto even when randomUUID is unavailable', () => {
  const source = read('assets/js/page-modules.js');
  const body = source.match(/const createUploadSessionId = \(\) => \{([\s\S]*?)\n    \};/)[1];
  const create = new Function('window', 'Math', `return () => {${body}}`);
  let entropyCalls = 0;
  const window = {
    crypto: {
      getRandomValues(bytes) {
        entropyCalls++;
        bytes.fill(entropyCalls);
        return bytes;
      },
    },
  };
  const generate = create(window, {
    random() {
      assert.fail('insecure entropy');
    },
  });
  const first = generate(),
    second = generate();
  assert.match(first, /^[0-9a-f]{32}$/);
  assert.notEqual(first, second);
  assert.equal(entropyCalls, 2);
});

test('Bing submission rejects deceptive host prefixes and embedded credentials', () => {
  const source = read('tools/bing-submit-now.mjs');
  const start = source.indexOf('.filter(value => {') + '.filter(value => {'.length;
  const body = source.slice(start, source.indexOf('\n  })', start));
  const allowed = new Function('value', body);
  assert.equal(allowed('https://hundesalon-nika.com/de/'), true);
  for (const value of [
    'https://hundesalon-nika.com.evil.invalid/',
    'https://hundesalon-nika.com@evil.invalid/',
    'https://name@hundesalon-nika.com/',
    'http://hundesalon-nika.com/',
    'https://hundesalon-nika.com:8443/',
    'not a URL',
  ])
    assert.equal(allowed(value), false, value);
});

test('photo metadata decoder performs one entity pass and tolerates invalid code points', () => {
  const source = read('tools/update-animal-breed-photos.mjs');
  const expression = source.match(/const decodeHtml = ([\s\S]*?);\n\nconst isSupportedFreeLicense/)[1];
  const decode = new Function(`return (${expression});`)();
  assert.equal(decode('<b>Author</b> &amp; contributor'), 'Author & contributor');
  assert.equal(decode('&amp;quot;Name&amp;quot;'), '&quot;Name&quot;');
  assert.equal(decode('&#39;Name&#39;'), "'Name'");
  assert.equal(decode('&#1114112;'), '&#1114112;');
});

test('API frame protection overwrites an attacker-controlled incoming header', () => {
  const response = applyApiResponseHeaders(
    new Response('{}', { headers: { 'X-Frame-Options': 'ALLOW-FROM https://evil.invalid' } })
  );
  assert.equal(response.headers.get('X-Frame-Options'), 'SAMEORIGIN');
});

test('local refresh stays disabled on production and localhost lookalikes', () => {
  const source = read('assets/js/local-dev-refresh.js');
  for (const hostname of ['hundesalon-nika.com', 'localhost.evil.invalid', 'evil-localhost']) {
    const window = {};
    runInNewContext(source, {
      location: { hostname },
      window,
      fetch() {
        assert.fail('production attempted a local request');
      },
    });
    assert.equal(window.__nikaDevRefresh, undefined);
  }
});

test('local resource watcher reflects CORS only for exact loopback hostnames', () => {
  const source = read('tools/dev-resource-watch.mjs');
  const start =
    source.indexOf('const server = createServer((request, response) => {') +
    'const server = createServer((request, response) => {'.length;
  const body = source.slice(start, source.indexOf('\n  });\n  server.on', start));
  const handle = new Function('request', 'response', 'project', 'boot', 'changes', body);
  for (const origin of [
    'http://127.0.0.1:5502',
    'http://localhost:8788',
    'http://[::1]:5502',
    'https://localhost.evil.invalid',
    'http://127.0.0.1@evil.invalid',
    'null',
  ]) {
    const response = {
      status: 0,
      headers: {},
      writeHead(status) {
        this.status = status;
        return this;
      },
      end() {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
    };
    handle({ headers: { origin }, method: 'GET', url: '/changes' }, response, 'HUNDESALON_NIKA', 'fixture', new Map());
    const allowed = ['http://127.0.0.1:5502', 'http://localhost:8788', 'http://[::1]:5502'].includes(origin);
    assert.equal(response.status, allowed ? 200 : 403);
    assert.equal(response.headers['Access-Control-Allow-Origin'], allowed ? origin : undefined);
  }
});
