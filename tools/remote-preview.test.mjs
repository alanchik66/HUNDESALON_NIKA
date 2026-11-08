import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { Script, runInNewContext } from 'node:vm';
import { createRemoteGateway } from './dev-remote-preview.mjs';
import { PREVIEW_MOTION_SCRIPT, sanitizeMotionDiagnostic, createMotionDiagnosticRecorder } from './lib/preview-motion-diagnostics.mjs';

test('phone preview requires the secret link and exposes only public read-only files', async () => {
  const key = 'a'.repeat(43);
  const root = fileURLToPath(new URL('../', import.meta.url));
  const gateway = await createRemoteGateway({ root, key });
  const request = (url, options) => fetch(`${gateway.baseUrl}${url}`, { redirect: 'manual', ...options });
  const headers = { Cookie: `__Host-nika-preview=${key}` };
  try {
    assert.equal((await request('/ru/prays-list.html')).status, 403);
    assert.equal((await request('/__preview_login?key=incorrect')).status, 403);
    const login = await request(`/__preview_login?key=${key}`);
    assert.equal(login.status, 200);
    assert.match(login.headers.get('content-type'), /^text\/html; charset=utf-8$/);
    assert.equal(login.headers.get('content-disposition'), 'inline');
    assert.match(await login.text(), /content="0;url=\/ru\/prays-list\.html"/);
    assert.match(login.headers.get('set-cookie'), /Secure; HttpOnly; SameSite=Lax/);
    assert.equal(login.headers.get('referrer-policy'), 'no-referrer');
    const homeLogin = await request(`/__preview_login.html?key=${key}&next=/ru/`);
    assert.equal(homeLogin.status, 200);
    const homeLoginHtml = await homeLogin.text();
    assert.match(homeLoginHtml, /^<!doctype html>/);
    assert.match(homeLoginHtml, /content="0;url=\/ru\/"/);
    assert.match(homeLoginHtml, /href="\/ru\/"/);
    assert.equal(Number(homeLogin.headers.get('content-length')), Buffer.byteLength(homeLoginHtml));
    const headLogin = await request(`/__preview_login.html?key=${key}&next=/ru/`, { method: 'HEAD' });
    assert.equal(headLogin.status, 200, 'Safari link checks must receive the same document metadata without a cookie');
    for (const name of ['content-type', 'content-disposition', 'content-length', 'set-cookie']) {
      assert.equal(headLogin.headers.get(name), homeLogin.headers.get(name), name);
    }
    assert.equal(await headLogin.text(), '');
    assert.equal((await request('/__preview_login.html?key=incorrect', { method: 'HEAD' })).status, 403);
    const openedHome = await request('/ru/', { headers: { Cookie: homeLogin.headers.get('set-cookie').split(';')[0] } });
    assert.equal(openedHome.status, 200);
    assert.match(openedHome.headers.get('content-type'), /^text\/html/);
    for (const destination of ['https://external.example/', '//external.example/', '/ru/%ZZ']) {
      const redirected = await request(`/__preview_login?key=${key}&next=${encodeURIComponent(destination)}`);
      assert.equal(redirected.status, 200);
      const html = await redirected.text();
      assert.match(html, /content="0;url=\/ru\/prays-list\.html"/);
      assert.doesNotMatch(html, /external\.example|%ZZ/);
    }
    const page = await request('/ru/prays-list.html', { headers });
    assert.equal(page.status, 200);
    assert.match(page.headers.get('x-robots-tag'), /noindex/);
    assert.match(page.headers.get('cache-control'), /no-store/);
    assert.match(await page.text(), /data-price-booking-flow/);
    for (const url of [
      '/package.json',
      '/.git/config',
      '/.dev.vars',
      '/tools/dev-remote-preview.mjs',
      '/output/local-preview/remote-config.json',
      '/functions/sendmail.js',
      '/knowledge/MEMORY.md',
      '/assets/.dev.vars',
      '/sw.js',
      '/sp-push-worker-fb.js',
    ]) {
      const forbidden = await request(url, { headers });
      assert.equal(forbidden.status, 403, url);
      assert.match(forbidden.headers.get('content-type'), /^text\/plain; charset=utf-8$/, url);
    }
    const asset = await request('/assets/js/price-page.js', { method: 'HEAD', headers });
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /javascript/);
    assert.equal((await request('/sendmail', { method: 'POST', headers, body: 'test' })).status, 405);
    assert.equal((await request('/__preview_stop', { method: 'POST' })).status, 403);
  } finally {
    await gateway.close();
  }
});

test('public read-only phone preview keeps internal files and submissions closed', async () => {
  const gateway = await createRemoteGateway({
    root: fileURLToPath(new URL('../', import.meta.url)),
    key: 'b'.repeat(43),
    publicReadOnly: true,
  });
  try {
    const request = (url, options) => fetch(`${gateway.baseUrl}${url}`, options);
    assert.equal((await request('/ru/prays-list.html')).status, 200);
    for (const url of [
      '/output/local-preview/remote-config.json',
      '/.git/config',
      '/.dev.vars',
      '/tools/start-remote-preview.mjs',
      '/functions/sendmail.js',
      '/sw.js',
    ])
      assert.equal((await request(url)).status, 403, url);
    assert.equal((await request('/sendmail', { method: 'POST', body: 'test' })).status, 405);
    assert.equal((await request('/__preview_stop', { method: 'POST' })).status, 405);
    assert.match((await request('/robots.txt')).headers.get('x-robots-tag'), /noindex/);
  } finally {
    await gateway.close();
  }
});

test('authenticated phone preview serves current weather modules without exposing build files', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'nika-remote-weather-'));
  const weather = path.join(root, '3d-weather-codrops-main');
  const runtime = path.join(weather, 'dist-widget');
  const candidate = path.join(root, 'output', 'weather-local');
  await mkdir(runtime, { recursive: true });
  await mkdir(candidate, { recursive: true });
  await writeFile(path.join(weather, 'build-manifest.json'), JSON.stringify({
    entries: [{ output: 'widget.mjs' }], vendorInputs: [{ file: 'patched-vendor.mjs' }],
  }));
  await writeFile(path.join(runtime, 'widget.mjs'), 'baseline weather');
  await writeFile(path.join(runtime, 'vendor.mjs'), 'unchanged vendor');
  await writeFile(path.join(runtime, 'patched-vendor.mjs'), 'baseline vendor');
  await writeFile(path.join(candidate, 'widget.mjs'), 'current four-day weather');
  await writeFile(path.join(candidate, 'widget.mjs.map'), '{}');
  await writeFile(path.join(candidate, 'patched-vendor.mjs'), 'generated recovery correction');
  const key = 'c'.repeat(43);
  const gateway = await createRemoteGateway({ root, key, weatherModuleDirectory: candidate });
  const request = (url, options) => fetch(`${gateway.baseUrl}${url}`, { redirect: 'manual', ...options });
  const headers = { Cookie: `__Host-nika-preview=${key}` };
  try {
    const moduleUrl = '/3d-weather-codrops-main/dist-widget/widget.mjs?v=current';
    assert.equal((await request(moduleUrl)).status, 403, 'overlay must require the existing authentication');
    const response = await request(moduleUrl, { headers });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'current four-day weather');
    assert.match(response.headers.get('content-type'), /javascript/);
    assert.equal(await (await request('/3d-weather-codrops-main/dist-widget/widget.mjs.map', { headers })).text(), '{}');
    assert.equal(await (await request('/3d-weather-codrops-main/dist-widget/vendor.mjs', { headers })).text(), 'unchanged vendor');
    const vendorUrl = '/3d-weather-codrops-main/dist-widget/patched-vendor.mjs';
    assert.equal((await request(vendorUrl)).status, 403, 'generated vendor still requires authentication');
    assert.equal(await (await request(vendorUrl, { headers })).text(), 'generated recovery correction');
    for (const url of ['/output/weather-local/widget.mjs', '/3d-weather-codrops-main/build-manifest.json', '/.git/config']) {
      assert.equal((await request(url, { headers })).status, 403, url);
    }
    assert.equal((await request(moduleUrl, { method: 'POST', headers })).status, 405);
  } finally {
    await gateway.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('phone preview proxies full local Pages GET, HEAD and media ranges without owning the upstream', async () => {
  const calls = [];
  const media = Buffer.from('0123456789');
  const modified = 'Tue, 03 Nov 2026 08:00:00 GMT';
  const upstream = createServer((request, response) => {
    calls.push({ path: request.url, method: request.method, headers: request.headers });
    if (request.url === '/ru/?probe=current' || request.url === '/assets/site.js') {
      const page = request.url.startsWith('/ru/');
      const body = page ? '<!doctype html><html><head data-preview="full"><script src="https://external.example/analytics.js"></script><script src="/assets/site.js"></script></head><body>Actual homepage</body></html>' : 'window.currentPreview = true;';
      response.writeHead(200, {
        'Content-Type': page ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
      }).end(request.method === 'HEAD' ? undefined : body);
      return;
    }
    if (request.url === '/api/redirect') {
      response.writeHead(302, { Location: 'https://external.example/' }).end();
      return;
    }
    if (request.url === '/ru/redirect.html') {
      response.writeHead(302, { Location: '/ru/' }).end();
      return;
    }
    if (request.url.startsWith('/api/weather') || request.url.startsWith('/reverse-geocode')) {
      response.writeHead(200, { 'Content-Type': 'application/json' }).end('{"forecastDays":4}');
      return;
    }
    const partial = request.headers.range === 'bytes=3-6';
    const body = partial ? media.subarray(3, 7) : media;
    response.writeHead(partial ? 206 : 200, {
      'Content-Type': 'video/mp4',
      'Content-Length': body.length,
      'Accept-Ranges': 'bytes',
      'Last-Modified': modified,
      ...(partial ? { 'Content-Range': 'bytes 3-6/10' } : {}),
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  });
  await new Promise((resolve, reject) => {
    upstream.once('error', reject);
    upstream.listen(0, '127.0.0.1', resolve);
  });
  const websiteOrigin = `http://127.0.0.1:${upstream.address().port}`;
  const key = 'd'.repeat(43);
  const gateway = await createRemoteGateway({
    root: fileURLToPath(new URL('../', import.meta.url)), key, websiteOrigin,
  });
  let gatewayClosed = false;
  const request = (url, options = {}) => fetch(`${gateway.baseUrl}${url}`, {
    redirect: 'manual', ...options, headers: { Cookie: `__Host-nika-preview=${key}`, ...options.headers },
  });
  try {
    const unauthorized = await fetch(`${gateway.baseUrl}/assets/video.mp4`);
    assert.equal(unauthorized.status, 403);
    assert.equal(calls.length, 0);
    for (const url of ['/ru/', '/ru/?__preview_key=incorrect', `/en/?__preview_key=${key}`, `/assets/site.js?__preview_key=${key}`]) {
      assert.equal((await fetch(`${gateway.baseUrl}${url}`)).status, 403, url);
    }
    assert.equal(calls.length, 0, 'only the exact Russian home route may accept the direct access key');
    for (const method of ['GET', 'HEAD']) {
      const home = await fetch(`${gateway.baseUrl}/ru/?__preview_key=${key}&probe=current`, { method });
      assert.equal(home.status, 200);
      assert.equal(home.headers.get('content-type'), 'text/html; charset=utf-8');
      assert.match(home.headers.get('set-cookie'), /__Host-nika-preview=d+; Path=\/; Secure; HttpOnly; SameSite=Lax/);
      assert.equal(home.headers.get('referrer-policy'), 'no-referrer');
      const html = await home.text();
      if (method === 'HEAD') {
        assert.equal(html, '');
        assert.equal(home.headers.get('content-length'), null);
      } else {
        assert.match(html, /^<!doctype html><html><head data-preview="full"><script>try\{/);
        assert.match(html, /searchParams\.delete\('__preview_key'\)/);
        assert.match(html, /history\.replaceState\(history\.state,''/);
        assert.ok(html.indexOf('history.replaceState') < html.indexOf('src="https://external.example/analytics.js"'));
        assert.match(html, /<body>Actual homepage<\/body>/);
        assert.equal(Number(home.headers.get('content-length')), Buffer.byteLength(html));
        assert.equal(html.includes(key), false, 'the access credential value must never enter the page body');
      }
      assert.equal(calls.at(-1).path, '/ru/?probe=current', 'the private key must not reach Pages request logs');
      const script = await fetch(`${gateway.baseUrl}/assets/site.js`, {
        headers: { Cookie: home.headers.get('set-cookie').split(';')[0] },
      });
      assert.equal(script.status, 200);
      assert.match(script.headers.get('content-type'), /javascript/);
      assert.equal(await script.text(), 'window.currentPreview = true;');
    }
    const full = await request('/assets/video.mp4');
    assert.equal(full.status, 200);
    assert.equal(full.headers.get('content-type'), 'video/mp4');
    assert.equal(full.headers.get('content-length'), '10');
    assert.equal(await full.text(), '0123456789');
    for (const method of ['GET', 'HEAD']) {
      const partial = await request('/assets/video.mp4', { method, headers: { Range: 'bytes=3-6', 'If-Range': modified } });
      assert.equal(partial.status, 206);
      assert.equal(partial.headers.get('content-range'), 'bytes 3-6/10');
      assert.equal(partial.headers.get('accept-ranges'), 'bytes');
      assert.equal(partial.headers.get('content-length'), '4');
      assert.equal(partial.headers.get('last-modified'), modified);
      assert.equal(await partial.text(), method === 'HEAD' ? '' : '3456');
      const last = calls.at(-1);
      assert.equal(last.method, method);
      assert.equal(last.headers.range, 'bytes=3-6');
      assert.equal(last.headers['if-range'], modified);
      assert.ok(last.headers['accept-encoding'].split(',').every(value => value.trim() === 'identity'));
    }
    const head = await request('/assets/video.mp4', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-length'), '10');
    assert.equal(await head.text(), '');
    for (const endpoint of ['/api/weather?location=Leipzig', '/reverse-geocode?latitude=51']) {
      assert.deepEqual(await (await request(endpoint)).json(), { forecastDays: 4 });
    }
    assert.equal((await request('/api/internal/status')).status, 200, 'authenticated preview retains the full local API');
    const beforePrivate = calls.length;
    for (const url of ['/package.json', '/output/weather-local/widget.mjs', '/.git/config', '/functions/sendmail.js']) {
      assert.equal((await request(url)).status, 403, url);
    }
    assert.equal((await request('/api/weather', { method: 'POST', body: 'test' })).status, 405);
    assert.equal(calls.length, beforePrivate, 'private files and submissions must never reach the Pages upstream');
    const redirect = await request('/ru/redirect.html');
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.get('location'), '/ru/');
    assert.equal((await request('/api/redirect')).status, 502, 'the proxy must not follow redirects outside the loopback origin');
    await gateway.close();
    gatewayClosed = true;
    assert.equal((await fetch(`${websiteOrigin}/api/weather`)).status, 200, 'closing the preview must preserve the independently managed Pages server');
  } finally {
    if (!gatewayClosed) await gateway.close();
    upstream.closeAllConnections();
    await new Promise(resolve => upstream.close(resolve));
  }
});

test('phone preview rejects public, credentialed and non-origin upstream URLs', async () => {
  for (const websiteOrigin of [
    'http://external.example', 'https://127.0.0.1:8788', 'ftp://localhost:8788',
    'http://user:password@127.0.0.1:8788', 'http://127.0.0.1:8788/private',
    'http://localhost:8788/?target=external', 'http://[::1]:8788/#fragment',
  ]) {
    await assert.rejects(createRemoteGateway({ key: 'e'.repeat(43), websiteOrigin }), /loopback HTTP origin/);
  }
});

test('full Pages preview serves video ranges from actual dist files while keeping HTML, JS and APIs on Pages', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'nika-pages-media-'));
  const mediaRoot = path.join(root, 'dist');
  await mkdir(path.join(mediaRoot, 'assets'), { recursive: true });
  await writeFile(path.join(mediaRoot, 'assets', 'clip.mp4'), '0123456789abcdefghij');
  await writeFile(path.join(mediaRoot, 'assets', 'clip.webm'), 'WEBM');
  await writeFile(path.join(mediaRoot, 'assets', 'site.js'), 'must not serve the media helper copy');
  const calls = [];
  const pages = createServer((request, response) => {
    calls.push(request.url);
    const contentType = request.url.startsWith('/api/') ? 'application/json'
      : request.url.endsWith('.js') ? 'text/javascript' : 'text/html';
    const body = contentType === 'application/json' ? '{"forecastDays":4}'
      : contentType === 'text/javascript' ? 'window.fullPages = true;' : '<!doctype html><title>Full Pages</title>';
    response.writeHead(200, { 'Content-Type': contentType }).end(body);
  });
  await new Promise((resolve, reject) => {
    pages.once('error', reject);
    pages.listen(0, '127.0.0.1', resolve);
  });
  const websiteOrigin = `http://127.0.0.1:${pages.address().port}`;
  const key = 'f'.repeat(43);
  const gateway = await createRemoteGateway({ root, key, websiteOrigin, mediaRoot });
  let gatewayClosed = false;
  const request = (route, options = {}) => fetch(`${gateway.baseUrl}${route}`, {
    ...options, headers: { Cookie: `__Host-nika-preview=${key}`, ...options.headers },
  });
  try {
    assert.equal((await fetch(`${gateway.baseUrl}/assets/clip.mp4`, { headers: { Range: 'bytes=0-3' } })).status, 403);
    for (const method of ['GET', 'HEAD']) {
      const partial = await request('/assets/clip.mp4', { method, headers: { Range: 'bytes=0-3' } });
      assert.equal(partial.status, 206);
      assert.equal(partial.headers.get('content-type'), 'video/mp4');
      assert.equal(partial.headers.get('content-range'), 'bytes 0-3/20');
      assert.equal(partial.headers.get('accept-ranges'), 'bytes');
      assert.equal(partial.headers.get('content-length'), '4');
      assert.equal(await partial.text(), method === 'HEAD' ? '' : '0123');
    }
    const webm = await request('/assets/clip.webm', { headers: { Range: 'bytes=1-2' } });
    assert.equal(webm.status, 206);
    assert.equal(webm.headers.get('content-type'), 'video/webm');
    assert.equal(webm.headers.get('content-range'), 'bytes 1-2/4');
    assert.equal(await webm.text(), 'EB');
    const unavailable = await request('/assets/clip.mp4', { headers: { Range: 'bytes=20-' } });
    assert.equal(unavailable.status, 416);
    assert.equal(unavailable.headers.get('content-range'), 'bytes */20');
    assert.equal(await unavailable.text(), '');
    assert.deepEqual(calls, [], 'video requests must use the actual file server, not Wrangler range handling');
    assert.equal(await (await request('/ru/')).text(), '<!doctype html><title>Full Pages</title>');
    assert.equal(await (await request('/assets/site.js')).text(), 'window.fullPages = true;');
    assert.deepEqual(await (await request('/api/weather')).json(), { forecastDays: 4 });
    assert.deepEqual(calls, ['/ru/', '/assets/site.js', '/api/weather']);
    await gateway.close();
    gatewayClosed = true;
    assert.equal((await fetch(`${websiteOrigin}/api/weather`)).status, 200);
  } finally {
    if (!gatewayClosed) await gateway.close();
    pages.closeAllConnections();
    await new Promise(resolve => pages.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});

test('public full preview exposes only weather and maps configuration APIs and public files without cookies', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'nika-public-pages-'));
  const mediaRoot = path.join(root, 'dist');
  await mkdir(path.join(mediaRoot, 'assets'), { recursive: true });
  await writeFile(path.join(mediaRoot, 'assets', 'clip.mp4'), '0123456789abcdefghij');
  const calls = [];
  const pages = createServer((request, response) => {
    calls.push({ path: request.url, method: request.method });
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const type = pathname === '/ru/' ? 'text/html' : pathname.endsWith('.js') ? 'text/javascript' : 'application/json';
    const body = type === 'text/html' ? '<!doctype html><script src="/assets/site.js"></script>'
      : type === 'text/javascript' ? 'window.publicPreview = true;'
        : pathname === '/api/maps-config' ? '{"enabled":true,"apiKey":"test-public-maps-key"}' : '{"weather":true}';
    response.writeHead(200, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body) }).end(body);
  });
  await new Promise((resolve, reject) => {
    pages.once('error', reject);
    pages.listen(0, '127.0.0.1', resolve);
  });
  const websiteOrigin = `http://127.0.0.1:${pages.address().port}`;
  const gateway = await createRemoteGateway({ root, key: 'g'.repeat(43), websiteOrigin, mediaRoot, publicReadOnly: true });
  const request = (route, options) => fetch(`${gateway.baseUrl}${route}`, options);
  try {
    assert.match(await (await request('/ru/')).text(), /^<!doctype html>/);
    assert.equal(await (await request('/assets/site.js')).text(), 'window.publicPreview = true;');
    const video = await request('/assets/clip.mp4', { headers: { Range: 'bytes=0-3' } });
    assert.equal(video.status, 206);
    assert.equal(video.headers.get('content-range'), 'bytes 0-3/20');
    assert.equal(await video.text(), '0123');
    for (const route of ['/api/weather?location=Leipzig', '/reverse-geocode?latitude=51']) {
      assert.deepEqual(await (await request(route)).json(), { weather: true });
      const head = await request(route, { method: 'HEAD' });
      assert.equal(head.status, 200);
      assert.equal(await head.text(), '');
    }
    assert.deepEqual(await (await request('/api/maps-config')).json(), {
      enabled: true, apiKey: 'test-public-maps-key',
    });
    const mapsHead = await request('/api/maps-config', { method: 'HEAD' });
    assert.equal(mapsHead.status, 200);
    assert.equal(await mapsHead.text(), '');
    const allowedCalls = calls.length;
    for (const route of [
      '/api/', '/api/internal/status', '/api/booking/status', '/api/weather/current', '/api/weather/', '/api/%77eather',
      '/reverse-geocode/private', '/.dev.vars', '/.git/config', '/output/local-preview/remote-config.json',
      '/api/maps-config/private', '/api/maps-config/', '/api/%6daps-config',
    ]) {
      assert.equal((await request(route)).status, 403, route);
      assert.equal((await request(route, { method: 'HEAD' })).status, 403, `HEAD ${route}`);
    }
    for (const route of ['/ru/', '/assets/site.js', '/assets/clip.mp4', '/api/weather', '/reverse-geocode', '/api/maps-config', '/api/internal/status']) {
      assert.equal((await request(route, { method: 'POST', body: 'test' })).status, 405, route);
    }
    assert.equal(calls.length, allowedCalls, 'private APIs, private files and every POST must be blocked before contacting Pages');
  } finally {
    await gateway.close();
    pages.closeAllConnections();
    await new Promise(resolve => pages.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});

function motionReport(sequence = 1) {
  const style = {
    animationName: 'social-icon-rollout', animationDuration: '1.8s', animationDelay: '0s',
    transform: 'matrix(1, 0, 0, 1, 12, 0)', opacity: '1',
  };
  return {
    event: 'click', target: 'social', sequence, offsetMs: 250, width: 390, height: 844,
    mobile: true, rangeMobile: true, reducedMotion: false, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)',
    list: { open: true, hidden: false, first: style, last: style, firstIcon: style, lastIcon: style },
  };
}

test('preview motion script only observes genuine clicks and emits bounded same-origin snapshots', () => {
  assert.doesNotThrow(() => new Script(PREVIEW_MOTION_SCRIPT));
  assert.doesNotMatch(PREVIEW_MOTION_SCRIPT, /\.click\s*\(|dispatchEvent|localStorage|sessionStorage|document\.cookie/);
  const timers = [];
  const requests = [];
  const listeners = new Map();
  class Element {}
  const button = new Element();
  button.closest = () => button;
  button.classList = { contains: name => name === 'social-icons-toggle' };
  const icon = {};
  const link = { querySelector: () => icon, getBoundingClientRect: () => ({ x: 12, y: 160, width: 24, height: 44 }) };
  const list = { hidden: false, classList: { contains: () => true }, querySelectorAll: () => [link, link],
    getBoundingClientRect: () => ({ x: 12, y: 160, width: 351, height: 44 }) };
  list.closest = () => list;
  runInNewContext(PREVIEW_MOTION_SCRIPT, {
    document: {
      readyState: 'loading', querySelector: () => list,
      addEventListener: (name, callback, options) => listeners.set(name, { callback, options }),
    },
    innerWidth: 390, innerHeight: 844, Element,
    navigator: { userAgent: motionReport().ua },
    getComputedStyle: () => motionReport().list.first,
    matchMedia: query => ({ matches: query !== '(prefers-reduced-motion: reduce)' }),
    setTimeout: (callback, offset) => timers.push({ callback, offset }),
    fetch: (url, options) => { requests.push({ url, options }); return Promise.resolve(); },
  });
  assert.equal(timers.length, 0);
  listeners.get('DOMContentLoaded').callback();
  const shortOffsets = [0, 250, 1000, 3000];
  const longOffsets = [0, 250, 1000, 3000, 7000, 14000, 30000];
  const loadOffsets = [...shortOffsets, ...shortOffsets, ...shortOffsets, ...longOffsets, ...longOffsets];
  assert.deepEqual(timers.map(timer => timer.offset), loadOffsets);
  timers[loadOffsets.length - longOffsets.length].callback();
  const languageLoad = sanitizeMotionDiagnostic(new URL(requests[0].url, 'http://localhost').searchParams.get('data'));
  assert.equal(languageLoad.event, 'load');
  assert.equal(languageLoad.target, 'language');
  assert.equal(languageLoad.offsetMs, 0);
  assert.equal(languageLoad.sequence, 5);
  requests.length = 0;
  assert.equal(listeners.get('click').options.passive, true);
  assert.equal(listeners.get('click').options.capture, true);
  listeners.get('click').callback({ isTrusted: false, target: button });
  assert.equal(timers.length, loadOffsets.length);
  listeners.get('click').callback({ isTrusted: true, target: button });
  assert.equal(timers.length, loadOffsets.length + shortOffsets.length);
  timers.at(-3).callback();
  assert.equal(requests.length, 1);
  const request = requests[0];
  assert.ok(request.url.startsWith('/__preview_motion?data='));
  assert.equal(request.options.method, 'GET');
  assert.equal(request.options.credentials, 'same-origin');
  const report = sanitizeMotionDiagnostic(new URL(request.url, 'http://localhost').searchParams.get('data'));
  assert.equal(report.event, 'click');
  assert.equal(report.target, 'social');
  assert.equal(report.offsetMs, 250);
  assert.equal(report.list.first.animationDuration, '1.8s');
  listeners.get('scroll').callback({ isTrusted: false });
  assert.equal(timers.length, loadOffsets.length + shortOffsets.length);
  listeners.get('scroll').callback({ isTrusted: true });
  assert.equal(timers.length, loadOffsets.length + shortOffsets.length * 2);
  listeners.get('scroll').callback({ isTrusted: true });
  assert.equal(timers.length, loadOffsets.length + shortOffsets.length * 2, 'scroll snapshots are throttled without operating the page');
  assert.equal(listeners.get('scroll').options.passive, true);
  timers.at(-3).callback();
  const scrollReport = sanitizeMotionDiagnostic(new URL(requests.at(-1).url, 'http://localhost').searchParams.get('data'));
  assert.equal(scrollReport.target, 'arrows');
  assert.equal(scrollReport.event, 'scroll');
  assert.equal(scrollReport.list.firstIcon.rotate, 'none');
  const languageButton = new Element();
  languageButton.closest = () => languageButton;
  languageButton.classList = { contains: name => name === 'lang-dropdown-btn' };
  const beforeLanguage = timers.length;
  listeners.get('click').callback({ isTrusted: false, target: languageButton });
  assert.equal(timers.length, beforeLanguage);
  listeners.get('click').callback({ isTrusted: true, target: languageButton });
  assert.deepEqual(timers.slice(beforeLanguage).map(timer => timer.offset), longOffsets);
  timers.at(-2).callback();
  const languageClick = sanitizeMotionDiagnostic(new URL(requests.at(-1).url, 'http://localhost').searchParams.get('data'));
  assert.equal(languageClick.event, 'click');
  assert.equal(languageClick.target, 'language');
  assert.equal(languageClick.offsetMs, 14000);
});

test('motion telemetry is opt-in, write-only and rejects private or oversized fields', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'nika-motion-preview-'));
  await mkdir(path.join(root, 'ru'));
  await writeFile(path.join(root, 'ru', 'index.html'), '<!doctype html><html><head><script src="https://external.example/site.js"></script></head><body>Current site</body></html>');
  const key = 'h'.repeat(43);
  const received = [];
  const disabled = await createRemoteGateway({ root, key, publicReadOnly: true });
  const enabled = await createRemoteGateway({ root, key, publicReadOnly: true, onMotionDiagnostic: report => received.push(report) });
  const beacon = data => `${enabled.baseUrl}/__preview_motion?data=${encodeURIComponent(data)}`;
  try {
    const untouched = await (await fetch(`${disabled.baseUrl}/ru/`)).text();
    assert.equal(untouched.includes('__preview_motion'), false);
    assert.equal((await fetch(`${disabled.baseUrl}/__preview_motion?data=${encodeURIComponent(JSON.stringify(motionReport()))}`)).status, 403);
    const page = await fetch(`${enabled.baseUrl}/ru/?__preview_key=${key}`);
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.equal(Number(page.headers.get('content-length')), Buffer.byteLength(html));
    assert.ok(html.indexOf('history.replaceState') < html.indexOf(PREVIEW_MOTION_SCRIPT));
    assert.ok(html.indexOf(PREVIEW_MOTION_SCRIPT) < html.indexOf('src="https://external.example/site.js"'));
    assert.equal(html.includes(key), false);
    const head = await fetch(`${enabled.baseUrl}/ru/`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-length'), null);
    assert.equal(await head.text(), '');
    const response = await fetch(beacon(JSON.stringify(motionReport())));
    assert.equal(response.status, 204);
    assert.equal(await response.text(), '');
    assert.deepEqual(received, [motionReport()]);
    for (const data of [
      '', 'invalid', 'x'.repeat(6145), JSON.stringify({ ...motionReport(), cookies: 'must not log' }),
      JSON.stringify({ ...motionReport(), width: 10001 }), JSON.stringify({ ...motionReport(), ua: 'x'.repeat(161) }),
      JSON.stringify({ ...motionReport(), list: { ...motionReport().list, first: { ...motionReport().list.first, key: 'must not log' } } }),
    ]) {
      assert.equal((await fetch(beacon(data))).status, 400);
    }
    assert.equal((await fetch(`${enabled.baseUrl}/__preview_motion`)).status, 400, 'the endpoint cannot read reports');
    assert.equal((await fetch(beacon(JSON.stringify(motionReport())), { method: 'POST', body: 'test' })).status, 405);
    assert.equal((await fetch(`${enabled.baseUrl}/output/local-preview/mobile-motion-diagnostics.json`)).status, 403);
    assert.equal(received.length, 1);
  } finally {
    await enabled.close();
    await disabled.close();
    await rm(root, { recursive: true, force: true });
  }
});

test('motion recorder retains only the last ten validated feature reports', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'nika-motion-records-'));
  const filename = path.join(root, 'reports.json');
  const record = createMotionDiagnosticRecorder(filename);
  try {
    await Promise.all(Array.from({ length: 15 }, (_, index) => record(sanitizeMotionDiagnostic(JSON.stringify(motionReport(index + 1))))));
    const reports = JSON.parse(await readFile(filename, 'utf8'));
    assert.deepEqual(reports.map(report => report.sequence), [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    assert.equal(JSON.stringify(reports).includes('cookie'), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('motion validator accepts finite scientific CSS values and bounded long matrices', () => {
  const report = motionReport();
  const longMatrix = `matrix3d(${Array(16).fill('0.1234567890123456789012345').join(', ')})`;
  assert.ok(longMatrix.length > 320 && longMatrix.length <= 512);
  const style = {
    ...report.list.first, animationDuration: '1e-05s, 2.35s', animationDelay: '-1E-3s, 0ms',
    opacity: '1e-7', transform: longMatrix,
  };
  const withStyle = patch => JSON.stringify({ ...report, list: { ...report.list, first: { ...style, ...patch } } });
  assert.deepEqual(sanitizeMotionDiagnostic(withStyle({})).list.first, style);
  assert.match(PREVIEW_MOTION_SCRIPT, /transform: value\.transform\.slice\(0, 512\)/);
  for (const invalid of [
    { animationDuration: '-1e-05s' }, { animationDuration: 'NaNs' }, { animationDuration: '1e309s' },
    { animationDelay: 'NaNs' }, { animationDelay: '-1e309s' },
    { opacity: '-1e-7' }, { opacity: 'NaN' }, { opacity: '1e309' }, { opacity: '1.1' },
    { transform: 'matrix(1, NaN, 0, 1, 0, 0)' }, { transform: `matrix3d(${Array(16).fill('0.' + '1'.repeat(40)).join(', ')})` },
  ]) assert.equal(sanitizeMotionDiagnostic(withStyle(invalid)), null, JSON.stringify(invalid));
});

test('an asynchronous request failure cannot terminate the preview gateway', async () => {
  const gateway = await createRemoteGateway({
    root: fileURLToPath(new URL('../', import.meta.url)), key: 'z'.repeat(43), publicReadOnly: true,
    getState: () => { throw new Error('fixture request error'); },
  });
  try {
    const failed = await fetch(`${gateway.baseUrl}/__preview_health`);
    assert.equal(failed.status, 502);
    assert.equal(await failed.text(), '');
    assert.equal((await fetch(`${gateway.baseUrl}/ru/`)).status, 200, 'later requests still reach the same live server');
  } finally {
    await gateway.close();
  }
});
