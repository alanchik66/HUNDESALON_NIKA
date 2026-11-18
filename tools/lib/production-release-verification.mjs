import { createHash, randomUUID } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { assertProductionAssetContent } from './production-assets.mjs';
import { findPublicWeatherImporters, weatherRuntimeOutputNames } from './weather-asset-versions.mjs';

export const PRODUCTION_ORIGIN = 'https://hundesalon-nika.com';
export const RELEASE_LOCALES = ['de', 'en', 'ru', 'uk'];
export const RELEASE_MANIFEST_PATH = '/config/release-manifest.json';
const STAMP_PATH = '/config/deploy-asset-version.txt';
const PAGES_PROJECT = 'hundesalon-nika';
const MOON_VIDEO_PATH = '/3d-weather-codrops-main/dist-widget/assets/Moon/mission_2160p30_fallback.mp4';
const MAP_FRAME_PATH = '/assets/frames/contact-map.html';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const isMp4Asset = asset => /\.mp4$/iu.test(new URL(asset, PRODUCTION_ORIGIN).pathname);
const isMapFrameAsset = asset => new URL(asset, PRODUCTION_ORIGIN).pathname === MAP_FRAME_PATH;

export const PRECURSOR_BOOTSTRAP_STATIC_SHA256 = 'a60d0f1d9b544e175c035ccdf04d1cd71d74e998a60739eb1702890fda6a413b';
const PRECURSOR_LOADER_PATH = '/cdn-cgi/challenge-platform/scripts/precursor/main.js';
const PRECURSOR_PARAMS = /^<script>window\.__CF\$cv\$params=\{r:'(?<r>[a-f0-9]{16})',t:'(?<t>[A-Za-z0-9+/]{14}==)',u:'(?<u>[a-f0-9]{32})',ut:'(?<ut>[A-Za-z0-9._-]{170})',i:60\};/u;

// Observed 2026-11-18 version only. Never execute scripts or accept unknown edge mutations.
export function verifyMapFrameDelivery({ asset, url, status, headers, bytes, redirects = [] }) {
  const fail = message => { throw new Error('Map frame delivery rejected: ' + message); };
  const responseHeaders = new Headers(headers);
  if (responseHeaders.get('cf-mitigated')?.trim()) fail('challenge response or unknown mitigation');
  if (!asset || !/^\/assets\/frames\/contact-map\.html\?v=\d{8}-prod-[a-f0-9]{7,40}-[a-f0-9]{8}$/u.test(asset.path || '')
    || asset.contentType !== 'text/html' || !/^[a-f0-9]{64}$/u.test(asset.sha256 || '')) fail('fixed stamped HTML metadata required');
  const served = new URL(url);
  const authoredUrl = served.origin + asset.path;
  const cleanUrl = served.origin + asset.path.replace('/contact-map.html?', '/contact-map?');
  if (status !== 200 || !/^\s*text\/html(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/iu.test(responseHeaders.get('content-type') || '')) fail('final 200 UTF-8 HTML required');
  if (served.href === authoredUrl) {
    if (redirects.length) fail('unexpected HTML redirect chain');
  } else if (served.href === cleanUrl) {
    const hop = redirects[0];
    if (redirects.length !== 1 || hop?.url !== authoredUrl || ![301, 308].includes(hop.status)
      || typeof hop.location !== 'string' || hop.location !== hop.location.trim()
      || new URL(hop.location, authoredUrl).href !== cleanUrl) fail('unexpected clean URL normalization');
  } else fail('unexpected fixed HTML URL or query');
  const raw = Buffer.from(bytes);
  const rawServedSha256 = digest(raw);
  if (rawServedSha256 === asset.sha256) return {
    mode: 'exact-served-bytes', rawServedSha256, authoredSha256: asset.sha256, rawBytesMatchArtifact: true,
  };
  if (served.origin !== PRODUCTION_ORIGIN) fail('edge qualification is canonical-origin only');
  const closeBody = Buffer.from('</body>');
  const bodyEnd = raw.indexOf(closeBody);
  if (bodyEnd < 0 || bodyEnd !== raw.lastIndexOf(closeBody)) fail('one closing body required');
  const scriptEnd = bodyEnd - Buffer.byteLength('</script>');
  if (scriptEnd < 0 || raw.subarray(scriptEnd, bodyEnd).toString('utf8') !== '</script>') fail('bootstrap must immediately precede closing body');
  const scriptStart = raw.lastIndexOf(Buffer.from('<script>'), scriptEnd);
  if (scriptStart < 0) fail('one exact bootstrap element required');
  const bootstrapBytes = raw.subarray(scriptStart, bodyEnd);
  if (bootstrapBytes.length !== 642 || bootstrapBytes.some(byte => byte > 127)) fail('unknown bootstrap size or encoding');
  const bootstrap = bootstrapBytes.toString('ascii');
  const match = PRECURSOR_PARAMS.exec(bootstrap);
  if (!match) fail('unknown parameter schema');
  const { r, t } = match.groups;
  const ray = /^([a-f0-9]{16})-[A-Z]{3}$/u.exec(responseHeaders.get('cf-ray') || '');
  if (!ray || ray[1] !== r) fail('CF-Ray binding mismatch');
  const decodedTime = Buffer.from(t, 'base64').toString('ascii');
  if (!/^[1-9]\d{9}$/u.test(decodedTime) || Buffer.from(decodedTime, 'ascii').toString('base64') !== t
    || new Date(Number(decodedTime) * 1000).toUTCString() !== responseHeaders.get('date')) fail('HTTP Date binding mismatch');
  const loaderLiteral = "'" + PRECURSOR_LOADER_PATH + '?ray=' + r + "'";
  if (bootstrap.split(loaderLiteral).length !== 2) fail('one exact same-origin loader/query binding required');
  const skeleton = bootstrap.replace(match[0], "<script>window.__CF$cv$params={r:'[CF_R]',t:'[CF_T]',u:'[CF_U]',ut:'[CF_UT]',i:60};")
    .replace(loaderLiteral, "'" + PRECURSOR_LOADER_PATH + "?ray=[CF_R]'");
  if (digest(Buffer.from(skeleton)) !== PRECURSOR_BOOTSTRAP_STATIC_SHA256) fail('unknown bootstrap static version');
  const authored = Buffer.concat([raw.subarray(0, scriptStart), raw.subarray(bodyEnd)]);
  const authoredSha256 = digest(authored);
  if (authoredSha256 !== asset.sha256) fail('authored bytes differ from artifact');
  return {
    mode: 'known-cloudflare-precursor-bootstrap-v1', rawServedSha256, authoredSha256,
    rawBytesMatchArtifact: false, bootstrapStaticSha256: PRECURSOR_BOOTSTRAP_STATIC_SHA256,
    bootstrapBytes: bootstrapBytes.length, servedBytes: raw.length, authoredBytes: authored.length,
    transportBindings: { cfRayMatches: true, httpDateMatches: true, loaderRayMatches: true },
  };
}

function preserveFrameDeliveryEvidence(asset, bytes, delivery) {
  const project = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
  const inside = target => {
    if (lstatSync(target).isSymbolicLink()) throw new Error('Frame evidence directories cannot be symbolic links.');
    const relative = path.relative(project, realpathSync(target));
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Frame evidence must remain inside the project output directory.');
    return realpathSync(target);
  };
  const output = path.join(project, 'output');
  mkdirSync(output, { recursive: true });
  const privacy = path.join(inside(output), 'privacy');
  mkdirSync(privacy, { recursive: true });
  const directory = path.join(inside(privacy), 'frame-delivery');
  mkdirSync(directory, { recursive: true });
  const resolved = inside(directory);
  const filename = digest(bytes) + '-' + randomUUID();
  const rawBody = path.join(resolved, filename + '.html');
  const metadata = path.join(resolved, filename + '.json');
  writeFileSync(rawBody, bytes, { flag: 'wx', mode: 0o600 });
  writeFileSync(metadata, JSON.stringify({
    scope: 'Single fixed frame response evidence; whole release result is separate.',
    asset: asset.path, ...delivery, rawBody,
  }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return { rawBody, metadata };
}

export function parseWranglerPagesDeploymentOutput(output, { commit } = {}) {
  if (!/^[a-f0-9]{40}$/u.test(commit || '')) throw new Error('Pass the full reviewed commit SHA.');
  let records;
  try {
    if (typeof output !== 'string' || !output.trim()) throw new Error('Missing output.');
    records = output.trim().split(/\r?\n/u).filter(line => line.trim()).map(line => JSON.parse(line));
    if (records.some(record => !record || typeof record !== 'object' || Array.isArray(record))) throw new Error('Invalid record.');
  } catch {
    throw new Error('Invalid Wrangler deployment NDJSON output.');
  }
  const basic = records.filter(record => record.type === 'pages-deploy');
  const detailed = records.filter(record => record.type === 'pages-deploy-detailed');
  if (basic.length !== 1 || detailed.length !== 1 || records.some(record => record.type === 'command-failed')) {
    throw new Error('Expected one successful Wrangler Pages deployment record pair.');
  }
  const deployment = detailed[0];
  if (basic[0].version !== 1 || deployment.version !== 1 ||
      basic[0].pages_project !== PAGES_PROJECT || deployment.pages_project !== PAGES_PROJECT ||
      basic[0].deployment_id !== deployment.deployment_id || basic[0].url !== deployment.url ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(deployment.deployment_id || '')) {
    throw new Error('Wrangler Pages deployment identity mismatch.');
  }
  if (deployment.environment !== 'production' || deployment.production_branch !== 'main' ||
      deployment.deployment_trigger?.metadata?.commit_hash !== commit ||
      [[basic[0].environment, 'production'], [basic[0].production_branch, 'main'],
        [basic[0].deployment_trigger?.metadata?.commit_hash, commit]].some(([actual, expected]) => actual !== undefined && actual !== expected)) {
    throw new Error('Wrangler Pages deployment does not match the reviewed production main revision.');
  }
  let url;
  try { url = new URL(deployment.url); } catch { throw new Error('Invalid Wrangler Pages deployment URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash ||
      url.hostname !== `${deployment.deployment_id.slice(0, 8)}.${PAGES_PROJECT}.pages.dev` ||
      (deployment.url !== url.origin && deployment.url !== `${url.origin}/`)) {
    throw new Error('Use the unique hashed HTTPS Pages deployment origin, not an alias or another host.');
  }
  return { deploymentId: deployment.deployment_id, baseUrl: url.origin, commit };
}

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

function assertMediaContent(requestPath, bytes) {
  if (isMp4Asset(requestPath) && (bytes.length < 16 || bytes.toString('ascii', 4, 8) !== 'ftyp' ||
      bytes.readUInt32BE(0) < 16 || bytes.readUInt32BE(0) > bytes.length)) {
    throw new Error(`Invalid MP4 content: ${requestPath}`);
  }
}

function readReleaseAsset(directory, requestPath) {
  const file = artifactFile(directory, requestPath);
  assertProductionAssetContent(file);
  const bytes = readFileSync(file);
  assertMediaContent(requestPath, bytes);
  return bytes;
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

export function validateReleaseManifest(manifest, { commit, stamp, canonicalOrigin = PRODUCTION_ORIGIN, requiredAssets = [] } = {}) {
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
    if ((!/\.(?:css|m?js|mp4)$/iu.test(new URL(asset.path, PRODUCTION_ORIGIN).pathname) && !isMapFrameAsset(asset.path)) ||
        !/^[a-f0-9]{64}$/u.test(asset.sha256 || '') || paths.has(asset.path)) throw new Error('Invalid release asset digest.');
    if (isMp4Asset(asset.path) && (asset.contentType !== 'video/mp4' || new URL(asset.path, PRODUCTION_ORIGIN).searchParams.get('v') !== manifest.stamp)) {
      throw new Error('Invalid release video metadata.');
    }
    if (isMapFrameAsset(asset.path) && (asset.contentType !== 'text/html' || asset.path !== `${MAP_FRAME_PATH}?v=${manifest.stamp}`)) {
      throw new Error('Invalid release map frame metadata.');
    }
    paths.add(asset.path);
  }
  for (const required of requiredAssets) {
    if (!paths.has(publicPath(required))) throw new Error(`Release manifest is missing required release asset: ${required}`);
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
    .map(asset => ({ path: asset, sha256: digest(readReleaseAsset(directory, asset)), ...(isMp4Asset(asset) ? { contentType: 'video/mp4' } : isMapFrameAsset(asset) ? { contentType: 'text/html' } : {}) }));
  const manifest = validateReleaseManifest({ schema: 1, commit, stamp, canonicalOrigin: origin(canonicalOrigin), locales, assets }, { commit, canonicalOrigin });
  writeFileSync(path.join(directory, RELEASE_MANIFEST_PATH.slice(1)), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export function resolveWeatherReleaseAssets(projectRoot, runtimeRoot) {
  const buildManifest = JSON.parse(readFileSync(path.join(projectRoot, '3d-weather-codrops-main/build-manifest.json'), 'utf8'));
  const version = runtimeRoot
    ? readFileSync(path.join(runtimeRoot, STAMP_PATH.slice(1)), 'utf8').trim()
    : readFileSync(path.join(projectRoot, 'assets/js/site-shell.js'), 'utf8').match(/WEATHER_WIDGET_ASSET_VERSION\s*=\s*['"]([^'"]+)['"]/u)?.[1];
  if (!version || !Array.isArray(buildManifest.entries) || !buildManifest.entries.length) throw new Error('Missing maintained weather module manifest or version.');
  return [...weatherRuntimeOutputNames(buildManifest)].map(output => publicPath(`/3d-weather-codrops-main/dist-widget/${output}?v=${encodeURIComponent(version)}`)).concat(
    findPublicWeatherImporters(runtimeRoot || projectRoot, buildManifest).map(importer => publicPath(`/${importer}?v=${encodeURIComponent(version)}`)),
    publicPath(`${MOON_VIDEO_PATH}?v=${encodeURIComponent(version)}`),
    publicPath(`/assets/js/contact-map.js?v=${encodeURIComponent(version)}`),
    publicPath(`${MAP_FRAME_PATH}?v=${encodeURIComponent(version)}`));
}

export function verifyProductionArtifact({ directory, manifest, commit, stamp, requiredAssets = [] }) {
  validateReleaseManifest(manifest, { commit, stamp, requiredAssets });
  if (readFileSync(artifactFile(directory, STAMP_PATH), 'utf8').trim() !== manifest.stamp) throw new Error('Artifact asset stamp mismatch.');
  for (const locale of RELEASE_LOCALES) {
    const actual = inspectLocaleHtml(readFileSync(artifactFile(directory, `/${locale}/index.html`), 'utf8'), {
      locale, baseUrl: manifest.canonicalOrigin, canonicalOrigin: manifest.canonicalOrigin,
    });
    if (JSON.stringify(actual) !== JSON.stringify(manifest.locales.find(item => item.locale === locale))) throw new Error(`${locale}: artifact HTML asset mismatch.`);
  }
  for (const asset of manifest.assets) if (digest(readReleaseAsset(directory, asset.path)) !== asset.sha256) throw new Error(`Artifact digest mismatch: ${asset.path}`);
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
      const requested = new URL(asset.path, baseUrl);
      let result = await resource(requested, context);
      let servedUrl = requested;
      const redirects = [];
      if (isMapFrameAsset(asset.path) && [301, 308].includes(result.response.status)) {
        const location = result.response.headers.get('location');
        let target;
        try { target = typeof location === 'string' && location === location.trim() ? new URL(location, requested) : null; } catch { target = null; }
        if (target?.href !== `${requested.origin}${MAP_FRAME_PATH.slice(0, -5)}${requested.search}`) throw new Error(`Served asset mismatch: ${asset.path}`);
        redirects.push({ url: requested.href, status: result.response.status, location });
        servedUrl = target;
        result = await resource(target, context);
      }
      const type = result.response.headers.get('content-type') || '';
      const validType = isMp4Asset(asset.path) ? type.split(';')[0].trim().toLowerCase() === 'video/mp4'
        : isMapFrameAsset(asset.path) ? type.split(';')[0].trim().toLowerCase() === 'text/html'
        : /\.css$/iu.test(new URL(asset.path, baseUrl).pathname) ? /text\/css/iu.test(type) : /(?:java|ecma)script/iu.test(type);
      if (result.response.status !== 200 || !validType) throw new Error('Served asset mismatch: ' + asset.path);
      if (isMapFrameAsset(asset.path) && asset.sha256) {
        let delivery;
        try {
          delivery = verifyMapFrameDelivery({ asset, url: servedUrl.href, status: result.response.status, headers: result.response.headers, bytes: result.bytes, redirects });
        } catch (error) {
          if (servedUrl.origin === PRODUCTION_ORIGIN) preserveFrameDeliveryEvidence(asset, result.bytes, {
            mode: 'rejected-frame-delivery', rawServedSha256: digest(result.bytes), expectedAuthoredSha256: asset.sha256, reason: error.message,
          });
          throw new Error('Served asset mismatch: ' + asset.path, { cause: error });
        }
        if (!delivery.rawBytesMatchArtifact) {
          const evidence = preserveFrameDeliveryEvidence(asset, result.bytes, delivery);
          context.frameDeliveries.push({ asset: asset.path, ...delivery, evidence });
        }
      } else if (asset.sha256 && digest(result.bytes) !== asset.sha256) throw new Error('Served asset mismatch: ' + asset.path);
      assertMediaContent(asset.path, result.bytes);
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
  requiredAssets = [],
  attempts = 30, delayMs = 5000, timeoutMs = 10000, maxDurationMs = 180000, fetcher = fetch, pause = sleep,
} = {}) {
  if (!/^[a-f0-9]{40}$/u.test(commit || '')) throw new Error('Pass the full reviewed commit SHA.');
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 30 || !Number.isFinite(delayMs) || delayMs < 0 || delayMs > 60000 ||
      !Number.isInteger(timeoutMs) || timeoutMs < 1 || !Number.isInteger(maxDurationMs) || maxDurationMs < 1) throw new Error('Invalid verification retry bounds.');
  if (expectedManifest) validateReleaseManifest(expectedManifest, { commit, stamp, requiredAssets });
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
      const manifest = validateReleaseManifest(JSON.parse(published.bytes.toString('utf8')), { commit, stamp, requiredAssets });
      if (expectedManifest && JSON.stringify(manifest) !== JSON.stringify(expectedManifest)) throw new Error('Published manifest differs from the validated artifact.');
      const liveStamp = await resource(new URL(`${STAMP_PATH}?commit=${commit}`, baseUrl), context);
      if (liveStamp.response.status !== 200 || liveStamp.bytes.toString('utf8').trim() !== manifest.stamp) throw new Error('Published asset stamp does not match the release.');
      // A rejected batch may still have pending sibling reads. Keep its evidence attempt-local.
      const frameDeliveries = [];
      const assets = await localePages({ baseUrl, canonicalOrigin: manifest.canonicalOrigin, manifest, context: { ...context, frameDeliveries } });
      return { commit, stamp: manifest.stamp, baseUrl, locales: RELEASE_LOCALES, assets, attempts: attempt, verified: true,
        ...(frameDeliveries.length ? { assetVerificationMode: 'exact-assets-with-known-cloudflare-frame-envelope', frameDeliveries } : {}),
      };
    } catch (error) {
      failure = error;
      if (attempt < attempts && Date.now() < context.deadline) await pause(Math.min(delayMs, Math.max(0, context.deadline - Date.now())));
    }
  }
  throw new Error(`Production release verification failed: ${failure?.message || 'deadline exceeded'}`, { cause: failure });
}
