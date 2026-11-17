import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { startStaticTestServer } from './lib/static-test-server.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const weatherModuleDirectory = path.join(root, 'output', 'weather-local');
// Reuse the existing salon share map in the static preview without a billable API key.
const mapsEmbedUrl = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2493.491485011471!2d12.416506!3d51.320479299999995!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47a6f85543c58611%3A0xaa62bd667105c0d7!2su.%20Eichst%C3%A4dtstra%C3%9Fe%2038%2C%2004299%20Leipzig!5e0!3m2!1sru!2sde!4v1793991952673!5m2!1sru!2sde";
execFileSync(process.execPath, [
  path.join(root, '3d-weather-codrops-main', 'scripts', 'build.mjs'), '--out-dir', weatherModuleDirectory,
], { cwd: root, stdio: 'inherit' });
const server = await startStaticTestServer(root, { port: 5502, weatherModuleDirectory, mapsEmbedUrl });
console.log(`Website preview: ${server.baseUrl} (public files only; use dev:cf for Functions)`);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () =>
    server.close().catch(() => {
      process.exitCode = 1;
    })
  );
}
