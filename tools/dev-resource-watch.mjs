import { watch, createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = 5512;
const project = 'HUNDESALON_NIKA';
const endpoint = `http://127.0.0.1:${port}/changes`;
const probe = async () => {
  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(1500) });
    return response.ok ? await response.json() : null;
  } catch { return null; }
};

if (process.argv.includes('--detach')) {
  const existing = await probe();
  if (existing?.project === project) {
    console.log('Local resource watcher already running; existing sessions preserved.');
  } else {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], {
      cwd: root, detached: true, windowsHide: true, stdio: 'ignore',
    });
    child.unref();
    let ready = false;
    for (let attempt = 0; attempt < 20 && !ready; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 150));
      ready = (await probe())?.project === project;
    }
    if (!ready) throw new Error(`Cannot start resource watcher on ${port}; no existing process was stopped.`);
    console.log(`Local resource watcher ready on ${endpoint}`);
  }
} else {
  const boot = randomUUID();
  const changes = new Map();
  const timers = new Map();
  const watchers = [];
  const publish = async relative => {
    const filename = path.resolve(root, relative);
    if (path.relative(root, filename).startsWith('..')) return;
    try {
      const metadata = await stat(filename);
      if (!metadata.isFile()) return;
      const hash = createHash('sha256');
      for await (const chunk of createReadStream(filename)) hash.update(chunk);
      const revision = hash.digest('hex');
      if (changes.get(relative)?.revision === revision) return;
      changes.set(relative, { path: `/${relative}`, revision, at: Date.now() });
    } catch (error) {
      if (error.code === 'ENOENT') changes.set(relative, { path: `/${relative}`, revision: 'deleted', at: Date.now() });
    }
  };
  const schedule = relative => {
    clearTimeout(timers.get(relative));
    timers.set(relative, setTimeout(() => {
      timers.delete(relative);
      void publish(relative);
    }, 250));
  };
  // Watch public source trees only: no .git, dependencies, secrets or task artifacts.
  for (const directory of ['', 'assets', 'data', 'de', 'en', 'ru', 'uk', '3d-weather-codrops-main/dist-widget']) {
    const watcher = watch(path.join(root, directory), { recursive: Boolean(directory) }, (_event, filename) => {
      if (!filename) return;
      const relative = path.posix.join(directory, String(filename).replaceAll('\\', '/'));
      if (!directory && !/\.(?:html|css|js|json|svg|png|webp|ico|webmanifest)$/i.test(relative)) return;
      schedule(relative);
    });
    watcher.on('error', error => console.error(`Resource watcher: ${error.message}`));
    watchers.push(watcher);
  }
  const server = createServer((request, response) => {
    const origin = request.headers.origin;
    if (origin) {
      let allowed = false;
      try { allowed = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname); } catch {}
      if (!allowed) { response.writeHead(403).end(); return; }
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
    }
    if (request.method !== 'GET' || request.url !== '/changes') { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ project, boot, changes: [...changes.values()] }));
  });
  server.on('error', error => {
    watchers.forEach(watcher => watcher.close());
    console.error(`Resource watcher could not bind ${port}: ${error.message}. Existing processes preserved.`);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1');
}
