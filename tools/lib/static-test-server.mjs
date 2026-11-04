import { createReadStream } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

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
  '.mp4': 'video/mp4',
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

export function isPublicPath(relative) {
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

function resolveByteRange(value, length) {
  const match = typeof value === 'string' && /^bytes=(\d*)-(\d*)$/i.exec(value.trim());
  // Ignore unsupported, malformed and multipart ranges; return the full representation.
  if (!match || (!match[1] && !match[2])) return null;
  const size = BigInt(length);
  if (size === 0n) return { unsatisfiable: true };
  if (!match[1]) {
    const suffix = BigInt(match[2]);
    if (suffix === 0n) return { unsatisfiable: true };
    return { start: Number(suffix >= size ? 0n : size - suffix), end: length - 1 };
  }
  const start = BigInt(match[1]);
  const end = match[2] ? BigInt(match[2]) : size - 1n;
  if (match[2] && end < start) return null;
  if (start >= size) return { unsatisfiable: true };
  return { start: Number(start), end: Number(end >= size ? size - 1n : end) };
}

export async function startStaticTestServer(root = process.cwd(), { port = 0, weatherModuleDirectory } = {}) {
  const resolvedRoot = await realpath(root);
  const weatherModules = new Map();
  let weatherModuleRoot;
  if (weatherModuleDirectory) {
    weatherModuleRoot = await realpath(path.resolve(resolvedRoot, weatherModuleDirectory));
    const relative = path.relative(resolvedRoot, weatherModuleRoot);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Weather preview modules must remain inside the site workspace.');
    }
    const weatherDirectory = path.join(resolvedRoot, '3d-weather-codrops-main');
    const manifest = JSON.parse(await readFile(path.join(weatherDirectory, 'build-manifest.json'), 'utf8'));
    for (const { output } of manifest.entries) {
      if (path.basename(output) !== output || !/\.(?:mjs|js)$/.test(output)) {
        throw new Error('Invalid weather module output.');
      }
      for (const filename of [output, `${output}.map`]) {
        weatherModules.set(path.join(weatherDirectory, 'dist-widget', filename), path.join(weatherModuleRoot, filename));
      }
    }
  }
  const server = createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(501, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' }).end('Use the Cloudflare Functions preview for form submissions');
      return;
    }
    let filePath;
    try {
      filePath = resolveRequestPath(resolvedRoot, request.url);
    } catch {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Bad request');
      return;
    }
    if (!filePath) {
      response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Forbidden');
      return;
    }

    const weatherModulePath = weatherModules.get(filePath);
    if (weatherModulePath) filePath = weatherModulePath;

    try {
      const actualPath = await realpath(filePath);
      const actualRelative = path.relative(resolvedRoot, actualPath);
      const allowedPath = weatherModulePath
        ? path.relative(weatherModuleRoot, actualPath) === path.basename(weatherModulePath)
        : isPublicPath(actualRelative);
      if (actualRelative.startsWith('..') || path.isAbsolute(actualRelative) || !allowedPath) {
        response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Forbidden');
        return;
      }
      const metadata = await stat(filePath);
      if (!metadata.isFile()) throw new Error('Not a file');
      const lastModified = metadata.mtime.toUTCString();
      const ifRange = request.headers['if-range'];
      // If-Range dates must match Last-Modified exactly, including its one-second precision.
      const matchesIfRange = ifRange === undefined || (
        typeof ifRange === 'string' && !/^(?:W\/)?"/i.test(ifRange.trim()) &&
        Date.parse(ifRange) === Date.parse(lastModified)
      );
      const range = matchesIfRange ? resolveByteRange(request.headers.range, metadata.size) : null;
      const headers = {
        'Cache-Control': 'no-store',
        'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Accept-Ranges': 'bytes',
        'Last-Modified': lastModified,
        'Content-Length': range?.unsatisfiable ? 0 : range ? range.end - range.start + 1 : metadata.size,
      };
      if (range?.unsatisfiable) {
        response.writeHead(416, { ...headers, 'Content-Range': `bytes */${metadata.size}` }).end();
        return;
      }
      if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${metadata.size}`;
      response.writeHead(range ? 206 : 200, headers);
      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      // A canceled video request must close its file descriptor as well as the socket.
      await pipeline(createReadStream(filePath, range ? { start: range.start, end: range.end } : undefined), response);
    } catch {
      if (response.headersSent || response.destroyed) response.destroy();
      else response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
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
