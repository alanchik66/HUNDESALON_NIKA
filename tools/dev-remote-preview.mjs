import { spawn, execFileSync } from 'node:child_process';
import { timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { isPublicPath, startStaticTestServer } from './lib/static-test-server.mjs';
import { PREVIEW_MOTION_SCRIPT, sanitizeMotionDiagnostic, createMotionDiagnosticRecorder } from './lib/preview-motion-diagnostics.mjs';

const project = 'HUNDESALON_NIKA';
const sameKey = (candidate, key) => {
  const left = Buffer.from(candidate || '');
  const right = Buffer.from(key);
  return left.length === right.length && timingSafeEqual(left, right);
};

const resolveWebsiteOrigin = value => {
  const url = new URL(value);
  if (
    url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.username || url.password || url.pathname !== '/' || url.search || url.hash
  ) throw new Error('Preview upstream must be a loopback HTTP origin.');
  return url.origin;
};

export async function createRemoteGateway({
  root,
  key,
  port = 0,
  emailProtected = false,
  publicReadOnly = false,
  weatherModuleDirectory,
  websiteOrigin,
  mediaRoot,
  onMotionDiagnostic,
  getState = () => ({}),
  onStop = () => {},
}) {
  const diagnosticsEnabled = typeof onMotionDiagnostic === 'function';
  const website = websiteOrigin
    ? { baseUrl: resolveWebsiteOrigin(websiteOrigin), close: async () => {} }
    : await startStaticTestServer(root, { weatherModuleDirectory });
  let media;
  try {
    if (mediaRoot) media = await startStaticTestServer(mediaRoot);
  } catch (error) {
    await website.close();
    throw error;
  }
  const handleRequest = async (request, response) => {
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
    response.setHeader('X-Frame-Options', 'DENY');
    let url;
    try {
      url = new URL(request.url, 'http://127.0.0.1');
    } catch {
      response.writeHead(400).end();
      return;
    }
    if (request.method === 'GET' && url.pathname === '/__preview_health') {
      const body = JSON.stringify({ project, role: 'remote-preview', pid: process.pid, ...getState() });
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(body);
      return;
    }
    if (
      request.method === 'POST' &&
      url.pathname === '/__preview_stop' &&
      request.headers.host === '127.0.0.1:5514' &&
      sameKey(request.headers['x-preview-admin'], key)
    ) {
      response.writeHead(200).end('Stopped');
      setTimeout(onStop, 100);
      return;
    }
    if (request.method === 'GET' && url.pathname === '/robots.txt') {
      response.writeHead(200, { 'Content-Type': 'text/plain' }).end('User-agent: *\nDisallow: /\n');
      return;
    }
    if (
      ['GET', 'HEAD'].includes(request.method) &&
      ['/__preview_login', '/__preview_login.html'].includes(url.pathname) &&
      sameKey(url.searchParams.get('key'), key)
    ) {
      const destination = url.searchParams.get('next') === '/ru/' ? '/ru/' : '/ru/prays-list.html';
      const html = `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="0;url=${destination}"><title>Предпросмотр сайта</title></head><body><p>Открываем сайт…</p><a href="${destination}">Открыть сайт</a></body></html>`;
      response
        .writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': 'inline',
          'Content-Length': Buffer.byteLength(html),
          'Set-Cookie': `__Host-nika-preview=${key}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=86400`,
        })
        .end(request.method === 'HEAD' ? undefined : html);
      return;
    }
    const cookie = (request.headers.cookie || '')
      .split(';')
      .map(value => value.trim())
      .find(value => value.startsWith('__Host-nika-preview='))
      ?.slice('__Host-nika-preview='.length);
    const directHomeAccess = ['GET', 'HEAD'].includes(request.method) && url.pathname === '/ru/' &&
      sameKey(url.searchParams.get('__preview_key'), key);
    if (directHomeAccess) {
      response.setHeader('Set-Cookie', `__Host-nika-preview=${key}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=86400`);
    }
    if (!emailProtected && !publicReadOnly && !directHomeAccess && !sameKey(cookie, key)) {
      response
        .writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
        .end('Откройте личную ссылку предварительного просмотра.');
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      response
        .writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'application/json; charset=utf-8' })
        .end(JSON.stringify({ success: false, message: 'Предварительный просмотр: отправка заявок отключена.' }));
      return;
    }
    if (diagnosticsEnabled && url.pathname === '/__preview_motion') {
      if (request.method !== 'GET') {
        response.writeHead(405, { Allow: 'GET' }).end();
        return;
      }
      const report = sanitizeMotionDiagnostic(url.searchParams.get('data'));
      if (!report) {
        response.writeHead(400).end('Invalid motion diagnostic');
        return;
      }
      try {
        await onMotionDiagnostic(report);
        response.writeHead(204).end();
      } catch {
        response.writeHead(500).end('Diagnostic unavailable');
      }
      return;
    }
    if (['/sw.js', '/sp-push-worker-fb.js'].includes(url.pathname)) {
      response.writeHead(403).end();
      return;
    }
    let relative;
    try {
      const pathname = decodeURIComponent(url.pathname);
      const requested = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
      const resolvedRoot = path.resolve(root);
      relative = path.relative(resolvedRoot, path.resolve(resolvedRoot, `.${requested}`));
    } catch {
      response.writeHead(400).end('Bad request');
      return;
    }
    const isPagesApi = websiteOrigin && (publicReadOnly
      ? ['/api/weather', '/reverse-geocode'].includes(url.pathname)
      : relative.startsWith(`api${path.sep}`) || relative === 'reverse-geocode');
    if (relative.startsWith('..') || path.isAbsolute(relative) || (!isPublicPath(relative) && !isPagesApi)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    try {
      const requestHeaders = { 'Accept-Encoding': 'identity' };
      for (const name of ['range', 'if-range']) {
        if (typeof request.headers[name] === 'string') requestHeaders[name] = request.headers[name];
      }
      const upstreamUrl = new URL(url);
      upstreamUrl.searchParams.delete('__preview_key');
      const upstreamOrigin = media && ['.mp4', '.webm'].includes(path.extname(relative).toLowerCase())
        ? media.baseUrl : website.baseUrl;
      const upstream = await fetch(`${upstreamOrigin}${upstreamUrl.pathname}${upstreamUrl.search}`, {
        method: request.method,
        headers: requestHeaders,
        redirect: 'manual',
        signal: AbortSignal.timeout(30000),
      });
      const responseHeaders = {
        'Content-Type': upstream.headers.get('content-type') ||
          (upstream.status >= 400 ? 'text/plain; charset=utf-8' : 'application/octet-stream'),
      };
      for (const name of ['content-range', 'accept-ranges', 'content-length', 'last-modified']) {
        const value = upstream.headers.get(name);
        if (value !== null) responseHeaders[name] = value;
      }
      const location = upstream.headers.get('location');
      if (location && upstream.status >= 300 && upstream.status < 400) {
        const destination = new URL(location, upstreamOrigin);
        if (destination.origin !== upstreamOrigin) throw new Error('Preview upstream redirects must stay on the same origin.');
        responseHeaders.Location = `${destination.pathname}${destination.search}${destination.hash}`;
      }
      if ((directHomeAccess || diagnosticsEnabled) && upstream.status === 200 && /^text\/html(?:;|$)/i.test(responseHeaders['Content-Type'])) {
        if (request.method === 'HEAD') {
          delete responseHeaders['content-length'];
        } else {
          const original = Buffer.from(await upstream.arrayBuffer());
          const html = original.toString('utf8');
          const cleanup = directHomeAccess ? `<script>try{const u=new URL(location.href);u.searchParams.delete('__preview_key');history.replaceState(history.state,'',u.pathname+u.search+u.hash)}catch{}</script>` : '';
          const diagnostics = diagnosticsEnabled ? `<script>${PREVIEW_MOTION_SCRIPT}</script>` : '';
          const cleaned = html.replace(/<head\b[^>]*>/i, head => `${head}${cleanup}${diagnostics}`);
          const body = cleaned === html ? original : Buffer.from(cleaned);
          responseHeaders['content-length'] = String(body.length);
          response.writeHead(upstream.status, responseHeaders).end(body);
          return;
        }
      }
      response.writeHead(upstream.status, responseHeaders);
      if (request.method === 'HEAD' || !upstream.body) response.end();
      else await pipeline(Readable.fromWeb(upstream.body), response);
    } catch {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    }
  };
  const server = createServer((request, response) => {
    request.once('error', () => response.destroy());
    response.once('error', () => response.destroy());
    void handleRequest(request, response).catch(error => {
      console.error('Preview request failed:', error?.code || error?.name || 'REQUEST_ERROR');
      if (!response.destroyed && !response.writableEnded) {
        if (!response.headersSent) response.writeHead(502);
        response.end();
      }
    });
  });
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
  } catch (error) {
    await media?.close();
    await website.close();
    throw error;
  }
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
      await media?.close();
      await website.close();
    },
  };
}

async function run() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const output = path.join(root, 'output/local-preview');
  const config = JSON.parse(await readFile(path.join(output, 'remote-config.json'), 'utf8'));
  const supervised = process.env.PREVIEW_REMOTE_SUPERVISED === '1';
  const websiteOrigin = process.env.PREVIEW_SITE_ORIGIN;
  const onMotionDiagnostic = process.env.PREVIEW_MOTION_DIAGNOSTICS === '1'
    ? createMotionDiagnosticRecorder(path.join(output, 'mobile-motion-diagnostics.json')) : undefined;
  const weatherModuleDirectory = path.join(root, 'output', 'weather-local');
  if (!websiteOrigin) {
    execFileSync(process.execPath, [
      path.join(root, '3d-weather-codrops-main', 'scripts', 'build.mjs'), '--out-dir', weatherModuleDirectory,
    ], { cwd: root, stdio: 'inherit' });
  }
  let child;
  let gateway;
  let stopped = false;
  let publicUrl = null;
  const save = () =>
    writeFile(
      path.join(output, 'remote-state.json'),
      JSON.stringify(
        { pid: process.pid, childPid: child?.pid, publicUrl, updatedAt: new Date().toISOString() },
        null,
        2
      )
    );
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    child?.kill();
    await gateway.close();
    process.exit(23);
  };
  try {
    gateway = await createRemoteGateway({
      root,
      weatherModuleDirectory,
      websiteOrigin,
      mediaRoot: websiteOrigin ? path.join(root, 'dist') : undefined,
      onMotionDiagnostic,
      key: config.key,
      port: 5514,
      emailProtected: Boolean(config.allowedEmail),
      publicReadOnly: Boolean(config.publicReadOnly),
      getState: () => ({
        publicUrl,
        supervised,
        emailProtected: Boolean(config.allowedEmail),
        publicReadOnly: Boolean(config.publicReadOnly),
      }),
      onStop: stop,
    });
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      // Fixed loopback-only health check; this HTTP request never leaves the machine.
      // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request
      const response = await fetch('http://127.0.0.1:5514/__preview_health', {
        redirect: 'error',
        signal: AbortSignal.timeout(2000),
      }).catch(() => null);
      const existing = response?.ok ? await response.json().catch(() => null) : null;
      if (existing?.project === project && existing.role === 'remote-preview') process.exit(23);
    }
    throw error;
  }
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.once(signal, () => {
      void stop();
    });
  if (supervised) {
    if (typeof process.send !== 'function') throw new Error('Supervised preview requires an IPC parent.');
    process.on('message', message => {
      if (message?.type === 'public-url' && (message.publicUrl === null ||
          /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(message.publicUrl))) {
        publicUrl = message.publicUrl;
      }
    });
    process.once('disconnect', () => { void stop(); });
    process.send({ type: 'ready' }, error => { if (error) void stop(); });
    return;
  }
  while (!stopped) {
    publicUrl = null;
    child = spawn(
      path.join(output, 'cloudflared.exe'),
      [
        'tunnel',
        '--no-autoupdate',
        '--protocol',
        'http2',
        '--url',
        gateway.baseUrl,
        ...(config.allowedEmail ? ['--allowed-mail', config.allowedEmail] : []),
      ],
      { cwd: output, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    await save();
    const capture = data => {
      const text = data.toString();
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) {
        publicUrl = match[0];
        void save().catch(() => {});
      }
      void appendFile(path.join(output, 'tunnel.log'), text).catch(() => {});
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    await new Promise(resolve => {
      child.once('exit', resolve);
      child.once('error', resolve);
    });
    if (!stopped) await new Promise(resolve => setTimeout(resolve, 3000));
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await run();
