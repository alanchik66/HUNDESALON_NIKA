import { fileURLToPath } from 'node:url';
import { startStaticTestServer } from './lib/static-test-server.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = await startStaticTestServer(root, { port: 5502 });
console.log(`Website preview: ${server.baseUrl} (public files only; use dev:cf for Functions)`);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () =>
    server.close().catch(() => {
      process.exitCode = 1;
    })
  );
}
