import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

export const PRODUCTION_ORIGIN = 'https://hundesalon-nika.com';
export const RELEASE_LOCALES = ['de', 'en', 'ru', 'uk'];
export const RELEASE_MANIFEST_PATH = '/config/release-manifest.json';
const STAMP_PATH = '/config/deploy-asset-version.txt';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function origin(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Use an HTTP(S) origin without credentials, path, query or fragment.');
  }
  return url.origin;
}

function publicPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) throw new Error('Invalid release asset path.');
  const url = new URL(value, PRODUCTION_ORIGIN);
  if (url.origin !== PRODUCTION_ORIGIN || url.hash || url.pathname + url.search !== value) throw new Error('Invalid release asset path.');
  return value;
}

function artifactFile(directory, requestPath) {
  const root = realpathSync(directory);
  const target = realpathSync(path.resolve(root, `.${decodeURIComponent(new URL(publicPath(requestPath), PRODUCTION_ORIGIN).pathname)}`));
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !lstatSync(target).isFile()) {
    throw new Error('Release file escapes the production directory.');
  }
  return target;
}

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gu)]
    .map(match => [match[1].toLowerCase(), (match[2] ?? match[3] ?? match[4]).replace(/&(?:amp|#38|#x26);/giu, '&')]));
}

export function inspectLocaleHtml(html, { locale, baseUrl, canonicalOrigin = PRODUCTION_ORIGIN }) {
  const pageUrl = new URL(`/${locale}/`, origin(baseUrl));
  const htmlAttributes = attributes(html.match(/<html\b[^>]*>/iu)?.[0] || '');
  if (htmlAttributes.lang !== locale) throw new Error(`${locale}: incorrect or missing html lang.`);
  const links = [...html.matchAll(/<link\b[^>]*>/giu)].map(match => attributes(match[0]));
  const canonicals = links.filter(link => link.rel?.toLowerCase() === 'canonical');
  const expectedCanonical = new URL(`/${locale}/`, origin(canonicalOrigin)).href;
  if (canonicals.length !== 1 || new URL(canonicals[0].href || '', pageUrl).href !== expectedCanonical) {
    throw new Error(`${locale}: incorrect or missing canonical.`);
  }
  if (!links.some(link => /(?:^|\s)icon(?:\s|$)/iu.test(link.rel || '') && link.href)) throw new Error(`${locale}: missing favicon.`);
  const sources = [
    ...[...html.matchAll(/<script\b[^>]*>/giu)].map(match => attributes(match[0]).src),
    ...links.filter(link => link.rel?.toLowerCase() === 'stylesheet').map(link => link.href),
  ];
  const assets = [...new Set(sources.filter(Boolean).flatMap(source => {
    const url = new URL(source, pageUrl);
    return url.origin === pageUrl.origin && /\.(?:css|m?js)$/iu.test(url.pathname) ? [publicPath(url.pathname + url.search)] : [];
  }))].sort();
  if (!assets.some(asset => /\.css(?:\?|$)/iu.test(asset)) || !assets.some(asset => /\.m?js(?:\?|$)/iu.test(asset))) {
    throw new Error(`${locale}: missing local stylesheet or script.`);
  }
  return { locale, path: pageUrl.pathname, assets };
}

export function validateReleaseManifest(manifest, { commit, stamp, canonicalOrigin = PRODUCTION_ORIGIN } = {}) {
  if (manifest?.schema !== 1 || !/^[a-f0-9]{40}$/u.test(manifest.commit || '') || (commit && manifest.commit !== commit)) {
    throw new Error('Release manifest does not match the full expected commit.');
  }
  const stampCommit = manifest.stamp?.match(/^\d{8}-prod-([a-f0-9]{7,40})-[a-f0-9]{8}$/u)?.[1];
  if (!stampCommit || !manifest.commit.startsWith(stampCommit) || (stamp && manifest.stamp !== stamp)) throw new Error('Release asset stamp mismatch.');
  if (origin(manifest.canonicalOrigin) !== origin(canonicalOrigin)) throw new Error('Release canonical origin mismatch.');
  if (!Array.isArray(manifest.locales) || manifest.locales.length !== RELEASE_LOCALES.length ||
      !Array.isArray(manifest.assets) || manifest.assets.length < 2 || manifest.assets.length > 512) throw new Error('Invalid release manifest coverage.');
  const paths = new Set();
  for (const asset of manifest.assets) {
    publicPath(asset.path);
    if (!/\.(?:css|m?js)$/iu.test(new URL(asset.path, PRODUCTION_ORIGIN).pathname) ||
        !/^[a-f0-9]{64}$/u.test(asset.sha256 || '') || paths.has(asset.path)) throw new Error('Invalid release asset digest.');
    paths.add(asset.path);
  }
  for (const locale of RELEASE_LOCALES) {
    const entry = manifest.locales.find(item => item.locale === locale);
    if (!entry || entry.path !== `/${locale}/` || !Array.isArray(entry.assets) || !entry.assets.length || entry.assets.some(asset => !paths.has(asset))) {
      throw new Error(`Release manifest is missing ${locale} assets.`);
    }
    // Match build-production.js: authored CSS/JS get the release stamp; vendor CSS keeps its pinned version.
    // Both groups remain covered by the manifest digest and public-byte checks.
    if (entry.assets.some(asset => {
      const url = new URL(asset, PRODUCTION_ORIGIN);
      return /^\/assets\/(?:css|js)\//u.test(url.pathname) && url.searchParams.get('v') !== manifest.stamp;
    })) {
      throw new Error(`${locale}: release asset references do not use the expected stamp.`);
    }
  }
  return manifest;
}

export function prepareProductionRelease({ directory, commit, canonicalOrigin = PRODUCTION_ORIGIN, extraAssets = [] }) {
  if (!/^[a-f0-9]{40}$/u.test(commit || '')) throw new Error('Pass the full reviewed commit SHA.');
  const stamp = readFileSync(artifactFile(directory, STAMP_PATH), 'utf8').trim();
  const locales = RELEASE_LOCALES.map(locale => inspectLocaleHtml(readFileSync(artifactFile(directory, `/${locale}/index.html`), 'utf8'), {
    locale, baseUrl: canonicalOrigin, canonicalOrigin,
  }));
  const assets = [...new Set([...locales.flatMap(locale => locale.assets), ...extraAssets.map(publicPath)])].sort()
    .map(asset => ({ path: asset, sha256: digest(readFileSync(artifactFile(directory, asset))) }));
  const manifest = validateReleaseManifest({ schema: 1, commit, stamp, canonicalOrigin: origin(canonicalOrigin), locales, assets }, { commit, canonicalOrigin });
  writeFileSync(path.join(directory, RELEASE_MANIFEST_PATH.slice(1)), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export function resolveWeatherReleaseAssets(projectRoot) {
  const buildManifest = JSON.parse(readFileSync(path.join(projectRoot, '3d-weather-codrops-main/build-manifest.json'), 'utf8'));
  const shell = readFileSync(path.join(projectRoot, 'assets/js/site-shell.js'), 'utf8');
  const version = shell.match(/WEATHER_WIDGET_ASSET_VERSION\s*=\s*['"]([^'"]+)['"]/u)?.[1];
  if (!version || !Array.isArray(buildManifest.entries) || !buildManifest.entries.length) throw new Error('Missing maintained weather module manifest or version.');
  return buildManifest.entries.map(entry => publicPath(`/3d-weather-codrops-main/dist-widget/${entry.output}?v=${encodeURIComponent(version)}`));
}

export function verifyProductionArtifact({ directory, manifest, commit, stamp }) {
  validateReleaseManifest(manifest, { commit, stamp });
  if (readFileSync(artifactFile(directory, STAMP_PATH), 'utf8').trim() !== manifest.stamp) throw new Error('Artifact asset stamp mismatch.');
  for (const locale of RELEASE_LOCALES) {
    const actual = inspectLocaleHtml(readFileSync(artifactFile(directory, `/${locale}/index.html`), 'utf8'), {
      locale, baseUrl: manifest.canonicalOrigin, canonicalOrigin: manifest.canonicalOrigin,
    });
    if (JSON.stringify(actual) !== JSON.stringify(manifest.locales.find(item => item.locale === locale))) throw new Error(`${locale}: artifact HTML asset mismatch.`);
  }
  for (const asset of manifest.assets) if (digest(readFileSync(artifactFile(directory, asset.path))) !== asset.sha256) throw new Error(`Artifact digest mismatch: ${asset.path}`);
  return manifest;
}

async function resource(url, context) {
  const remaining = context.deadline - Date.now();
  if (remaining <= 0) throw new Error('Production verification timed out.');
  const response = await context.fetcher(url, {
    redirect: 'manual', cache: 'no-store',
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    signal: AbortSignal.timeout(Math.max(1, Math.min(context.timeoutMs, remaining))),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  return { response, bytes };
}

async function localePages({ baseUrl, canonicalOrigin, manifest, context }) {
  const start = await resource(new URL('/', baseUrl), context);
  const destination = start.response.headers.get('location');
  if (![301, 302, 307, 308].includes(start.response.status) || !destination || new URL(destination, baseUrl).href !== new URL('/de/', baseUrl).href) {
    throw new Error('Production root does not redirect to /de/.');
  }
  const assetPaths = new Set();
  for (const locale of RELEASE_LOCALES) {
    const page = await resource(new URL(`/${locale}/`, baseUrl), context);
    if (page.response.status !== 200 || !/text\/html/iu.test(page.response.headers.get('content-type') || '')) throw new Error(`${locale}: HTML request failed.`);
    const actual = inspectLocaleHtml(page.bytes.toString('utf8'), { locale, baseUrl, canonicalOrigin });
    if (manifest && JSON.stringify(actual) !== JSON.stringify(manifest.locales.find(item => item.locale === locale))) throw new Error(`${locale}: served asset references differ from the release.`);
    actual.assets.forEach(asset => assetPaths.add(asset));
  }
  const assets = manifest?.assets || [...assetPaths].map(asset => ({ path: asset }));
  for (let offset = 0; offset < assets.length; offset += 4) {
    await Promise.all(assets.slice(offset, offset + 4).map(async asset => {
      const result = await resource(new URL(asset.path, baseUrl), context);
      const type = result.response.headers.get('content-type') || '';
      const validType = /\.css$/iu.test(new URL(asset.path, baseUrl).pathname) ? /text\/css/iu.test(type) : /(?:java|ecma)script/iu.test(type);
      if (result.response.status !== 200 || !validType || (asset.sha256 && digest(result.bytes) !== asset.sha256)) throw new Error(`Served asset mismatch: ${asset.path}`);
    }));
  }
  return assets.length;
}

export async function verifyLocaleSmoke({ baseUrl = PRODUCTION_ORIGIN, canonicalOrigin = PRODUCTION_ORIGIN, timeoutMs = 10000, fetcher = fetch } = {}) {
  baseUrl = origin(baseUrl);
  canonicalOrigin = origin(canonicalOrigin);
  const count = await localePages({ baseUrl, canonicalOrigin, context: { timeoutMs, fetcher, deadline: Date.now() + 180000 } });
  return { baseUrl, locales: RELEASE_LOCALES, assets: count, verified: true };
}

export async function verifyProductionRelease({
  commit, stamp, manifest: expectedManifest, baseUrl = PRODUCTION_ORIGIN,
  attempts = 30, delayMs = 5000, timeoutMs = 10000, maxDurationMs = 180000, fetcher = fetch, pause = sleep,
} = {}) {
  if (!/^[a-f0-9]{40}$/u.test(commit || '')) throw new Error('Pass the full reviewed commit SHA.');
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 30 || !Number.isFinite(delayMs) || delayMs < 0 || delayMs > 60000 ||
      !Number.isInteger(timeoutMs) || timeoutMs < 1 || !Number.isInteger(maxDurationMs) || maxDurationMs < 1) throw new Error('Invalid verification retry bounds.');
  if (expectedManifest) validateReleaseManifest(expectedManifest, { commit, stamp });
  baseUrl = origin(baseUrl);
  const context = { timeoutMs, fetcher, deadline: Date.now() + maxDurationMs };
  let failure;
  for (let attempt = 1; attempt <= attempts && Date.now() < context.deadline; attempt++) {
    try {
      const published = await resource(new URL(`${RELEASE_MANIFEST_PATH}?commit=${commit}`, baseUrl), context);
      const contentType = published.response.headers.get('content-type') || '';
      if (published.response.status !== 200 || !/application\/json/iu.test(contentType)) {
        throw new Error(`Published release manifest is unavailable (HTTP ${published.response.status}; Content-Type: ${contentType || 'missing'}; attempt ${attempt}/${attempts}).`);
      }
      const manifest = validateReleaseManifest(JSON.parse(published.bytes.toString('utf8')), { commit, stamp });
      if (expectedManifest && JSON.stringify(manifest) !== JSON.stringify(expectedManifest)) throw new Error('Published manifest differs from the validated artifact.');
      const liveStamp = await resource(new URL(`${STAMP_PATH}?commit=${commit}`, baseUrl), context);
      if (liveStamp.response.status !== 200 || liveStamp.bytes.toString('utf8').trim() !== manifest.stamp) throw new Error('Published asset stamp does not match the release.');
      const assets = await localePages({ baseUrl, canonicalOrigin: manifest.canonicalOrigin, manifest, context });
      return { commit, stamp: manifest.stamp, baseUrl, locales: RELEASE_LOCALES, assets, attempts: attempt, verified: true };
    } catch (error) {
      failure = error;
      if (attempt < attempts && Date.now() < context.deadline) await pause(Math.min(delayMs, Math.max(0, context.deadline - Date.now())));
    }
  }
  throw new Error(`Production release verification failed: ${failure?.message || 'deadline exceeded'}`, { cause: failure });
}
