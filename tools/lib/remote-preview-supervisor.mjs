import { spawn } from 'node:child_process';
import { appendFileSync, closeSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const validPublicUrl = value => /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(value);

export function superviseRemotePreview({
  spawnGateway, spawnTunnel, publish = () => {}, journal = () => {}, tunnelOutput = () => {},
  restartDelayMs = 3000, setTimer = setTimeout, clearTimer = clearTimeout,
}) {
  let gateway = null;
  let gatewayReady = false;
  let tunnel = null;
  let publicUrl = null;
  let stopping = false;
  let gatewayTimer;
  let tunnelTimer;
  let finish;
  const done = new Promise(resolve => { finish = resolve; });
  const state = () => ({ pid: gateway?.pid || null, childPid: tunnel?.pid || null, publicUrl, gatewayReady, stopping });
  const save = () => publish(state());
  const finishIfStopped = () => { if (stopping && !gateway && !tunnel) finish(23); };
  const sendUrl = () => {
    if (!gateway?.connected) return;
    try {
      gateway.send({ type: 'public-url', publicUrl }, error => {
        if (error) journal({ event: 'gateway-ipc-error', code: error.code || 'IPC_ERROR' });
      });
    } catch (error) {
      journal({ event: 'gateway-ipc-error', code: error.code || 'IPC_ERROR' });
    }
  };
  const kill = (child, role) => {
    if (!child) return;
    try { child.kill(); } catch (error) { journal({ event: `${role}-kill-error`, code: error.code || 'KILL_ERROR' }); }
  };
  const stop = (reason = 'stop') => {
    if (stopping) return done;
    stopping = true;
    clearTimer(gatewayTimer);
    clearTimer(tunnelTimer);
    journal({ event: 'stop', reason });
    save();
    kill(gateway, 'gateway');
    kill(tunnel, 'tunnel');
    finishIfStopped();
    return done;
  };
  const startTunnel = () => {
    if (stopping || tunnel || !gatewayReady) return;
    const child = spawnTunnel();
    tunnel = child;
    journal({ event: 'tunnel-spawn', pid: child.pid || null });
    save();
    let tail = '';
    const capture = data => {
      const text = String(data);
      tunnelOutput(text);
      tail = (tail + text).slice(-4096);
      const match = tail.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (child === tunnel && match && validPublicUrl(match[0]) && match[0] !== publicUrl) {
        publicUrl = match[0];
        journal({ event: 'public-url', publicUrl });
        save();
        sendUrl();
      }
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.once('error', error => journal({ event: 'tunnel-spawn-error', code: error.code || 'SPAWN_ERROR' }));
    child.once('close', (code, signal) => {
      if (child !== tunnel) return;
      tunnel = null;
      publicUrl = null;
      journal({ event: 'tunnel-exit', pid: child.pid || null, code, signal });
      save();
      sendUrl();
      if (!stopping) tunnelTimer = setTimer(() => { tunnelTimer = undefined; startTunnel(); }, restartDelayMs);
      finishIfStopped();
    });
  };
  const startGateway = () => {
    if (stopping || gateway) return;
    const child = spawnGateway();
    gateway = child;
    gatewayReady = false;
    journal({ event: 'gateway-spawn', pid: child.pid || null });
    save();
    child.on('message', message => {
      if (child !== gateway || stopping || message?.type !== 'ready') return;
      gatewayReady = true;
      journal({ event: 'gateway-ready', pid: child.pid || null });
      save();
      sendUrl();
      startTunnel();
    });
    child.once('error', error => journal({ event: 'gateway-spawn-error', code: error.code || 'SPAWN_ERROR' }));
    child.once('close', (code, signal) => {
      if (child !== gateway) return;
      gateway = null;
      gatewayReady = false;
      journal({ event: 'gateway-exit', pid: child.pid || null, code, signal });
      save();
      if (!stopping && code === 23) { stop('gateway-stop'); return; }
      if (!stopping) gatewayTimer = setTimer(() => { gatewayTimer = undefined; startGateway(); }, restartDelayMs);
      finishIfStopped();
    });
  };
  startGateway();
  return { done, stop, state };
}

export function spawnLoggedGateway({ root, output, spawnChild = spawn }) {
  const stdout = openSync(path.join(output, 'remote-runtime.stdout.log'), 'a');
  const stderr = openSync(path.join(output, 'remote-runtime.stderr.log'), 'a');
  try {
    return spawnChild(process.execPath, [path.join(root, 'tools', 'dev-remote-preview.mjs')], {
      cwd: root, windowsHide: true, env: { ...process.env, PREVIEW_REMOTE_SUPERVISED: '1' },
      stdio: ['ignore', stdout, stderr, 'ipc'],
    });
  } finally {
    closeSync(stdout);
    closeSync(stderr);
  }
}

export function createPreviewStateWriter({ output, config, home = false }) {
  return state => {
    const updatedAt = new Date().toISOString();
    const publicUrl = state.publicUrl;
    const url = !publicUrl ? null : config.allowedEmail || config.publicReadOnly
      ? `${publicUrl}${home ? '/ru/' : '/ru/prays-list.html'}`
      : home ? `${publicUrl}/ru/?__preview_key=${config.key}` : `${publicUrl}/__preview_login?key=${config.key}`;
    writeFileSync(path.join(output, 'remote-state.json'), `${JSON.stringify({ ...state, supervisorPid: process.pid, updatedAt }, null, 2)}\n`);
    writeFileSync(path.join(output, 'iphone-link.json'), `${JSON.stringify({ url, publicUrl, updatedAt }, null, 2)}\n`, { mode: 0o600 });
  };
}

async function run() {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const output = path.join(root, 'output', 'local-preview');
  const config = JSON.parse(readFileSync(path.join(output, 'remote-config.json'), 'utf8'));
  const journal = event => appendFileSync(path.join(output, 'remote-runtime.lifecycle.jsonl'), `${JSON.stringify({ time: new Date().toISOString(), supervisorPid: process.pid, ...event })}\n`);
  const controller = superviseRemotePreview({
    spawnGateway: () => spawnLoggedGateway({ root, output }),
    spawnTunnel: () => spawn(path.join(output, 'cloudflared.exe'), [
      'tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', 'http://127.0.0.1:5514',
      ...(config.allowedEmail ? ['--allowed-mail', config.allowedEmail] : []),
    ], { cwd: output, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }),
    publish: createPreviewStateWriter({ output, config, home: process.argv.includes('--home') }),
    journal,
    tunnelOutput: text => appendFileSync(path.join(output, 'tunnel.log'), text),
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void controller.stop(signal); });
  process.on('uncaughtExceptionMonitor', error => {
    journal({ event: 'supervisor-fatal', code: error.code || error.name });
    void controller.stop('supervisor-fatal');
  });
  return controller.done;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await run();
