import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  superviseRemotePreview, spawnLoggedGateway, createPreviewStateWriter, verifyPublicPreview,
} from './lib/remote-preview-supervisor.mjs';

function harness(publish = () => {}, options = {}) {
  let nextPid = 100;
  let clock = 0;
  class Child extends EventEmitter {
    constructor() {
      super();
      this.pid = nextPid++;
      this.connected = true;
      this.stdout = new PassThrough();
      this.stderr = new PassThrough();
      this.messages = [];
      this.killCount = 0;
    }
    send(message, callback) { this.messages.push(message); callback?.(); }
    exit(code, signal = null) { this.connected = false; this.emit('close', code, signal); }
    kill() { this.killCount += 1; void Promise.resolve().then(() => this.exit(null, 'SIGTERM')); return true; }
  }
  const gateways = [];
  const tunnels = [];
  const timers = [];
  const events = [];
  const states = [];
  const controller = superviseRemotePreview({
    spawnGateway: () => { const child = new Child(); gateways.push(child); return child; },
    spawnTunnel: () => { const child = new Child(); tunnels.push(child); return child; },
    publish: state => { states.push(state); publish(state); },
    journal: event => events.push(event),
    setTimer: (callback, delay) => {
      const timer = { callback, delay, due: clock + delay, cancelled: false };
      timers.push(timer);
      return timer;
    },
    clearTimer: timer => { if (timer) timer.cancelled = true; },
    now: () => clock,
    ...options,
  });
  const advance = () => {
    timers.sort((left, right) => left.due - right.due);
    while (timers.length) {
      const timer = timers.shift();
      if (!timer.cancelled) {
        clock = Math.max(clock, timer.due);
        timer.callback();
        return timer.delay;
      }
    }
    assert.fail('No pending restart');
  };
  return { controller, gateways, tunnels, events, states, timers, advance };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

function deferredProbes() {
  const requests = [];
  return {
    requests,
    probePublicUrl: (url, options) => new Promise(resolve => { requests.push({ url, ...options, resolve }); }),
  };
}

test('gateway crashes restart only the gateway and retain the same connected tunnel URL', async () => {
  const { controller, gateways, tunnels, events, advance } = harness();
  assert.equal(tunnels.length, 0, 'the first tunnel waits for an initialized gateway');
  gateways[0].emit('message', { type: 'ready' });
  assert.equal(tunnels.length, 1);
  const url = 'https://same-session.trycloudflare.com';
  tunnels[0].stdout.write(`ready ${url}\n`);
  assert.equal(controller.state().publicUrl, url);
  gateways[0].exit(1);
  assert.equal(controller.state().publicUrl, url);
  assert.equal(tunnels[0].killCount, 0);
  advance();
  assert.equal(gateways.length, 2);
  gateways[1].emit('message', { type: 'ready' });
  assert.equal(tunnels.length, 1, 'a gateway restart must not create another quick tunnel');
  assert.deepEqual(gateways[1].messages.at(-1), { type: 'public-url', publicUrl: url });
  assert.equal(controller.state().publicUrl, url);
  assert.ok(events.some(event => event.event === 'gateway-exit' && event.code === 1));
  gateways[1].exit(23);
  assert.equal(await controller.done, 23);
  assert.equal(tunnels[0].killCount, 1, 'an explicit gateway stop ends its owned tunnel');
});

test('a tunnel exit updates the public URL and phone link while preserving the gateway', async () => {
  const output = await mkdtemp(path.join(tmpdir(), 'nika-supervisor-state-'));
  const publish = createPreviewStateWriter({ output, config: { publicReadOnly: true }, home: true });
  const { controller, gateways, tunnels, advance } = harness(publish);
  try {
    gateways[0].emit('message', { type: 'ready' });
    tunnels[0].stderr.write('https://first-session.trycloudflare.com\n');
    let phone = JSON.parse(await readFile(path.join(output, 'iphone-link.json'), 'utf8'));
    assert.equal(phone.url, 'https://first-session.trycloudflare.com/ru/');
    tunnels[0].exit(1);
    phone = JSON.parse(await readFile(path.join(output, 'iphone-link.json'), 'utf8'));
    assert.equal(phone.publicUrl, null, 'a dead tunnel must not remain advertised as current');
    advance();
    tunnels[1].stdout.write('https://second-session.trycloudflare.com\n');
    phone = JSON.parse(await readFile(path.join(output, 'iphone-link.json'), 'utf8'));
    assert.equal(phone.url, 'https://second-session.trycloudflare.com/ru/');
    assert.equal(gateways.length, 1);
    assert.deepEqual(gateways[0].messages.at(-1), { type: 'public-url', publicUrl: phone.publicUrl });
    const state = JSON.parse(await readFile(path.join(output, 'remote-state.json'), 'utf8'));
    assert.equal(state.pid, gateways[0].pid);
    assert.equal(state.childPid, tunnels[1].pid);
  } finally {
    await controller.stop('test');
    await rm(output, { recursive: true, force: true });
  }
});

test('supervisor stop is idempotent and waits for both owned processes', async () => {
  const { controller, gateways, tunnels } = harness();
  gateways[0].emit('message', { type: 'ready' });
  let completed = false;
  void controller.done.then(() => { completed = true; });
  const stopped = controller.stop('test');
  assert.equal(controller.stop('again'), stopped);
  assert.equal(completed, false);
  assert.equal(gateways[0].killCount, 1);
  assert.equal(tunnels[0].killCount, 1);
  assert.equal(await stopped, 23);
  assert.equal(completed, true);
});

test('gateway child stdout and stderr are captured and the IPC supervised flag is explicit', async () => {
  const output = await mkdtemp(path.join(tmpdir(), 'nika-supervisor-logs-'));
  const child = { pid: 123 };
  try {
    const spawned = spawnLoggedGateway({
      root: output, output,
      spawnChild: (executable, args, options) => {
        assert.equal(executable, process.execPath);
        assert.equal(args[0], path.join(output, 'tools', 'dev-remote-preview.mjs'));
        assert.equal(options.env.PREVIEW_REMOTE_SUPERVISED, '1');
        assert.equal(options.stdio[3], 'ipc');
        assert.equal(options.windowsHide, true);
        writeSync(options.stdio[1], 'fixture stdout\n');
        writeSync(options.stdio[2], 'fixture fatal stack\n');
        return child;
      },
    });
    assert.equal(spawned, child);
    assert.equal(await readFile(path.join(output, 'remote-runtime.stdout.log'), 'utf8'), 'fixture stdout\n');
    assert.equal(await readFile(path.join(output, 'remote-runtime.stderr.log'), 'utf8'), 'fixture fatal stack\n');
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test('public readiness accepts only the fixed HTTPS host shape and sends no credentials or redirects', async () => {
  let calls = 0;
  const fetchImpl = async (url, options) => {
    calls += 1;
    assert.equal(url, 'https://safe-preview.trycloudflare.com/__preview_health');
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.cache, 'no-store');
    assert.deepEqual(options.headers, { Accept: 'application/json' });
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ project: 'HUNDESALON_NIKA', role: 'remote-preview', pid: 123 });
  };
  assert.equal(await verifyPublicPreview('https://safe-preview.trycloudflare.com', { expectedPid: 123, fetchImpl }), true);
  assert.equal(await verifyPublicPreview('https://safe-preview.trycloudflare.com', { fetchImpl }), true);
  for (const url of [
    null, undefined, 123, 'http://safe-preview.trycloudflare.com',
    'https://safe-preview.trycloudflare.com.evil.example', 'https://safe-preview.trycloudflare.com/',
    'https://safe-preview.trycloudflare.com:443', 'https://safe-preview.trycloudflare.com?key=secret',
    'https://safe-preview.trycloudflare.com#fragment', 'https://user:secret@safe-preview.trycloudflare.com',
    'https://127.0.0.1', ' https://safe-preview.trycloudflare.com',
  ]) assert.equal(await verifyPublicPreview(url, { fetchImpl }), false);
  assert.equal(calls, 2, 'invalid URLs must never reach fetch');
});

test('public readiness rejects foreign responses, stale gateway PIDs, transport errors and oversized bodies', async () => {
  const url = 'https://safe-preview.trycloudflare.com';
  const check = response => verifyPublicPreview(url, { expectedPid: 123, fetchImpl: async () => response });
  for (const health of [
    { project: 'OTHER', role: 'remote-preview', pid: 123 },
    { project: 'HUNDESALON_NIKA', role: 'other', pid: 123 },
    { project: 'HUNDESALON_NIKA', role: 'remote-preview', pid: 456 },
    { project: 'HUNDESALON_NIKA', role: 'remote-preview', pid: '123' },
  ]) assert.equal(await check(Response.json(health)), false);
  assert.equal(await check(new Response('Cloudflare error', { status: 530 })), false);
  assert.equal(await check(new Response('not JSON')), false);
  assert.equal(await check(new Response('{}', { headers: { 'Content-Length': '8193' } })), false);
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(8193)); },
    cancel() { cancelled = true; },
  });
  assert.equal(await check(new Response(body)), false);
  assert.equal(cancelled, true, 'oversized streaming bodies are cancelled without unbounded buffering');
  for (const message of ['ENOTFOUND', 'fetch failed', 'unexpected redirect']) {
    assert.equal(await verifyPublicPreview(url, {
      fetchImpl: async () => { throw new TypeError(message); },
    }), false);
  }
});

test('public readiness propagates caller cancellation and skips an already aborted probe', async () => {
  const controller = new AbortController();
  let receivedSignal;
  const pending = verifyPublicPreview('https://safe-preview.trycloudflare.com', {
    signal: controller.signal,
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
      receivedSignal = options.signal;
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
    }),
  });
  controller.abort();
  assert.equal(await pending, false);
  assert.equal(receivedSignal.aborted, true);
  assert.equal(await verifyPublicPreview('https://safe-preview.trycloudflare.com', {
    signal: controller.signal,
    fetchImpl: async () => { assert.fail('cancelled probes cannot start another request'); },
  }), false);
});

test('an explicitly allowed named origin is exact and does not permit other destinations', async () => {
  let calls = 0;
  const origin = 'https://preview.hundesalon-nika.com';
  const fetchImpl = async url => {
    calls += 1;
    assert.equal(url, `${origin}/__preview_health`);
    return Response.json({ project: 'HUNDESALON_NIKA', role: 'remote-preview', pid: 123 });
  };
  assert.equal(await verifyPublicPreview(origin, { fetchImpl }), false, 'named origins require explicit trust');
  assert.equal(await verifyPublicPreview(origin, { allowedOrigin: origin, expectedPid: 123, fetchImpl }), true);
  for (const destination of [
    'https://hundesalon-nika.com', 'https://preview.hundesalon-nika.com.evil.example',
    'https://preview.hundesalon-nika.com/', 'https://other.trycloudflare.com',
  ]) assert.equal(await verifyPublicPreview(destination, { allowedOrigin: origin, fetchImpl }), false);
  for (const allowedOrigin of ['', null, `${origin}/`, `${origin}?key=secret`, 'http://preview.hundesalon-nika.com']) {
    assert.equal(await verifyPublicPreview(allowedOrigin || 'https://other.trycloudflare.com', {
      allowedOrigin, fetchImpl,
    }), false);
  }
  assert.equal(calls, 1, 'a trusted origin is not a wildcard or a redirect permission');
});

test('a named tunnel probes its configured origin without waiting for a Quick Tunnel hostname', async () => {
  const origin = 'https://preview.hundesalon-nika.com';
  const probes = deferredProbes();
  const { controller, gateways, tunnels } = harness(() => {}, { ...probes, publicOrigin: origin });
  try {
    gateways[0].emit('message', { type: 'ready' });
    assert.equal(tunnels.length, 1);
    assert.equal(probes.requests.length, 1, 'the first named probe is not started twice by gateway readiness');
    assert.equal(probes.requests[0].url, origin);
    assert.equal(controller.state().publicUrl, null);
    tunnels[0].stdout.write('diagnostic https://unrelated.trycloudflare.com\n');
    assert.equal(probes.requests.length, 1, 'stdout cannot replace the trusted named origin');
    probes.requests[0].resolve(true);
    await flush();
    assert.equal(controller.state().publicUrl, origin);
  } finally {
    await controller.stop('test');
  }
  assert.throws(() => harness(() => {}, { publicOrigin: `${origin}/path` }), /Invalid explicitly allowed/);
});

test('a candidate URL is published only after a successful external probe and checked again every minute', async () => {
  const probes = deferredProbes();
  const { controller, gateways, tunnels, advance } = harness(() => {}, probes);
  try {
    gateways[0].emit('message', { type: 'ready' });
    tunnels[0].stdout.write('https://ready-preview.trycloudflare.com\n');
    assert.equal(controller.state().publicUrl, null);
    assert.equal(probes.requests[0].expectedPid, gateways[0].pid);
    probes.requests[0].resolve(true);
    await flush();
    assert.equal(controller.state().publicUrl, 'https://ready-preview.trycloudflare.com');
    assert.equal(advance(), 60000);
    assert.equal(probes.requests.length, 2);
    probes.requests[1].resolve(true);
    await flush();
    assert.equal(tunnels[0].killCount, 0);
  } finally {
    await controller.stop('test');
  }
});

test('initial DNS failures have a bounded grace period and a fresh tunnel can recover', async () => {
  let healthy = false;
  const { controller, gateways, tunnels, advance, events } = harness(() => {}, {
    probePublicUrl: async () => healthy,
  });
  try {
    gateways[0].emit('message', { type: 'ready' });
    tunnels[0].stdout.write('https://unresolved-preview.trycloudflare.com\n');
    await flush();
    assert.equal(controller.state().publicUrl, null);
    for (let retry = 0; retry < 30; retry++) {
      assert.equal(advance(), 2000);
      await flush();
    }
    assert.equal(tunnels[0].killCount, 1);
    assert.equal(events.filter(event => event.event === 'tunnel-unhealthy').length, 1);
    assert.equal(controller.state().publicUrl, null);
    healthy = true;
    assert.equal(advance(), 3000);
    tunnels[1].stdout.write('https://recovered-preview.trycloudflare.com\n');
    await flush();
    assert.equal(controller.state().publicUrl, 'https://recovered-preview.trycloudflare.com');
    assert.equal(gateways.length, 1, 'a broken public route does not restart the working gateway');
  } finally {
    await controller.stop('test');
  }
});

test('three consecutive failed checks retire a live tunnel, while a passing check resets the counter', async () => {
  let healthy = true;
  const { controller, gateways, tunnels, advance } = harness(() => {}, {
    probePublicUrl: async () => healthy,
  });
  try {
    gateways[0].emit('message', { type: 'ready' });
    tunnels[0].stdout.write('https://once-live.trycloudflare.com\n');
    await flush();
    healthy = false;
    for (let count = 0; count < 2; count++) { advance(); await flush(); }
    assert.equal(tunnels[0].killCount, 0);
    healthy = true;
    advance(); await flush();
    healthy = false;
    for (let count = 0; count < 2; count++) { advance(); await flush(); }
    assert.equal(tunnels[0].killCount, 0, 'the successful check resets consecutive failures');
    assert.equal(controller.state().publicUrl, 'https://once-live.trycloudflare.com');
    advance(); await flush();
    assert.equal(tunnels[0].killCount, 1);
    assert.equal(controller.state().publicUrl, null, 'a failed live public route cannot remain advertised');
  } finally {
    await controller.stop('test');
  }
});

test('split terminal tunnel errors immediately clear the URL, kill once and ignore subsequent garbage', async () => {
  const { controller, gateways, tunnels, advance, events } = harness(() => {}, {
    probePublicUrl: async () => true,
  });
  try {
    gateways[0].emit('message', { type: 'ready' });
    tunnels[0].stdout.write('https://expired-preview.trycloudflare.com\n');
    await flush();
    tunnels[0].stderr.write('connection failed: Unauth');
    tunnels[0].stdout.write('orized: Tunnel not ');
    assert.equal(tunnels[0].killCount, 0);
    tunnels[0].stderr.write('found\n');
    assert.equal(controller.state().publicUrl, null);
    assert.equal(tunnels[0].killCount, 1);
    tunnels[0].stdout.write('https://garbage-preview.trycloudflare.com\nUnauthorized: Tunnel not found\n');
    assert.equal(controller.state().publicUrl, null);
    assert.equal(tunnels[0].killCount, 1);
    await flush();
    assert.equal(events.filter(event => event.event === 'tunnel-unhealthy' && event.reason === 'tunnel-not-found').length, 1);
    advance();
    tunnels[1].stdout.write('https://fresh-preview.trycloudflare.com\n');
    await flush();
    assert.equal(controller.state().publicUrl, 'https://fresh-preview.trycloudflare.com');
  } finally {
    await controller.stop('test');
  }
});

test('a result from a replaced tunnel cannot publish a stale URL or retire the new tunnel', async () => {
  const probes = deferredProbes();
  const { controller, gateways, tunnels, advance } = harness(() => {}, probes);
  try {
    gateways[0].emit('message', { type: 'ready' });
    tunnels[0].stdout.write('https://obsolete-preview.trycloudflare.com\n');
    tunnels[0].exit(1);
    assert.equal(probes.requests[0].signal.aborted, true);
    advance();
    tunnels[1].stdout.write('https://current-preview.trycloudflare.com\n');
    probes.requests[0].resolve(true);
    await flush();
    assert.equal(controller.state().publicUrl, null);
    probes.requests[1].resolve(true);
    await flush();
    assert.equal(controller.state().publicUrl, 'https://current-preview.trycloudflare.com');
    assert.equal(tunnels[1].killCount, 0);
  } finally {
    await controller.stop('test');
  }
});

test('gateway recovery revalidates the same tunnel against the new PID and ignores the old in-flight check', async () => {
  const probes = deferredProbes();
  const { controller, gateways, tunnels, advance } = harness(() => {}, probes);
  try {
    gateways[0].emit('message', { type: 'ready' });
    tunnels[0].stdout.write('https://same-preview.trycloudflare.com\n');
    probes.requests[0].resolve(true);
    await flush();
    advance();
    gateways[0].exit(1);
    assert.equal(probes.requests[1].signal.aborted, true);
    assert.equal(controller.state().publicUrl, 'https://same-preview.trycloudflare.com');
    advance();
    gateways[1].emit('message', { type: 'ready' });
    assert.equal(probes.requests[2].expectedPid, gateways[1].pid);
    probes.requests[1].resolve(false);
    await flush();
    assert.equal(tunnels[0].killCount, 0);
    probes.requests[2].resolve(true);
    await flush();
    assert.equal(tunnels.length, 1);
    assert.equal(controller.state().publicUrl, 'https://same-preview.trycloudflare.com');
  } finally {
    await controller.stop('test');
  }
});

test('stop cancels an in-flight probe and prevents late publication or restart', async () => {
  const probes = deferredProbes();
  const { controller, gateways, tunnels, advance } = harness(() => {}, probes);
  gateways[0].emit('message', { type: 'ready' });
  tunnels[0].stdout.write('https://stopping-preview.trycloudflare.com\n');
  const stopped = controller.stop('test');
  assert.equal(probes.requests[0].signal.aborted, true);
  probes.requests[0].resolve(true);
  assert.equal(await stopped, 23);
  await flush();
  assert.equal(controller.state().publicUrl, null);
  assert.throws(advance, /No pending restart/);
  assert.equal(tunnels.length, 1);
  assert.equal(tunnels[0].killCount, 1);
});
