import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { startStaticTestServer } from './lib/static-test-server.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const weatherModuleDirectory = path.join(root, 'output', 'weather-local');
execFileSync(process.execPath, [
  path.join(root, '3d-weather-codrops-main', 'scripts', 'build.mjs'), '--out-dir', weatherModuleDirectory,
], { cwd: root, stdio: 'inherit' });
const server = await startStaticTestServer(root, { port: 5502, weatherModuleDirectory });
console.log(`Website preview: ${server.baseUrl} (public files only; use dev:cf for Functions)`);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () =>
    server.close().catch(() => {
      process.exitCode = 1;
    })
  );
}
