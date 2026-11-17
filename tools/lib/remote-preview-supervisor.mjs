import { spawn } from 'node:child_process';
import { appendFileSync, closeSync, existsSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const validPublicUrl = (value, allowedOrigin) => typeof value === 'string' && (allowedOrigin !== undefined
  ? value === allowedOrigin && /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(allowedOrigin)
  : /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(value));

export async function verifyPublicPreview(url, { expectedPid, signal, fetchImpl = fetch, allowedOrigin } = {}) {
  if (!validPublicUrl(url, allowedOrigin) || signal?.aborted) return false;
  try {
    const response = await fetchImpl(`${url}/__preview_health`, {
      method: 'GET', redirect: 'error', credentials: 'omit', cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.any([AbortSignal.timeout(8000), ...(signal ? [signal] : [])]),
    });
    if (!response.ok || Number(response.headers.get('content-length')) > 8192) {
      await response.body?.cancel();
      return false;
    }
    const reader = response.body?.getReader();
    if (!reader) return false;
    const chunks = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 8192) {
          await reader.cancel();
          return false;
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const health = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return health?.project === 'HUNDESALON_NIKA' && health.role === 'remote-preview' &&
      (expectedPid === undefined || health.pid === expectedPid);
  } catch {
    return false;
  }
}

export function superviseRemotePreview({
  spawnGateway, spawnTunnel, publish = () => {}, journal = () => {}, tunnelOutput = () => {},
  restartDelayMs = 3000, setTimer = setTimeout, clearTimer = clearTimeout,
  probePublicUrl = null, probeIntervalMs = 60000, probeRetryMs = 2000, probeGraceMs = 60000,
  maxProbeFailures = 3, now = Date.now, publicOrigin = null,
}) {
  if (publicOrigin !== null && !validPublicUrl(publicOrigin, publicOrigin)) {
    throw new Error('Invalid explicitly allowed preview origin.');
  }
  let gateway = null;
  let gatewayReady = false;
  let tunnel = null;
  let publicUrl = null;
  let candidateUrl = null;
  let candidateStartedAt = 0;
  let terminalTunnel = null;
  let stopping = false;
  let gatewayTimer;
  let tunnelTimer;
  let probeTimer;
  let probeAbort;
  let probeGeneration = 0;
  let probeFailures = 0;
  const killedChildren = new WeakSet();
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
    if (!child || killedChildren.has(child)) return;
    killedChildren.add(child);
    try { child.kill(); } catch (error) { journal({ event: `${role}-kill-error`, code: error.code || 'KILL_ERROR' }); }
  };
  const cancelProbe = () => {
    clearTimer(probeTimer);
    probeTimer = undefined;
    probeGeneration += 1;
    probeAbort?.abort();
    probeAbort = undefined;
  };
  const retireTunnel = reason => {
    if (!tunnel || terminalTunnel === tunnel || stopping) return;
    terminalTunnel = tunnel;
    cancelProbe();
    candidateUrl = null;
    publicUrl = null;
    journal({ event: 'tunnel-unhealthy', pid: tunnel.pid || null, reason });
    save();
    sendUrl();
    kill(tunnel, 'tunnel');
  };
  const scheduleProbe = delay => {
    clearTimer(probeTimer);
    probeTimer = setTimer(() => { probeTimer = undefined; requestProbe(); }, delay);
  };
  const checkPublicUrl = async () => {
    const child = tunnel;
    const url = candidateUrl;
    const target = gateway;
    if (stopping || !probePublicUrl || !child || terminalTunnel === child || !gatewayReady || !target || !url) return;
    const generation = ++probeGeneration;
    const abort = new AbortController();
    probeAbort = abort;
    let healthy = false;
    try {
      healthy = await probePublicUrl(url, { expectedPid: target.pid, signal: abort.signal });
    } catch {
      // DNS, transport and response failures all count toward the same bounded retry policy.
    } finally {
      if (generation === probeGeneration) probeAbort = undefined;
    }
    if (stopping || abort.signal.aborted || generation !== probeGeneration || child !== tunnel ||
        terminalTunnel === child || url !== candidateUrl || target !== gateway || !gatewayReady) return;
    if (healthy) {
      probeFailures = 0;
      if (publicUrl !== url) {
        publicUrl = url;
        journal({ event: 'public-url', publicUrl });
        save();
        sendUrl();
      }
      scheduleProbe(probeIntervalMs);
      return;
    }
    probeFailures += 1;
    journal({ event: 'public-probe-failed', pid: child.pid || null, attempts: probeFailures });
    if (publicUrl ? probeFailures >= maxProbeFailures : now() - candidateStartedAt >= probeGraceMs) {
      retireTunnel('public-probe-failed');
      return;
    }
    scheduleProbe(publicUrl ? probeIntervalMs : probeRetryMs);
  };
  const requestProbe = () => {
    void checkPublicUrl().catch(error => {
      journal({ event: 'public-probe-error', code: error.code || error.name || 'PROBE_ERROR' });
      retireTunnel('public-probe-error');
    });
  };
  const acceptCandidate = url => {
    if (url === candidateUrl) return;
    cancelProbe();
    candidateUrl = url;
    candidateStartedAt = now();
    probeFailures = 0;
    publicUrl = null;
    if (probePublicUrl) {
      save();
      sendUrl();
      requestProbe();
      return;
    }
    publicUrl = candidateUrl;
    journal({ event: 'public-url', publicUrl });
    save();
    sendUrl();
  };
  const stop = (reason = 'stop') => {
    if (stopping) return done;
    stopping = true;
    clearTimer(gatewayTimer);
    clearTimer(tunnelTimer);
    cancelProbe();
    publicUrl = null;
    candidateUrl = null;
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
    terminalTunnel = null;
    journal({ event: 'tunnel-spawn', pid: child.pid || null });
    save();
    let tail = '';
    const capture = data => {
      if (stopping || child !== tunnel || terminalTunnel === child) return;
      const text = String(data);
      tunnelOutput(text);
      tail = (tail + text).slice(-4096);
      if (/Unauthorized:\s*Tunnel not found/i.test(tail)) {
        retireTunnel('tunnel-not-found');
        return;
      }
      if (publicOrigin) return;
      const match = tail.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match && validPublicUrl(match[0]) && match[0] !== candidateUrl) {
        acceptCandidate(match[0]);
      }
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.once('error', error => journal({ event: 'tunnel-spawn-error', code: error.code || 'SPAWN_ERROR' }));
    child.once('close', (code, signal) => {
      if (child !== tunnel) return;
      cancelProbe();
      tunnel = null;
      terminalTunnel = null;
      candidateUrl = null;
      publicUrl = null;
      journal({ event: 'tunnel-exit', pid: child.pid || null, code, signal });
      save();
      sendUrl();
      if (!stopping) tunnelTimer = setTimer(() => { tunnelTimer = undefined; startTunnel(); }, restartDelayMs);
      finishIfStopped();
    });
    if (publicOrigin) acceptCandidate(publicOrigin);
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
      if (candidateUrl && probePublicUrl) {
        cancelProbe();
        probeFailures = 0;
        candidateStartedAt = now();
        requestProbe();
      } else startTunnel();
    });
    child.once('error', error => journal({ event: 'gateway-spawn-error', code: error.code || 'SPAWN_ERROR' }));
    child.once('close', (code, signal) => {
      if (child !== gateway) return;
      cancelProbe();
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
  const namedOrigin = config.namedPublicUrl || null;
  const tokenFile = path.join(root, '.secrets', 'cloudflare-preview', 'tunnel.token');
  if (namedOrigin && (namedOrigin !== 'https://preview.hundesalon-nika.com' || !config.publicReadOnly || config.allowedEmail ||
      config.tunnelTokenFile !== tokenFile || !existsSync(tokenFile))) throw new Error('Invalid named preview configuration.');
  const journal = event => appendFileSync(path.join(output, 'remote-runtime.lifecycle.jsonl'), `${JSON.stringify({ time: new Date().toISOString(), supervisorPid: process.pid, ...event })}\n`);
  const controller = superviseRemotePreview({
    spawnGateway: () => spawnLoggedGateway({ root, output }),
    spawnTunnel: () => spawn(path.join(output, 'cloudflared.exe'), namedOrigin ? [
      'tunnel', '--no-autoupdate', '--protocol', 'http2', 'run', '--token-file', tokenFile,
    ] : [
      'tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', 'http://127.0.0.1:5514',
      ...(config.allowedEmail ? ['--allowed-mail', config.allowedEmail] : []),
    ], { cwd: output, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }),
    publish: createPreviewStateWriter({ output, config, home: process.argv.includes('--home') }),
    journal,
    tunnelOutput: text => appendFileSync(path.join(output, 'tunnel.log'), text),
    publicOrigin: namedOrigin,
    probePublicUrl: config.allowedEmail ? null : (url, options) => verifyPublicPreview(url, { ...options, allowedOrigin: namedOrigin ?? undefined }),
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void controller.stop(signal); });
  process.on('uncaughtExceptionMonitor', error => {
    journal({ event: 'supervisor-fatal', code: error.code || error.name });
    void controller.stop('supervisor-fatal');
  });
  return controller.done;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await run();
