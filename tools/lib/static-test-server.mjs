import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const PUBLIC_DIRECTORIES = new Set(['assets', 'config', 'data', 'de', 'en', 'ru', 'uk', '.well-known']);
const PUBLIC_ROOT_FILES = new Set([
  'index.html',
  '404.html',
  'reviews.html',
  'telegram-menu.html',
  'robots.txt',
  'llms.txt',
  'sitemap.xml',
  'sitemap-brand.xml',
  'indexnow-key.txt',
  'BingSiteAuth.xml',
  'favicon.ico',
  'site.webmanifest',
  'browserconfig.xml',
  'sw.js',
  'sp-push-worker-fb.js',
]);

function isPublicPath(relative) {
  const parts = relative.split(path.sep);
  if (/\.(?:token|pem|key|sqlite|db|pfx|p12|env)$/i.test(relative)) return false;
  if (parts.some((part, index) => part.startsWith('.') && !(index === 0 && part === '.well-known'))) return false;
  if (parts[0] === '3d-weather-codrops-main') return parts[1] === 'dist-widget';
  if (parts.length === 1) return PUBLIC_ROOT_FILES.has(relative) || /^[A-F0-9]{32}\.txt$/i.test(relative);
  return PUBLIC_DIRECTORIES.has(parts[0]);
}

function resolveRequestPath(root, requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl || '/', 'http://127.0.0.1').pathname);
  const requested = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
  const filePath = path.resolve(root, `.${requested}`);
  const relative = path.relative(root, filePath);
  return relative.startsWith('..') || path.isAbsolute(relative) || !isPublicPath(relative) ? null : filePath;
}

export async function startStaticTestServer(root = process.cwd(), { port = 0 } = {}) {
  const resolvedRoot = await realpath(root);
  const server = createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(501, { Allow: 'GET, HEAD' }).end('Use the Cloudflare Functions preview for form submissions');
      return;
    }
    let filePath;
    try {
      filePath = resolveRequestPath(resolvedRoot, request.url);
    } catch {
      response.writeHead(400).end('Bad request');
      return;
    }
    if (!filePath) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    try {
      const actualPath = await realpath(filePath);
      const actualRelative = path.relative(resolvedRoot, actualPath);
      if (actualRelative.startsWith('..') || path.isAbsolute(actualRelative) || !isPublicPath(actualRelative)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const metadata = await stat(filePath);
      if (!metadata.isFile()) throw new Error('Not a file');
      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      });
      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      createReadStream(filePath)
        .on('error', () => response.destroy())
        .pipe(response);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Static test server has no TCP address.');

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve()))),
  };
}
