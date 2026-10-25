import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { isDeepStrictEqual } from 'node:util';

const child = spawn(
  process.platform === 'win32' ? 'codex app-server --stdio' : 'codex',
  process.platform === 'win32' ? [] : ['app-server', '--stdio'],
  {
    shell: process.platform === 'win32',
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'ignore'],
  }
);
const pending = new Map();
let nextId = 1;
const lines = createInterface({ input: child.stdout });
lines.on('line', line => {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  clearTimeout(request.timer);
  if (message.error) request.reject(new Error(`Codex settings request failed (${message.error.code}).`));
  else request.resolve(message.result);
});
child.on('error', () => {
  for (const request of pending.values()) {
    clearTimeout(request.timer);
    request.reject(new Error('Codex App Server could not start.'));
  }
  pending.clear();
});

function request(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Codex settings request timed out.'));
    }, 30000);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
  });
}

try {
  await request('initialize', {
    clientInfo: { name: 'hundesalon-hook-check', version: '1.0.0' },
    capabilities: { experimentalApi: true },
  });
  child.stdin.write(`${JSON.stringify({ method: 'initialized', params: {} })}\n`);
  const before = await request('config/read', { includeLayers: false, cwd: process.cwd() });
  if (process.argv.includes('--disable-gitkraken')) {
    await request('config/value/write', {
      keyPath: 'plugins."gitkraken-hooks@gitkraken".enabled',
      value: false,
      mergeStrategy: 'replace',
    });
  }
  const after = await request('config/read', { includeLayers: false, cwd: process.cwd() });
  const untouched = config => ({ hooks: config.hooks, mcp: config.mcp_servers, features: config.features });
  const globalAfter = await request('config/read', { includeLayers: false, cwd: process.cwd() });
  const enabled = globalAfter.config.plugins?.['gitkraken-hooks@gitkraken']?.enabled;
  console.log(
    JSON.stringify(
      {
        gitkrakenEnabled: enabled,
        projectGitkrakenEnabled: after.config.plugins?.['gitkraken-hooks@gitkraken']?.enabled,
        hookAndMcpSettingsPreserved: isDeepStrictEqual(untouched(before.config), untouched(globalAfter.config)),
      },
      null,
      2
    )
  );
  if (
    process.argv.includes('--disable-gitkraken') &&
    (enabled !== false || !isDeepStrictEqual(untouched(before.config), untouched(globalAfter.config)))
  ) {
    throw new Error('GitKraken setting or preservation check failed.');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  child.stdin.end();
  lines.close();
  child.stdout.destroy();
}
