import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { superviseRemotePreview, spawnLoggedGateway, createPreviewStateWriter } from './lib/remote-preview-supervisor.mjs';

function harness(publish = () => {}) {
  let nextPid = 100;
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
    setTimer: callback => { const timer = { callback, cancelled: false }; timers.push(timer); return timer; },
    clearTimer: timer => { if (timer) timer.cancelled = true; },
  });
  const advance = () => {
    while (timers.length) {
      const timer = timers.shift();
      if (!timer.cancelled) { timer.callback(); return; }
    }
    assert.fail('No pending restart');
  };
  return { controller, gateways, tunnels, events, states, advance };
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
