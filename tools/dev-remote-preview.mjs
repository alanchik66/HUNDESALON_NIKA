import { spawn } from 'node:child_process';
import { timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { startStaticTestServer } from './lib/static-test-server.mjs';

const project = 'HUNDESALON_NIKA';
const sameKey = (candidate, key) => {
  const left = Buffer.from(candidate || '');
  const right = Buffer.from(key);
  return left.length === right.length && timingSafeEqual(left, right);
};

export async function createRemoteGateway({
  root,
  key,
  port = 0,
  emailProtected = false,
  publicReadOnly = false,
  getState = () => ({}),
  onStop = () => {},
}) {
  const website = await startStaticTestServer(root);
  const server = createServer(async (request, response) => {
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
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ project, role: 'remote-preview', pid: process.pid, ...getState() }));
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
    if (request.method === 'GET' && url.pathname === '/__preview_login' && sameKey(url.searchParams.get('key'), key)) {
      response
        .writeHead(303, {
          'Set-Cookie': `__Host-nika-preview=${key}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=86400`,
          Location: '/ru/prays-list.html',
        })
        .end();
      return;
    }
    const cookie = (request.headers.cookie || '')
      .split(';')
      .map(value => value.trim())
      .find(value => value.startsWith('__Host-nika-preview='))
      ?.slice('__Host-nika-preview='.length);
    if (!emailProtected && !publicReadOnly && !sameKey(cookie, key)) {
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
    if (['/sw.js', '/sp-push-worker-fb.js'].includes(url.pathname)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const upstream = await fetch(`${website.baseUrl}${url.pathname}${url.search}`, {
        method: request.method,
        signal: AbortSignal.timeout(30000),
      });
      response.writeHead(upstream.status, {
        'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
      });
      if (request.method === 'HEAD' || !upstream.body) response.end();
      else await pipeline(Readable.fromWeb(upstream.body), response);
    } catch {
      if (!response.headersSent) response.writeHead(502);
      response.end();
    }
  });
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
  } catch (error) {
    await website.close();
    throw error;
  }
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
      await website.close();
    },
  };
}

async function run() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const output = path.join(root, 'output/local-preview');
  const config = JSON.parse(await readFile(path.join(output, 'remote-config.json'), 'utf8'));
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
    stopped = true;
    child?.kill();
    await gateway.close();
    process.exit(23);
  };
  try {
    gateway = await createRemoteGateway({
      root,
      key: config.key,
      port: 5514,
      emailProtected: Boolean(config.allowedEmail),
      publicReadOnly: Boolean(config.publicReadOnly),
      getState: () => ({
        publicUrl,
        emailProtected: Boolean(config.allowedEmail),
        publicReadOnly: Boolean(config.publicReadOnly),
      }),
      onStop: stop,
    });
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      const response = await fetch('http://127.0.0.1:5514/__preview_health', {
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
