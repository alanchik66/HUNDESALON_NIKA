import { spawn } from 'node:child_process';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { access, link, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import { homedir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const filename = fileURLToPath(import.meta.url);
const root = path.dirname(path.dirname(filename));
const instance = path.join(root, 'output', 'local-site-admin', 'private-access');
const secretPath = path.join(instance, 'control.key');
const connector = path.join(root, 'output', 'local-preview', 'cloudflared.exe');
const namedSecrets = path.join(root, '.secrets', 'cloudflare-admin');
const namedTokenFile = path.join(namedSecrets, 'tunnel.token');
const namedOrigin = 'https://admin-preview.hundesalon-nika.com';
const namedPort = 5515;
const ownerTransferState = path.join(root, 'output', 'iphone-owner-transfer', 'active.json');
const identifier = createHash('sha256')
  .update(root + '\n' + homedir())
  .digest('hex')
  .slice(0, 24);
const socketPath =
  process.platform === 'win32' ? `\\\\.\\pipe\\nika-admin-${identifier}` : path.join(instance, 'control.sock');
const absent = error => ['ENOENT', 'ECONNREFUSED'].includes(error?.code);
const sign = (key, message) => createHmac('sha256', key).update(message).digest('hex');
const matches = (expected, actual) =>
  typeof actual === 'string' &&
  /^[a-f0-9]{64}$/.test(actual) &&
  timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));

function emailAddress(value) {
  const mail = String(value || '')
    .trim()
    .toLowerCase();
  if (mail.length > 254 || !/^[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(mail)) {
    throw new Error('Укажите один точный почтовый адрес владельца.');
  }
  return mail;
}

async function namedConfig() {
  let config;
  try {
    config = JSON.parse(await readFile(path.join(namedSecrets, 'runtime.json'), 'utf8'));
  } catch {
    throw new Error('Недоступна конфигурация постоянного защищённого адреса.');
  }
  if (
    config?.version !== 1 || Object.keys(config).length !== 3 || config.origin !== namedOrigin ||
    typeof config.teamOrigin !== 'string' ||
    !/^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/.test(config.teamOrigin)
  ) {
    throw new Error('Неверная конфигурация постоянного защищённого адреса.');
  }
  return { origin: config.origin, teamOrigin: config.teamOrigin };
}

async function isOwnerKeyTransferActive() {
  try {
    const transfer = JSON.parse(await readFile(ownerTransferState, 'utf8'));
    return transfer.url === namedOrigin + '/owner-key-transfer/' &&
      /^[a-f0-9]{32}$/.test(transfer.dir) && Number.isFinite(transfer.deadline) && transfer.deadline > Date.now();
  } catch {
    return false;
  }
}

function tunnelIdentity(key, tunnel) {
  return tunnel.named
    ? ['namedId', sign(key, 'named:' + tunnel.named.origin + '\n' + tunnel.named.teamOrigin)]
    : ['mailId', sign(key, 'mail:' + tunnel.mail)];
}

async function controlKey(create) {
  try {
    return await readFile(secretPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (!create) return null;
  await mkdir(instance, { recursive: true, mode: 0o700 });
  // Publish complete bytes atomically, including when two consoles start at once.
  const temp = path.join(instance, randomBytes(16).toString('hex') + '.tmp');
  try {
    await writeFile(temp, randomBytes(32), { flag: 'wx', mode: 0o600 });
    try {
      await link(temp, secretPath);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  } finally {
    await rm(temp, { force: true });
  }
  return readFile(secretPath);
}

function command(key, action) {
  const route = '/' + action;
  const nonce = randomBytes(24).toString('hex');
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath,
        method: 'POST',
        path: route,
        signal: AbortSignal.timeout(2500),
        headers: { 'x-nika-nonce': nonce, 'x-nika-proof': sign(key, route + nonce) },
      },
      res => {
        let body = '';
        res.setEncoding('utf8');
        res.on('error', reject);
        res.on('data', chunk => {
          body += chunk;
          if (body.length > 2048) res.destroy(new Error('Некорректный ответ локального процесса.'));
        });
        res.on('end', () => {
          if (res.statusCode !== 200 || !matches(sign(key, nonce + body), res.headers['x-nika-proof'])) {
            reject(new Error('Подлинность локального процесса не подтверждена.'));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    req.on('error', error => (absent(error) ? resolve(null) : reject(error)));
    req.end();
  });
}

function listen(server, ...address) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(...address, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

async function worker(key, tunnel) {
  const { createPrivateAdminProxy } = await import('./lib/private-admin-proxy.mjs');
  const { verifyPrivateAdminEdge, verifyNamedPrivateAdminEdge } = await import('./lib/private-admin-edge.mjs');
  const { named, mail } = tunnel;
  const [identityField, identity] = tunnelIdentity(key, tunnel);
  const state = { state: 'starting', [identityField]: identity };
  let origin = null;
  let child;
  let stopping = false;
  const proxy = createPrivateAdminProxy({
    getOrigin: () => origin,
    isOwnerKeyTransferActive: named ? isOwnerKeyTransferActive : undefined,
  });
  const control = http.createServer((req, res) => {
    const nonce = req.headers['x-nika-nonce'];
    if (
      req.method !== 'POST' ||
      !['/status', '/stop'].includes(req.url) ||
      !/^[a-f0-9]{48}$/.test(nonce || '') ||
      !matches(sign(key, req.url + nonce), req.headers['x-nika-proof'])
    ) {
      res.writeHead(403).end();
      return;
    }
    if (req.url === '/stop') {
      origin = null;
      state.state = 'stopping';
      delete state.url;
      res.once('finish', shutdown);
    }
    const body = JSON.stringify(state);
    res.writeHead(200, { 'x-nika-proof': sign(key, nonce + body), connection: 'close' }).end(body);
  });
  function shutdown() {
    if (stopping) return;
    stopping = true;
    origin = null;
    child?.kill();
    proxy.closeAllConnections();
    proxy.close();
    control.close();
  }
  await listen(control, socketPath);
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
  try {
    await listen(proxy, named ? namedPort : 0, '127.0.0.1');
    const port = proxy.address().port;
    const mode = named
      ? ['run', '--token-file', namedTokenFile]
      : ['--url', `http://127.0.0.1:${port}`, '--allowed-mail', mail];
    const env = named
      // Only this connector's token file may supply credentials or tunnel settings.
      ? Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(TUNNEL_|CLOUDFLARE_|CF_|SITE_ADMIN_)/i.test(name)))
      : process.env;
    child = spawn(connector, ['tunnel', '--no-autoupdate', '--protocol', 'http2', ...mode], {
      cwd: instance, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let terminated = false;
    const exited = new Promise(resolve => {
      const done = () => {
        terminated = true;
        origin = null;
        resolve();
      };
      child.once('exit', done);
      child.once('error', done);
    });
    let candidate = named?.origin;
    let registered = false;
    let protectedTunnel = false;
    let oneTimePin = false;
    let oneAddress = false;
    for (const stream of [child.stdout, child.stderr]) {
      createInterface({ input: stream }).on('line', line => {
        if (named) {
          if (/\bINF Registered tunnel connection\s+connIndex=\d+\b/.test(line)) registered = true;
          return;
        }
        const url = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com(?=[\s/|]|$)/i);
        if (url) candidate = url[0].toLowerCase();
        if (/Your protected quick Tunnel has been created!/i.test(line)) protectedTunnel = true;
        if (/Authentication:\s*One-Time PIN \(using Cloudflare Access\)/i.test(line)) oneTimePin = true;
        if (/Allowed recipients:\s*1 address(?:\s|[|]|$)/i.test(line)) oneAddress = true;
      });
    }
    const deadline = Date.now() + 110000;
    while (!stopping && !terminated && Date.now() < deadline) {
      if (candidate && (named ? registered : protectedTunnel && oneTimePin && oneAddress)) {
        const checked = candidate;
        const verified = await (named ? verifyNamedPrivateAdminEdge(named) : verifyPrivateAdminEdge(checked)).catch(() => false);
        if (
          verified &&
          !stopping &&
          !terminated &&
          checked === candidate
        ) {
          origin = checked;
          state.state = 'ready';
          state.url = checked + '/admin/';
          break;
        }
      }
      await Promise.race([delay(1200), exited]);
    }
    if (stopping) return;
    if (!origin) {
      throw new Error(named
        ? 'Cloudflare не подтвердил запуск коннектора и защиту Access. Доступ закрыт.'
        : 'Cloudflare не подтвердил защиту одноразовым кодом. Доступ закрыт.');
    }
    await exited;
  } catch (error) {
    if (!stopping) {
      origin = null;
      child?.kill();
      delete state.url;
      state.state = 'failed';
      state.message = error.message.startsWith('Cloudflare') ? error.message : 'Не удалось запустить защищённый вход.';
      await delay(4500);
    }
  } finally {
    shutdown();
  }
}

async function main() {
  const [action, value, ...rest] = process.argv.slice(2);
  const quick = action === 'start' || action === 'worker';
  const named = action === 'start-named' || action === 'worker-named';
  if (rest.length || (!quick && value !== undefined) || (!quick && !named && !['status', 'stop'].includes(action))) {
    throw new Error('Команды: start <email>, start-named, status, stop.');
  }
  const tunnel = quick ? { mail: emailAddress(value) } : named ? { named: await namedConfig() } : null;
  const key = await controlKey(action === 'start' || action === 'start-named');
  if (key && key.length !== 32) throw new Error('Локальный ключ управления повреждён.');
  if (action === 'worker' || action === 'worker-named') {
    if (!key) throw new Error('Недоступен ключ управления.');
    await worker(key, tunnel);
    return;
  }
  let state = key ? await command(key, action === 'stop' ? 'stop' : 'status') : null;
  if (action === 'stop') {
    console.log('Доступ с телефона закрыт.');
    return;
  }
  if (action === 'status') {
    console.log(
      state?.state === 'ready'
        ? state.url
        : state?.state === 'starting'
          ? 'Проверяем защиту Cloudflare.'
          : 'Доступ с телефона закрыт.'
    );
    return;
  }
  const [identityField, identity] = tunnelIdentity(key, tunnel);
  let observedWorker = Boolean(state);
  if (!state) {
    await access(connector);
    if (named) await access(namedTokenFile).catch(() => {
      throw new Error('Недоступен токен коннектора постоянного защищённого адреса.');
    });
    const local = await fetch('http://127.0.0.1:8796/api/admin/settings', {
      redirect: 'error',
      signal: AbortSignal.timeout(3000),
    });
    if (local.status !== 401) throw new Error('Сначала запустите локальную панель владельца.');
    const args = named ? [filename, 'worker-named'] : [filename, 'worker', tunnel.mail];
    const child = spawn(process.execPath, args, {
      cwd: root,
      windowsHide: true,
      detached: true,
      stdio: 'ignore',
    });
    await new Promise((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
    child.unref();
  }
  const deadline = Date.now() + 135000;
  while (Date.now() < deadline) {
    if (state?.state === 'stopping' || (observedWorker && !state))
      throw new Error('Защищённый вход остановлен. Повторите команду ' + action + '.');
    if (state) observedWorker = true;
    if (state && state[identityField] !== identity) {
      throw new Error('Другой режим защищённого входа уже запущен. Сначала остановите его командой stop.');
    }
    if (state?.state === 'ready') {
      console.log(state.url);
      return;
    }
    if (state?.state === 'failed') throw new Error(state.message);
    await delay(650);
    state = await command(key, 'status');
  }
  throw new Error('Не удалось подтвердить запуск. Проверьте состояние командой status.');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
