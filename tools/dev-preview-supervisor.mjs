import { spawn } from 'node:child_process';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'output/local-preview');
const project = 'HUNDESALON_NIKA';
const services = [
  { name: 'website', script: 'dev-static-server.mjs', url: 'http://127.0.0.1:5502/ru/prays-list.html' },
  { name: 'resources', script: 'dev-resource-watch.mjs', url: 'http://127.0.0.1:5512/changes' },
].map(service => ({ ...service, child: null, healthy: false, failures: 0 }));
await mkdir(output, { recursive: true });
const log = message => appendFile(path.join(output, 'supervisor.log'), `${new Date().toISOString()} ${message}\n`);
const snapshot = () => ({
  project,
  root,
  supervisorPid: process.pid,
  parentPid: process.ppid,
  updatedAt: new Date().toISOString(),
  services: services.map(({ name, child, healthy, url }) => ({ name, pid: child?.pid || null, healthy, url })),
});
const save = () => writeFile(path.join(output, 'state.json'), JSON.stringify(snapshot(), null, 2));
let stopping = false;

async function probe(service) {
  try {
    const response = await fetch(service.url, { signal: AbortSignal.timeout(2000) });
    if (!response.ok) return false;
    return service.name === 'resources'
      ? (await response.json()).project === project
      : /HUNDESALON[\s_-]*NIKA/i.test(await response.text());
  } catch {
    return false;
  }
}

function start(service) {
  const child = spawn(process.execPath, [path.join(root, 'tools', service.script)], {
    cwd: root,
    windowsHide: true,
    stdio: 'ignore',
  });
  service.child = child;
  service.failures = 0;
  void log(`Started ${service.name}, PID ${child.pid}`).catch(() => {});
  child.once('error', error => {
    if (service.child === child) service.child = null;
    void log(`${service.name}: ${error.message}`).catch(() => {});
  });
  child.once('exit', (code, signal) => {
    if (service.child === child) service.child = null;
    service.healthy = false;
    void log(`${service.name} exited (${code ?? signal}); retry on next check`).catch(() => {});
  });
}

async function check() {
  await Promise.all(
    services.map(async service => {
      service.healthy = await probe(service);
      if (stopping) return;
      if (service.healthy) {
        service.failures = 0;
        return;
      }
      if (!service.child) start(service);
      else if (++service.failures >= 5) {
        // Only restart a child launched by this supervisor; preserve other processes.
        void log(`Restarting unresponsive ${service.name}, PID ${service.child.pid}`).catch(() => {});
        service.child.kill();
        service.failures = 0;
      }
    })
  );
  await save();
}

const control = createServer((request, response) => {
  if (request.method !== 'GET' || request.url !== '/status') {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(snapshot()));
});
try {
  await new Promise((resolve, reject) => {
    control.once('error', reject);
    control.listen(5513, '127.0.0.1', resolve);
  });
} catch (error) {
  if (error.code === 'EADDRINUSE') {
    const response = await fetch('http://127.0.0.1:5513/status', { signal: AbortSignal.timeout(2000) }).catch(
      () => null
    );
    const existing = response?.ok ? await response.json().catch(() => null) : null;
    if (existing?.project === project && existing.root === root) process.exit(23);
  }
  throw error;
}
await log(`Supervisor started, PID ${process.pid}`);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    stopping = true;
    for (const service of services) service.child?.kill();
    control.close();
  });
while (!stopping) {
  await check();
  await new Promise(resolve => setTimeout(resolve, 3000));
}
