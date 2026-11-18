import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  PRODUCTION_ORIGIN, RELEASE_LOCALES, RELEASE_MANIFEST_PATH,
  prepareProductionRelease, verifyProductionArtifact, verifyProductionRelease, verifyLocaleSmoke,
  resolveWeatherReleaseAssets,
  validateReleaseManifest,
  parseWranglerPagesDeploymentOutput, verifyMapFrameDelivery, PRECURSOR_BOOTSTRAP_STATIC_SHA256,
} from './lib/production-release-verification.mjs';

const COMMIT = 'a'.repeat(40);
const STAMP = `20261104-prod-${COMMIT.slice(0, 7)}-1234abcd`;
const SCRIPT = `/assets/js/app.js?v=${STAMP}`;
const STYLESHEET = `/assets/css/app.css?v=${STAMP}`;
const VENDOR_STYLESHEET = '/assets/fonts/fontawesome/all.min.css?v=20260329-0192';
const WEATHER = '/weather/runtime.mjs?v=weather-v6';
const MOON_PATH = '/3d-weather-codrops-main/dist-widget/assets/Moon/mission_2160p30_fallback.mp4';
const MOON = `${MOON_PATH}?v=${STAMP}`;
const MAP_FRAME_PATH = '/assets/frames/contact-map.html';
const MAP_FRAME = `${MAP_FRAME_PATH}?v=${STAMP}`;
const MAP_FRAME_CLEAN = `/assets/frames/contact-map?v=${STAMP}`;
const MAP_FRAME_HTML = '<!doctype html><html><head><title>Isolated map</title></head><body><div class="map-native"></div></body></html>';
// Container-signature fixture only; codec playback is verified separately in browser QA.
const MP4 = Buffer.from('000000186674797069736f6d0000020069736f6d617663310000000c6d64617400000000', 'hex');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const LFS_POINTER = `version https://git-lfs.github.com/spec/v1\noid sha256:${sha256(MP4)}\nsize ${MP4.length}\n`;
const DEPLOYMENT_ID = '1234abcd-1234-1234-1234-123456789abc';
const DEPLOYMENT_ORIGIN = 'https://1234abcd.hundesalon-nika.pages.dev';

const wranglerRecords = () => [
  { type: 'wrangler-session', version: 1, command_line_args: ['pages', 'deploy', 'dist'] },
  { type: 'pages-deploy', version: 1, pages_project: 'hundesalon-nika', deployment_id: DEPLOYMENT_ID, url: DEPLOYMENT_ORIGIN },
  {
    type: 'pages-deploy-detailed', version: 1, pages_project: 'hundesalon-nika', deployment_id: DEPLOYMENT_ID,
    url: DEPLOYMENT_ORIGIN, alias: 'https://main.hundesalon-nika.pages.dev', environment: 'production', production_branch: 'main',
    deployment_trigger: { metadata: { commit_hash: COMMIT } },
  },
];
const ndjson = records => `${records.map(record => JSON.stringify(record)).join('\n')}\n`;

test('Wrangler deployment output selects the exact reviewed deployment origin rather than its alias', () => {
  assert.deepEqual(parseWranglerPagesDeploymentOutput(ndjson(wranglerRecords()), { commit: COMMIT }), {
    deploymentId: DEPLOYMENT_ID, baseUrl: DEPLOYMENT_ORIGIN, commit: COMMIT,
  });
});

test('Wrangler output rejects malformed, failed, missing or ambiguous deployment record pairs', () => {
  for (const output of ['', 'private malformed output', 'null\n', '[]\n', '{}\n']) {
    assert.throws(() => parseWranglerPagesDeploymentOutput(output, { commit: COMMIT }), /Wrangler/u);
  }
  for (const records of [
    wranglerRecords().slice(0, 2), wranglerRecords().slice(2),
    [...wranglerRecords(), wranglerRecords()[1]], [...wranglerRecords(), wranglerRecords()[2]],
    [...wranglerRecords(), { type: 'command-failed', message: 'private command output' }],
  ]) {
    assert.throws(() => parseWranglerPagesDeploymentOutput(ndjson(records), { commit: COMMIT }), /one successful Wrangler Pages deployment record pair/u);
  }
  assert.throws(() => parseWranglerPagesDeploymentOutput(ndjson(wranglerRecords()), { commit: COMMIT.slice(0, 7) }), /full reviewed commit/u);
});

test('Wrangler output binds both deployment records to this production project and the full main SHA', () => {
  const cases = [
    ['basic project', records => { records[1].pages_project = 'another-project'; }],
    ['detailed project', records => { records[2].pages_project = 'another-project'; }],
    ['basic version', records => { records[1].version = 2; }],
    ['detailed version', records => { records[2].version = 2; }],
    ['mismatched ID', records => { records[1].deployment_id = '8765abcd-1234-1234-1234-123456789abc'; }],
    ['invalid ID', records => { records[1].deployment_id = records[2].deployment_id = '1234abcd'; }],
    ['mismatched URL', records => { records[1].url = 'https://8765abcd.hundesalon-nika.pages.dev'; }],
    ['preview environment', records => { records[2].environment = 'preview'; }],
    ['non-main branch', records => { records[2].production_branch = 'staging'; }],
    ['same short SHA prefix', records => { records[2].deployment_trigger.metadata.commit_hash = COMMIT.slice(0, 7) + 'b'.repeat(33); }],
    ['missing SHA', records => { delete records[2].deployment_trigger; }],
    ['contradictory basic environment', records => { records[1].environment = 'preview'; }],
    ['contradictory basic branch', records => { records[1].production_branch = 'staging'; }],
    ['contradictory basic SHA', records => { records[1].deployment_trigger = { metadata: { commit_hash: 'b'.repeat(40) } }; }],
  ];
  for (const [name, change] of cases) {
    const records = wranglerRecords();
    change(records);
    assert.throws(() => parseWranglerPagesDeploymentOutput(ndjson(records), { commit: COMMIT }), /deployment (?:identity mismatch|does not match)/u, name);
  }
});

test('Wrangler output rejects aliases and URLs with another host, ID prefix, credentials, port or suffix', () => {
  for (const url of [
    'https://main.hundesalon-nika.pages.dev', 'https://hundesalon-nika.pages.dev',
    'https://1234abcd.other-project.pages.dev', 'https://8765abcd.hundesalon-nika.pages.dev',
    `${DEPLOYMENT_ORIGIN}.example.com`, DEPLOYMENT_ORIGIN.replace('https:', 'http:'),
    DEPLOYMENT_ORIGIN.replace('https://', 'https://user:password@'),
    `${DEPLOYMENT_ORIGIN}:443`, `${DEPLOYMENT_ORIGIN}:8443`,
    `${DEPLOYMENT_ORIGIN}/de/`, `${DEPLOYMENT_ORIGIN}?commit=${COMMIT}`, `${DEPLOYMENT_ORIGIN}#fragment`, 'invalid-url',
  ]) {
    const records = wranglerRecords();
    records[1].url = records[2].url = url;
    assert.throws(() => parseWranglerPagesDeploymentOutput(ndjson(records), { commit: COMMIT }), /Pages deployment (?:URL|origin)/u, url);
  }
});

test('the deployment CLI requires its validated manifest and rejects competing origins or verification modes before reading files', () => {
  for (const extra of [[], ['--base-url', PRODUCTION_ORIGIN], ['--prepare'], ['--verify-artifact']]) {
    const child = spawnSync(process.execPath, [
      path.resolve('tools/verify-production-release.mjs'), '--commit', COMMIT, '--wrangler-output', 'missing-fixture.ndjson', ...extra,
    ], { encoding: 'utf8', windowsHide: true });
    assert.equal(child.status, 1);
    assert.match(child.stderr, /--wrangler-output (?:cannot be combined|is only valid|requires the validated --manifest)/u);
    assert.doesNotMatch(child.stderr, /ENOENT/u);
  }
});

async function fixture(t, intercept = () => null, { includeVendor = false, includeMoon = false } = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'nika-release-verification-'));
  for (const name of ['config', 'assets', 'assets/css', 'assets/js', 'weather', ...RELEASE_LOCALES]) mkdirSync(path.join(directory, name));
  writeFileSync(path.join(directory, 'config/deploy-asset-version.txt'), `${STAMP}\n`);
  writeFileSync(path.join(directory, 'assets/js/app.js'), 'console.log("reviewed");\n');
  writeFileSync(path.join(directory, 'assets/css/app.css'), 'body{color:#fff}\n');
  const vendorFile = path.join(directory, 'assets/fonts/fontawesome/all.min.css');
  if (includeVendor) {
    mkdirSync(path.dirname(vendorFile), { recursive: true });
    writeFileSync(vendorFile, '.fa{font-family:FontAwesome}\n');
  }
  writeFileSync(path.join(directory, 'weather/runtime.mjs'), 'export const weather = "reviewed";\n');
  const moonFile = path.join(directory, MOON_PATH.slice(1));
  if (includeMoon) {
    mkdirSync(path.dirname(moonFile), { recursive: true });
    writeFileSync(moonFile, MP4);
  }
  for (const locale of RELEASE_LOCALES) {
    writeFileSync(path.join(directory, locale, 'index.html'), `<!doctype html><html lang="${locale}"><head>
      <link href="${PRODUCTION_ORIGIN}/${locale}/" rel="canonical"><link rel="icon" href="/favicon.ico">
      <link href="${STYLESHEET}" rel="stylesheet"><script src="${SCRIPT}"></script>
      ${includeVendor ? `<link rel="stylesheet" href="${VENDOR_STYLESHEET}">` : ''}
      <script src="https://third-party.example/external.js"></script></head><body>${locale}</body></html>`);
  }
  const manifest = prepareProductionRelease({ directory, commit: COMMIT, extraAssets: [WEATHER, ...(includeMoon ? [MOON] : [])] });
  const routes = new Map([
    [RELEASE_MANIFEST_PATH, path.join(directory, 'config/release-manifest.json')],
    ['/config/deploy-asset-version.txt', path.join(directory, 'config/deploy-asset-version.txt')],
    ['/assets/js/app.js', path.join(directory, 'assets/js/app.js')],
    ['/assets/css/app.css', path.join(directory, 'assets/css/app.css')],
    ['/weather/runtime.mjs', path.join(directory, 'weather/runtime.mjs')],
    ...RELEASE_LOCALES.map(locale => [`/${locale}/`, path.join(directory, locale, 'index.html')]),
  ]);
  if (includeVendor) routes.set('/assets/fonts/fontawesome/all.min.css', vendorFile);
  if (includeMoon) routes.set(MOON_PATH, moonFile);
  const requests = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://fixture.invalid');
    requests.push(url.pathname + url.search);
    const overridden = intercept({ url, requests, manifest });
    if (overridden?.hang) return;
    if (overridden) {
      response.writeHead(overridden.status ?? 200, { 'Content-Type': overridden.type || 'application/json', ...overridden.headers });
      response.end(typeof overridden.body === 'string' || Buffer.isBuffer(overridden.body) ? overridden.body : JSON.stringify(overridden.body));
      return;
    }
    if (url.pathname === '/') {
      response.writeHead(302, { Location: '/de/' });
      response.end();
      return;
    }
    const local = routes.get(url.pathname);
    try {
      if (!local) throw new Error('Unknown fixture route.');
      const bytes = readFileSync(local);
      const type = /\.html$/u.test(local) ? 'text/html' : /\.css$/u.test(local) ? 'text/css' : /\.m?js$/u.test(local) ? 'application/javascript' : /\.mp4$/u.test(local) ? 'video/mp4' : /\.json$/u.test(local) ? 'application/json' : 'text/plain';
      response.writeHead(200, { 'Content-Type': type });
      response.end(bytes);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('Not found');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    assert.equal(path.dirname(directory), tmpdir());
    assert.ok(path.basename(directory).startsWith('nika-release-verification-'));
    rmSync(directory, { recursive: true, force: true });
  });
  return { directory, manifest, requests, moonFile, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function mapFrameFixture(t, intercept = () => null) {
  let file;
  const f = await fixture(t, details => intercept(details) ||
    ([MAP_FRAME_PATH, '/assets/frames/contact-map'].includes(details.url.pathname)
      ? { type: 'text/html; charset=utf-8', body: readFileSync(file) } : null));
  file = path.join(f.directory, MAP_FRAME_PATH.slice(1));
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, MAP_FRAME_HTML);
  Object.assign(f.manifest, prepareProductionRelease({ directory: f.directory, commit: COMMIT, extraAssets: [WEATHER, MAP_FRAME] }));
  return { ...f, frameFile: file };
}

const verification = f => ({ commit: COMMIT, manifest: f.manifest, baseUrl: f.baseUrl, attempts: 1 });

const PRECURSOR_R = '0123456789abcdef';
const PRECURSOR_TIME = 1795000000;
const PRECURSOR_T = Buffer.from(String(PRECURSOR_TIME)).toString('base64');
const PRECURSOR_TEMPLATE = "<script>window.__CF$cv$params={r:'[CF_R]',t:'[CF_T]',u:'[CF_U]',ut:'[CF_UT]',i:60};(function(){if(!document.body)return;var l=window.location,o;try{o=new URL(l.origin).origin}catch(e){try{o=new URL(new URL(l.href).origin).origin}catch(e){o=''}}var u='/cdn-cgi/challenge-platform/scripts/precursor/main.js?ray=[CF_R]',s=document.createElement('script');s.src=o?new URL(u,o).href:u;document.head.appendChild(s);})();</script>";
const precursorBootstrap = () => PRECURSOR_TEMPLATE.replaceAll('[CF_R]', PRECURSOR_R)
  .replace('[CF_T]', PRECURSOR_T).replace('[CF_U]', 'a'.repeat(32)).replace('[CF_UT]', 'A'.repeat(170));
const precursorBody = (bootstrap = precursorBootstrap()) => Buffer.from(MAP_FRAME_HTML.replace('</body>', bootstrap + '</body>'));
const precursorInput = () => ({
  asset: { path: MAP_FRAME, contentType: 'text/html', sha256: sha256(MAP_FRAME_HTML) },
  url: PRODUCTION_ORIGIN + MAP_FRAME, status: 200,
  headers: { 'content-type': 'text/html; charset=utf-8', 'cf-ray': PRECURSOR_R + '-FRA', date: new Date(PRECURSOR_TIME * 1000).toUTCString() },
  bytes: precursorBody(), redirects: [],
});
const canonicalFixtureFetcher = f => (url, request) => {
  assert.equal(url.origin, PRODUCTION_ORIGIN);
  return fetch(new URL(url.pathname + url.search, f.baseUrl), request);
};

test('frame delivery separates exact bytes from one pinned canonical Precursor envelope without logging opaque fields', () => {
  assert.equal(precursorBootstrap().length, 642);
  assert.equal(sha256(PRECURSOR_TEMPLATE), PRECURSOR_BOOTSTRAP_STATIC_SHA256);
  const input = precursorInput();
  const before = Buffer.from(input.bytes);
  const result = verifyMapFrameDelivery(input);
  assert.equal(result.mode, 'known-cloudflare-precursor-bootstrap-v1');
  assert.equal(result.rawServedSha256, sha256(input.bytes));
  assert.equal(result.authoredSha256, input.asset.sha256);
  assert.notEqual(result.rawServedSha256, result.authoredSha256);
  assert.equal(result.bootstrapStaticSha256, PRECURSOR_BOOTSTRAP_STATIC_SHA256);
  assert.equal(result.rawBytesMatchArtifact, false);
  assert.deepEqual(result.transportBindings, { cfRayMatches: true, httpDateMatches: true, loaderRayMatches: true });
  assert.deepEqual(input.bytes, before);
  for (const opaque of [PRECURSOR_R, PRECURSOR_T, 'a'.repeat(32), 'A'.repeat(170)]) assert.ok(!JSON.stringify(result).includes(opaque));

  const exact = verifyMapFrameDelivery({ ...input, url: DEPLOYMENT_ORIGIN + MAP_FRAME, bytes: Buffer.from(MAP_FRAME_HTML), headers: { 'content-type': 'text/html' } });
  assert.equal(exact.mode, 'exact-served-bytes');
  assert.equal(exact.rawServedSha256, exact.authoredSha256);
  assert.equal(exact.rawBytesMatchArtifact, true);
  for (const status of [301, 308]) {
    const clean = verifyMapFrameDelivery({ ...input, url: PRODUCTION_ORIGIN + MAP_FRAME_CLEAN,
      redirects: [{ url: input.url, status, location: MAP_FRAME_CLEAN }] });
    assert.deepEqual(clean, result);
  }
});

test('frame edge qualification rejects neighboring assets, alternate origins, queries, status, MIME and redirect chains', () => {
  const changes = [
    ['neighbor frame', x => { x.asset.path = x.asset.path.replace('contact-map', 'another-map'); }],
    ['JS asset', x => { x.asset.path = SCRIPT; x.asset.contentType = 'application/javascript'; }],
    ['CSS asset', x => { x.asset.path = STYLESHEET; x.asset.contentType = 'text/css'; }],
    ['missing digest', x => { delete x.asset.sha256; }],
    ['manifest MIME', x => { x.asset.contentType = 'application/xhtml+xml'; }],
    ['unversioned asset', x => { x.asset.path = MAP_FRAME_PATH; }],
    ['other stamp', x => { x.url = x.url.replace('1234abcd', '87654321'); }],
    ['extra query', x => { x.url += '&ray=' + PRECURSOR_R; }],
    ['duplicate version', x => { x.url += '&v=' + STAMP; }],
    ['fragment', x => { x.url += '#frame'; }],
    ['credential', x => { x.url = x.url.replace('https://', 'https://user@'); }],
    ['Pages host', x => { x.url = DEPLOYMENT_ORIGIN + MAP_FRAME; }],
    ['foreign host', x => { x.url = 'https://example.invalid' + MAP_FRAME; }],
    ['HTTP scheme', x => { x.url = x.url.replace('https:', 'http:'); }],
    ['nonstandard port', x => { x.url = x.url.replace('.com/', '.com:8443/'); }],
    ['redirect status', x => { x.status = 308; }],
    ['non-200', x => { x.status = 201; }],
    ['bad MIME', x => { x.headers['content-type'] = 'text/plain'; }],
    ['wrong charset', x => { x.headers['content-type'] = 'text/html; charset=iso-8859-1'; }],
    ['missing MIME', x => { delete x.headers['content-type']; }],
    ['clean without redirect', x => { x.url = PRODUCTION_ORIGIN + MAP_FRAME_CLEAN; }],
    ['redirect at fixed URL', x => { x.redirects = [{ url: x.url, status: 308, location: MAP_FRAME_CLEAN }]; }],
    ...[302, 303, 307].map(status => ['unapproved redirect ' + status, x => {
      x.redirects = [{ url: x.url, status, location: MAP_FRAME_CLEAN }]; x.url = PRODUCTION_ORIGIN + MAP_FRAME_CLEAN;
    }]),
    ...['https://example.invalid' + MAP_FRAME_CLEAN, MAP_FRAME_CLEAN + '&extra=1', MAP_FRAME_CLEAN + '#x', ' ' + MAP_FRAME_CLEAN].map(location => [
      'changed redirect target', x => { x.redirects = [{ url: x.url, status: 308, location }]; x.url = PRODUCTION_ORIGIN + MAP_FRAME_CLEAN; },
    ]),
    ['multiple hops', x => { x.redirects = [{ url: x.url, status: 308, location: MAP_FRAME_CLEAN }, { url: x.url, status: 308, location: MAP_FRAME_CLEAN }]; x.url = PRODUCTION_ORIGIN + MAP_FRAME_CLEAN; }],
  ];
  for (const [name, change] of changes) {
    const input = precursorInput();
    change(input);
    assert.throws(() => verifyMapFrameDelivery(input), /Map frame delivery rejected/u, name);
  }
});

test('unknown, moved, repeated or authored-byte mutations never qualify as the observed bootstrap', () => {
  const original = precursorBootstrap();
  const mutations = [
    ['static statement', original.replace('document.head.appendChild(s)', 'document.body.appendChild(s)')],
    ['equivalent numeric literal', original.replace('i:60', 'i:6e1')],
    ['additional parameter', original.replace('i:60', 'i:60,x:1')],
    ['changed field order', original.replace("r:'" + PRECURSOR_R + "',t:'" + PRECURSOR_T + "'", "t:'" + PRECURSOR_T + "',r:'" + PRECURSOR_R + "'")],
    ['extra whitespace', original.replace('i:60', 'i: 60')],
    ['ray wrong alphabet', original.replace("r:'0", "r:'G")],
    ['ray length', original.replace("r:'" + PRECURSOR_R, "r:'" + PRECURSOR_R.slice(1))],
    ['u wrong alphabet', original.replace("u:'a", "u:'G")],
    ['u short', original.replace("u:'" + 'a'.repeat(32), "u:'" + 'a'.repeat(31))],
    ['ut unsafe slash', original.replace("ut:'A", "ut:'/")],
    ['ut short', original.replace("ut:'" + 'A'.repeat(170), "ut:'" + 'A'.repeat(169))],
    ['literal escape', original.replace("u:'a", "u:'\\x61")],
    ['double quote', original.replace("u:'" + 'a'.repeat(32) + "'", 'u:"' + 'a'.repeat(32) + '"')],
    ['loader foreign origin', original.replace("u='/cdn-cgi/", "u='https://example.invalid/cdn-cgi/")],
    ['loader another path', original.replace('/scripts/precursor/', '/scripts/anotherxx/')],
    ['loader unmatched ray', original.replace('?ray=' + PRECURSOR_R, '?ray=' + 'f'.repeat(16))],
    ['loader encoded ray', original.replace('?ray=0', '?ray=%30')],
    ['loader duplicate query', original.replace("?ray=" + PRECURSOR_R, "?ray=" + PRECURSOR_R + '&ray=' + PRECURSOR_R)],
    ['loader unknown query', original.replace("?ray=" + PRECURSOR_R, "?key=" + PRECURSOR_R)],
    ['loader query order', original.replace("?ray=" + PRECURSOR_R, "?x=1&ray=" + PRECURSOR_R)],
    ['non-ASCII byte', original.replace("ut:'A", "ut:'é")],
  ];
  for (const [name, bootstrap] of mutations) {
    assert.throws(() => verifyMapFrameDelivery({ ...precursorInput(), bytes: precursorBody(bootstrap) }), /Map frame delivery rejected/u, name);
  }
  for (const [name, body] of [
    ['double bootstrap', MAP_FRAME_HTML.replace('</body>', original + original + '</body>')],
    ['after body', MAP_FRAME_HTML.replace('</body>', '</body>' + original)],
    ['inside body', MAP_FRAME_HTML.replace('<div', original + '<div')],
    ['not immediately before body', MAP_FRAME_HTML.replace('</body>', original + '\n</body>')],
    ['extra script', MAP_FRAME_HTML.replace('</body>', '<script>alert(1)</script>' + original + '</body>')],
    ['mutated authored bytes', MAP_FRAME_HTML.replace('Isolated map', 'Mutated map').replace('</body>', original + '</body>')],
    ['multiple closing bodies', MAP_FRAME_HTML.replace('</body>', original + '</body></body>')],
  ]) assert.throws(() => verifyMapFrameDelivery({ ...precursorInput(), bytes: Buffer.from(body) }), /Map frame delivery rejected/u, name);
});

test('Precursor transport bindings reject mismatches and noncanonical Base64 with identical decoded time', () => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const index = alphabet.indexOf(PRECURSOR_T.at(-3));
  const alternateTime = PRECURSOR_T.slice(0, -3) + alphabet[index + 1] + '==';
  assert.equal(Buffer.from(alternateTime, 'base64').toString(), String(PRECURSOR_TIME));
  for (const [name, change] of [
    ['missing ray', x => { delete x.headers['cf-ray']; }],
    ['wrong ray', x => { x.headers['cf-ray'] = 'f'.repeat(16) + '-FRA'; }],
    ['missing Date', x => { delete x.headers.date; }],
    ['different Date', x => { x.headers.date = new Date((PRECURSOR_TIME + 1) * 1000).toUTCString(); }],
    ['wrong time shape', x => { x.bytes = precursorBody(precursorBootstrap().replace(PRECURSOR_T, Buffer.from('abcdefghij').toString('base64'))); }],
    ['noncanonical Base64', x => { x.bytes = precursorBody(precursorBootstrap().replace(PRECURSOR_T, alternateTime)); }],
  ]) {
    const input = precursorInput(); change(input);
    assert.throws(() => verifyMapFrameDelivery(input), /Map frame delivery rejected/u, name);
  }
});

test('challenge evidence fails before both raw-exact and edge-qualified fast paths', () => {
  for (const bytes of [Buffer.from(MAP_FRAME_HTML), precursorBody()]) {
    const input = precursorInput();
    for (const mitigation of ['challenge', 'ChAlLeNgE', 'challenge, other', 'other']) {
      input.headers['cf-mitigated'] = mitigation;
      assert.throws(() => verifyMapFrameDelivery({ ...input, bytes }), /challenge response/u);
    }
    const duplicated = new Headers([['content-type', 'text/html'], ['cf-mitigated', 'challenge'], ['cf-mitigated', 'other']]);
    assert.throws(() => verifyMapFrameDelivery({ ...input, bytes, headers: duplicated }), /challenge response/u);
  }
});

test('canonical release evidence retains raw body and reports authored recovery instead of an exact-byte claim', async t => {
  const headers = precursorInput().headers;
  const f = await mapFrameFixture(t, ({ url }) => url.pathname === MAP_FRAME_PATH
    ? { type: headers['content-type'], headers: { 'cf-ray': headers['cf-ray'], date: headers.date }, body: precursorBody() } : null);
  const result = await verifyProductionRelease({ ...verification(f), baseUrl: PRODUCTION_ORIGIN, fetcher: canonicalFixtureFetcher(f) });
  assert.equal(result.verified, true);
  assert.equal(result.assetVerificationMode, 'exact-assets-with-known-cloudflare-frame-envelope');
  assert.equal(result.frameDeliveries.length, 1);
  const frame = result.frameDeliveries[0];
  assert.equal(frame.rawBytesMatchArtifact, false);
  assert.equal(frame.authoredSha256, sha256(MAP_FRAME_HTML));
  assert.equal(frame.rawServedSha256, sha256(precursorBody()));
  assert.deepEqual(readFileSync(frame.evidence.rawBody), precursorBody());
  assert.equal(JSON.parse(readFileSync(frame.evidence.metadata, 'utf8')).rawServedSha256, frame.rawServedSha256);
  assert.ok(path.resolve(frame.evidence.rawBody).startsWith(path.resolve('output/privacy/frame-delivery') + path.sep));
  for (const opaque of [PRECURSOR_R, PRECURSOR_T, 'a'.repeat(32), 'A'.repeat(170)]) assert.ok(!JSON.stringify(frame).includes(opaque));
});

test('a late qualified sibling from a failed attempt cannot contaminate successful attempt evidence', async t => {
  const f = await mapFrameFixture(t);
  let frameReads = 0, scriptReads = 0;
  let finishFirst;
  const firstFinished = new Promise(resolve => { finishFirst = resolve; });
  const secondBody = precursorBody(precursorBootstrap().replace("u:'" + 'a'.repeat(32), "u:'" + 'b'.repeat(32)));
  const fetcher = async (url, request) => {
    if (url.pathname === MAP_FRAME_PATH) {
      const first = ++frameReads === 1;
      if (first) await new Promise(resolve => setTimeout(resolve, 100));
      const response = new Response(first ? precursorBody() : secondBody, { headers: precursorInput().headers });
      if (first) finishFirst();
      return response;
    }
    if (url.pathname === '/assets/js/app.js' && ++scriptReads === 1) return new Response('stale', { headers: { 'content-type': 'application/javascript' } });
    return canonicalFixtureFetcher(f)(url, request);
  };
  const result = await verifyProductionRelease({ ...verification(f), baseUrl: PRODUCTION_ORIGIN, fetcher, attempts: 2, delayMs: 0, pause: async () => {} });
  await firstFinished;
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(result.attempts, 2);
  assert.equal(frameReads, 2);
  assert.equal(result.frameDeliveries.length, 1);
  assert.equal(result.frameDeliveries[0].rawServedSha256, sha256(secondBody));
});

test('edge qualification never changes local artifact checks or public JS and CSS digest checks', async t => {
  const f = await mapFrameFixture(t);
  writeFileSync(f.frameFile, precursorBody());
  assert.throws(() => verifyProductionArtifact({ directory: f.directory, manifest: f.manifest, commit: COMMIT }), /Artifact digest mismatch/u);
  await assert.rejects(verifyProductionRelease(verification(f)), /Served asset mismatch/u);
  for (const filename of ['/assets/js/app.js', '/assets/css/app.css']) {
    const other = await fixture(t, ({ url }) => url.pathname === filename
      ? { type: filename.endsWith('.css') ? 'text/css' : 'application/javascript', body: precursorBootstrap() } : null);
    await assert.rejects(verifyProductionRelease({ ...verification(other), baseUrl: PRODUCTION_ORIGIN, fetcher: canonicalFixtureFetcher(other) }), /Served asset mismatch/u);
  }
});


test('Pages-host verification preserves the canonical domain and exact artifact hashes for all four locales', async t => {
  const f = await fixture(t);
  const deployment = parseWranglerPagesDeploymentOutput(ndjson(wranglerRecords()), { commit: COMMIT });
  const options = {
    ...verification(f), baseUrl: deployment.baseUrl,
    fetcher: (url, request) => {
      assert.equal(url.origin, DEPLOYMENT_ORIGIN);
      return fetch(new URL(url.pathname + url.search, f.baseUrl), request);
    },
  };
  const result = await verifyProductionRelease(options);
  assert.equal(result.baseUrl, DEPLOYMENT_ORIGIN);
  assert.equal(result.verified, true);
  assert.equal(result.assets, 3);
  assert.deepEqual(result.locales, RELEASE_LOCALES);
  assert.equal(f.manifest.canonicalOrigin, PRODUCTION_ORIGIN);

  const ukrainian = path.join(f.directory, 'uk/index.html');
  const original = readFileSync(ukrainian, 'utf8');
  writeFileSync(ukrainian, original.replace(`${PRODUCTION_ORIGIN}/uk/`, `${DEPLOYMENT_ORIGIN}/uk/`));
  await assert.rejects(verifyProductionRelease(options), /uk: incorrect or missing canonical/u);
  writeFileSync(ukrainian, original);
  writeFileSync(path.join(f.directory, 'assets/js/app.js'), 'console.log("changed deployment");');
  await assert.rejects(verifyProductionRelease(options), /Served asset mismatch/u);
});

test('Pages-host verification rejects a root redirect to the canonical host instead of its own translated root', async t => {
  const f = await fixture(t, ({ url }) => url.pathname === '/'
    ? { status: 301, headers: { Location: `${PRODUCTION_ORIGIN}/de/` }, type: 'text/plain', body: '' } : null);
  await assert.rejects(verifyProductionRelease({
    ...verification(f), baseUrl: DEPLOYMENT_ORIGIN,
    fetcher: (url, request) => fetch(new URL(url.pathname + url.search, f.baseUrl), request),
  }), /Production root does not redirect to \/de\//u);
});

test('the exact reviewed artifact serves all four translated pages and matching core/weather bytes', async t => {
  const f = await fixture(t);
  assert.equal(verifyProductionArtifact({ directory: f.directory, manifest: f.manifest, commit: COMMIT, stamp: STAMP }), f.manifest);
  const result = await verifyProductionRelease(verification(f));
  assert.deepEqual(result.locales, RELEASE_LOCALES);
  assert.equal(result.commit, COMMIT);
  assert.equal(result.stamp, STAMP);
  assert.equal(result.assets, 3);
  for (const locale of RELEASE_LOCALES) assert.ok(f.requests.includes(`/${locale}/`));
  for (const asset of [SCRIPT, STYLESHEET, WEATHER]) assert.ok(f.requests.includes(asset));
  assert.ok(f.requests.every(request => !request.includes('third-party.example')));
});

test('artifact validation rejects changed bytes before a deployment starts', async t => {
  const f = await fixture(t);
  writeFileSync(path.join(f.directory, 'assets/js/app.js'), 'console.log("unreviewed");');
  assert.throws(() => verifyProductionArtifact({ directory: f.directory, manifest: f.manifest, commit: COMMIT }), /Artifact digest mismatch/u);
  assert.equal(f.requests.length, 0);
});

test('a versioned Moon MP4 is covered by its exact bytes and video MIME in the artifact and public receipt', async t => {
  const f = await fixture(t, () => null, { includeMoon: true });
  assert.deepEqual(f.manifest.assets.find(asset => asset.path === MOON), {
    path: MOON, sha256: sha256(MP4), contentType: 'video/mp4',
  });
  assert.equal(verifyProductionArtifact({ directory: f.directory, manifest: f.manifest, commit: COMMIT }), f.manifest);
  const result = await verifyProductionRelease(verification(f));
  assert.equal(result.assets, 4);
  assert.ok(f.requests.includes(MOON));
  for (const invalidate of [asset => { delete asset.contentType; }, asset => { asset.path = MOON_PATH; },
    asset => { asset.path = `${MOON_PATH}?v=weather-v6`; }]) {
    const invalid = structuredClone(f.manifest);
    invalidate(invalid.assets.find(asset => asset.path === MOON));
    assert.throws(() => verifyProductionArtifact({ directory: f.directory, manifest: invalid, commit: COMMIT }), /Invalid release video metadata/u);
  }
});

test('receipt preparation and local artifact verification reject even a correctly hashed Git LFS media pointer', async t => {
  const f = await fixture(t, () => null, { includeMoon: true });
  writeFileSync(f.moonFile, LFS_POINTER);
  assert.throws(() => prepareProductionRelease({ directory: f.directory, commit: COMMIT, extraAssets: [WEATHER, MOON] }), /unresolved Git LFS pointer/u);
  f.manifest.assets.find(asset => asset.path === MOON).sha256 = sha256(LFS_POINTER);
  assert.throws(() => verifyProductionArtifact({ directory: f.directory, manifest: f.manifest, commit: COMMIT }), /unresolved Git LFS pointer/u);
  assert.equal(f.requests.length, 0);
});

test('HTTP 200 and a matching receipt hash cannot bless an LFS pointer or HTML response as Moon video', async t => {
  for (const body of [LFS_POINTER, '<!doctype html><title>Not a video</title>']) {
    const f = await fixture(t, ({ url }) => url.pathname === MOON_PATH ? { type: 'video/mp4', body } : null, { includeMoon: true });
    f.manifest.assets.find(asset => asset.path === MOON).sha256 = sha256(body);
    writeFileSync(path.join(f.directory, RELEASE_MANIFEST_PATH.slice(1)), JSON.stringify(f.manifest));
    await assert.rejects(verifyProductionRelease(verification(f)), /Invalid MP4 content/u);
  }
});

test('matching Moon video bytes still fail when served under the wrong MIME type', async t => {
  const f = await fixture(t, ({ url }) => url.pathname === MOON_PATH
    ? { type: 'text/plain', body: MP4 } : null, { includeMoon: true });
  await assert.rejects(verifyProductionRelease(verification(f)), /Served asset mismatch/u);
});

test('the fixed map frame HTML is stamped and hash verified without accepting arbitrary HTML assets', async t => {
  const f = await mapFrameFixture(t);
  assert.deepEqual(f.manifest.assets.find(asset => asset.path === MAP_FRAME), {
    path: MAP_FRAME, sha256: sha256(MAP_FRAME_HTML), contentType: 'text/html',
  });
  assert.equal(verifyProductionArtifact({ directory: f.directory, manifest: f.manifest, commit: COMMIT, requiredAssets: [MAP_FRAME] }), f.manifest);
  assert.equal((await verifyProductionRelease({ ...verification(f), requiredAssets: [MAP_FRAME] })).assets, 4);
  for (const patch of [
    asset => { delete asset.contentType; },
    asset => { asset.contentType = 'application/javascript'; },
    asset => { asset.path = MAP_FRAME_PATH; },
    asset => { asset.path = `${MAP_FRAME_PATH}?v=old`; },
    asset => { asset.path = `${MAP_FRAME}&extra=1`; },
    asset => { asset.path = `/assets/frames/other.html?v=${STAMP}`; },
  ]) {
    const manifest = structuredClone(f.manifest);
    patch(manifest.assets.find(asset => asset.path === MAP_FRAME));
    assert.throws(() => validateReleaseManifest(manifest, { commit: COMMIT }), /Invalid release (?:map frame metadata|asset digest)/u);
  }
  const missing = structuredClone(f.manifest);
  missing.assets = missing.assets.filter(asset => asset.path !== MAP_FRAME);
  assert.throws(() => validateReleaseManifest(missing, { commit: COMMIT, requiredAssets: [MAP_FRAME] }), /missing required release asset/u);
});

test('fixed map frame bytes and MIME cannot drift in artifact or public delivery', async t => {
  const changed = await mapFrameFixture(t);
  writeFileSync(changed.frameFile, '<!doctype html><title>Different frame</title>');
  assert.throws(() => verifyProductionArtifact({ directory: changed.directory, manifest: changed.manifest, commit: COMMIT }), /Artifact digest mismatch/u);
  await assert.rejects(verifyProductionRelease(verification(changed)), /Served asset mismatch/u);
  const wrongType = await mapFrameFixture(t, ({ url }) => url.pathname === MAP_FRAME_PATH
    ? { type: 'application/javascript', body: MAP_FRAME_HTML } : null);
  await assert.rejects(verifyProductionRelease(verification(wrongType)), /Served asset mismatch/u);
});

test('only the fixed map HTML may normalize via 301 or 308 to its exact same-origin clean stamped URL', async t => {
  for (const status of [301, 308]) {
    const f = await mapFrameFixture(t, ({ url }) => url.pathname === MAP_FRAME_PATH
      ? { status, headers: { Location: MAP_FRAME_CLEAN }, body: '' } : null);
    assert.equal((await verifyProductionRelease(verification(f))).assets, 4);
    assert.ok(f.requests.includes(MAP_FRAME_CLEAN));
  }
});

test('map HTML redirects reject changed status, origin, path, query, fragment and loops', async t => {
  for (const [status, destination] of [
    [302, MAP_FRAME_CLEAN], [303, MAP_FRAME_CLEAN], [307, MAP_FRAME_CLEAN],
    [301, `https://external.invalid${MAP_FRAME_CLEAN}`],
    [301, `/assets/frames/other?v=${STAMP}`],
    [301, '/assets/frames/contact-map?v=old'],
    [301, '/assets/frames/contact-map'],
    [301, `${MAP_FRAME_CLEAN}&extra=1`],
    [301, `${MAP_FRAME_CLEAN}#fragment`],
    [301, `${MAP_FRAME_CLEAN}#`],
    [301, `${MAP_FRAME_CLEAN}&v=${STAMP}`],
    [301, MAP_FRAME],
  ]) {
    const f = await mapFrameFixture(t, ({ url }) => url.pathname === MAP_FRAME_PATH
      ? { status, headers: { Location: destination }, body: '' } : null);
    await assert.rejects(verifyProductionRelease(verification(f)), /Served asset mismatch/u);
    assert.equal(f.requests.filter(request => request.startsWith('/assets/frames/')).length, 1, 'Reject before following any unapproved destination.');
  }
});

test('fixed map HTML normalization follows at most one hop and never accepts a clean-path redirect loop', async t => {
  const f = await mapFrameFixture(t, ({ url }) => {
    if (url.pathname === MAP_FRAME_PATH) return { status: 301, headers: { Location: MAP_FRAME_CLEAN }, body: '' };
    if (url.pathname === '/assets/frames/contact-map') return { status: 308, headers: { Location: MAP_FRAME }, body: '' };
    return null;
  });
  await assert.rejects(verifyProductionRelease(verification(f)), /Served asset mismatch/u);
  assert.deepEqual(f.requests.filter(request => request.startsWith('/assets/frames/')), [MAP_FRAME, MAP_FRAME_CLEAN]);
});

test('CI and manual preparation share maintained weather output URLs and the shell cache version', async t => {
  const f = await fixture(t);
  mkdirSync(path.join(f.directory, '3d-weather-codrops-main'));
  mkdirSync(path.join(f.directory, 'assets/js'), { recursive: true });
  writeFileSync(path.join(f.directory, '3d-weather-codrops-main/build-manifest.json'), JSON.stringify({
    entries: [{ source: 'src/loader.mjs', output: 'weather-widget.iife.js' }, { source: 'src/scene.mjs', output: 'Scene3D.mjs' }],
  }));
  writeFileSync(path.join(f.directory, 'assets/js/site-shell.js'), "const WEATHER_WIDGET_ASSET_VERSION = '20261104-weather-v7';\n");
  assert.deepEqual(resolveWeatherReleaseAssets(f.directory), [
    '/3d-weather-codrops-main/dist-widget/weather-widget.iife.js?v=20261104-weather-v7',
    '/3d-weather-codrops-main/dist-widget/Scene3D.mjs?v=20261104-weather-v7',
    '/3d-weather-codrops-main/dist-widget/assets/Moon/mission_2160p30_fallback.mp4?v=20261104-weather-v7',
    '/assets/js/contact-map.js?v=20261104-weather-v7',
    '/assets/frames/contact-map.html?v=20261104-weather-v7',
  ]);
  const runtimeRoot = path.join(f.directory, 'minified-runtime');
  mkdirSync(path.join(runtimeRoot, 'config'), { recursive: true });
  mkdirSync(path.join(runtimeRoot, 'assets/js'), { recursive: true });
  writeFileSync(path.join(runtimeRoot, 'config/deploy-asset-version.txt'), `${STAMP}\n`);
  writeFileSync(path.join(runtimeRoot, 'assets/js/site-shell.js'), `(()=>{const e="${STAMP}";window.fixtureVersion=e})();`);
  const runtimeAssets = resolveWeatherReleaseAssets(f.directory, runtimeRoot);
  assert.deepEqual(runtimeAssets, [
    `/3d-weather-codrops-main/dist-widget/weather-widget.iife.js?v=${STAMP}`,
    `/3d-weather-codrops-main/dist-widget/Scene3D.mjs?v=${STAMP}`,
    `${MOON_PATH}?v=${STAMP}`,
    `/assets/js/contact-map.js?v=${STAMP}`,
    MAP_FRAME,
  ]);
  assert.throws(() => validateReleaseManifest(f.manifest, {
    commit: COMMIT, requiredAssets: runtimeAssets.filter(asset => asset.startsWith('/assets/js/contact-map.js?')),
  }), /missing required release asset.*contact-map\.js/u);
  writeFileSync(path.join(f.directory, 'assets/js/site-shell.js'), 'const unrelated = true;');
  assert.throws(() => resolveWeatherReleaseAssets(f.directory), /Missing maintained weather module manifest or version/u);
});

test('weather receipt coverage includes generated vendors and public importers with the artifact stamp', async t => {
  const f = await fixture(t);
  mkdirSync(path.join(f.directory, '3d-weather-codrops-main'), { recursive: true });
  writeFileSync(path.join(f.directory, '3d-weather-codrops-main/build-manifest.json'), JSON.stringify({
    entries: [{ output: 'scene.mjs' }], vendorInputs: [{ file: 'vendor.mjs' }],
  }));
  writeFileSync(path.join(f.directory, 'assets/js/site-shell.js'), `const WEATHER_WIDGET_ASSET_VERSION="${STAMP}";`);
  writeFileSync(path.join(f.directory, 'assets/js/sun.js'), 'import "../../3d-weather-codrops-main/dist-widget/vendor.mjs?v=old";');
  const required = resolveWeatherReleaseAssets(f.directory, f.directory);
  assert.ok(required.includes(`/3d-weather-codrops-main/dist-widget/vendor.mjs?v=${STAMP}`));
  assert.ok(required.includes(`/assets/js/sun.js?v=${STAMP}`));
});

test('artifact and public verification reject a receipt missing a required generated vendor before any upload or network', async t => {
  const f = await fixture(t);
  const requiredAssets = [`/3d-weather-codrops-main/dist-widget/vendor.mjs?v=${STAMP}`];
  assert.throws(() => validateReleaseManifest(f.manifest, { commit: COMMIT, requiredAssets }), /missing required release asset/iu);
  assert.throws(() => verifyProductionArtifact({ directory: f.directory, manifest: f.manifest, commit: COMMIT, requiredAssets }), /missing required release asset/iu);
  let requests = 0;
  await assert.rejects(verifyProductionRelease({ ...verification(f), requiredAssets, fetcher: () => { requests++; throw Error('network should not start'); } }), /missing required release asset/iu);
  assert.equal(requests, 0);
});

test('a generated vendor covered by the receipt rejects digest drift in the artifact and the served response', async t => {
  const f = await fixture(t);
  const file = path.join(f.directory, 'weather/runtime.mjs');
  const requiredAssets = [WEATHER];
  assert.equal(verifyProductionArtifact({ directory: f.directory, manifest: f.manifest, commit: COMMIT, requiredAssets }), f.manifest);
  writeFileSync(file, 'export const oldVendor=true;');
  assert.throws(() => verifyProductionArtifact({ directory: f.directory, manifest: f.manifest, commit: COMMIT, requiredAssets }), /Artifact digest mismatch/u);
  await assert.rejects(verifyProductionRelease({ ...verification(f), requiredAssets }), /Served asset mismatch/u);
});

test('an English page with the wrong lang fails even when German and Russian are correct', async t => {
  const f = await fixture(t);
  const file = path.join(f.directory, 'en/index.html');
  writeFileSync(file, readFileSync(file, 'utf8').replace('lang="en"', 'lang="de"'));
  await assert.rejects(verifyProductionRelease(verification(f)), /en: incorrect or missing html lang/u);
});

test('an incorrect Ukrainian canonical fails instead of accepting any canonical tag', async t => {
  const f = await fixture(t);
  const file = path.join(f.directory, 'uk/index.html');
  writeFileSync(file, readFileSync(file, 'utf8').replace(`${PRODUCTION_ORIGIN}/uk/`, `${PRODUCTION_ORIGIN}/ru/`));
  await assert.rejects(verifyProductionRelease(verification(f)), /uk: incorrect or missing canonical/u);
});

test('stale HTML asset references fail before a cached older release can look successful', async t => {
  const f = await fixture(t);
  const file = path.join(f.directory, 'de/index.html');
  writeFileSync(file, readFileSync(file, 'utf8').replaceAll(STAMP, 'old-stamp'));
  await assert.rejects(verifyProductionRelease(verification(f)), /de: served asset references differ/u);
});

test('a successful asset response with stale content fails its digest', async t => {
  const f = await fixture(t, ({ url }) => url.pathname === '/assets/js/app.js'
    ? { type: 'application/javascript', body: 'console.log("stale");' } : null);
  await assert.rejects(verifyProductionRelease(verification(f)), /Served asset mismatch: \/assets\/js\/app.js/u);
});

test('redirected assets are rejected without following an unverified destination', async t => {
  for (const file of ['/assets/js/app.js', '/assets/css/app.css']) {
    for (const status of [301, 302, 308]) {
      const f = await fixture(t, ({ url }) => url.pathname === file
        ? { status, headers: { Location: '/unexpected/' }, body: '' } : null);
      await assert.rejects(verifyProductionRelease(verification(f)), /Served asset mismatch/u);
      assert.ok(!f.requests.includes('/unexpected/'));
    }
  }
});

test('a short stamp prefix cannot substitute another full commit', async t => {
  const otherCommit = COMMIT.slice(0, 7) + 'b'.repeat(33);
  const f = await fixture(t, ({ url, manifest }) => url.pathname === RELEASE_MANIFEST_PATH
    ? { body: { ...manifest, commit: otherCommit } } : null);
  await assert.rejects(verifyProductionRelease({ ...verification(f), manifest: undefined }), /full expected commit/u);
});

test('the public receipt cannot redefine the expected canonical domain', async t => {
  const f = await fixture(t, ({ url, manifest }) => url.pathname === RELEASE_MANIFEST_PATH
    ? { body: { ...manifest, canonicalOrigin: 'https://incorrect.example' } } : null);
  await assert.rejects(verifyProductionRelease({ ...verification(f), manifest: undefined }), /canonical origin mismatch/u);
});

test('a receipt cannot bless unversioned or differently stamped page asset URLs', async t => {
  const f = await fixture(t);
  const manifest = structuredClone(f.manifest);
  manifest.assets[0].path = manifest.assets[0].path.split('?')[0];
  manifest.locales.forEach(locale => { locale.assets[0] = locale.assets[0].split('?')[0]; });
  await assert.rejects(verifyProductionRelease({ ...verification(f), manifest }), /expected stamp/u);
  assert.equal(f.requests.length, 0);
});

test('independently pinned vendor CSS stays hash-verified while authored CSS requires the release stamp', async t => {
  const f = await fixture(t, () => null, { includeVendor: true });
  assert.ok(f.manifest.locales.every(locale => locale.assets.includes(VENDOR_STYLESHEET)));
  assert.ok(f.manifest.assets.some(asset => asset.path === VENDOR_STYLESHEET && /^[a-f0-9]{64}$/u.test(asset.sha256)));
  assert.equal((await verifyProductionRelease(verification(f))).assets, 4);
  assert.ok(f.requests.includes(VENDOR_STYLESHEET));

  const stale = structuredClone(f.manifest);
  const staleCore = STYLESHEET.replace(STAMP, 'older-release');
  stale.assets.find(asset => asset.path === STYLESHEET).path = staleCore;
  stale.locales.forEach(locale => { locale.assets = locale.assets.map(asset => asset === STYLESHEET ? staleCore : asset); });
  const requestsBefore = f.requests.length;
  await assert.rejects(verifyProductionRelease({ ...verification(f), manifest: stale }), /expected stamp/u);
  assert.equal(f.requests.length, requestsBefore);

  writeFileSync(path.join(f.directory, 'assets/fonts/fontawesome/all.min.css'), '.fa{font-family:ChangedVendor}\n');
  assert.throws(() => verifyProductionArtifact({ directory: f.directory, manifest: f.manifest, commit: COMMIT }), /Artifact digest mismatch/u);
  await assert.rejects(verifyProductionRelease(verification(f)), /Served asset mismatch: \/assets\/fonts\/fontawesome\/all.min.css/u);
});

test('bounded propagation retries wait for the expected manifest and then verify its bytes', async t => {
  let reads = 0;
  const f = await fixture(t, ({ url, manifest }) => url.pathname === RELEASE_MANIFEST_PATH && reads++ === 0
    ? { body: { ...manifest, commit: 'b'.repeat(40) } } : null);
  const pauses = [];
  const result = await verifyProductionRelease({ ...verification(f), attempts: 2, delayMs: 0, pause: async ms => pauses.push(ms) });
  assert.equal(result.attempts, 2);
  assert.deepEqual(pauses, [0]);
});

test('default retries accept the exact release after twelve transient unavailable manifest reads', async t => {
  let reads = 0;
  const f = await fixture(t, ({ url }) => url.pathname === RELEASE_MANIFEST_PATH && ++reads <= 12
    ? { status: 503, type: 'text/html', body: 'Temporarily unavailable' } : null);
  const pauses = [];
  const result = await verifyProductionRelease({
    commit: COMMIT, manifest: f.manifest, baseUrl: f.baseUrl, pause: async ms => pauses.push(ms),
  });
  assert.equal(result.attempts, 13);
  assert.equal(result.commit, COMMIT);
  assert.equal(result.stamp, STAMP);
  assert.equal(result.assets, 3);
  assert.deepEqual(result.locales, RELEASE_LOCALES);
  assert.equal(reads, 13);
  assert.deepEqual(pauses, Array(12).fill(5000));
  for (const asset of [SCRIPT, STYLESHEET, WEATHER]) assert.ok(f.requests.includes(asset));
});

test('persistent unavailable manifests stop at the default bound and report only HTTP diagnostics', async t => {
  const f = await fixture(t, ({ url }) => url.pathname === RELEASE_MANIFEST_PATH
    ? { status: 503, type: 'text/html; charset=utf-8', headers: { 'Set-Cookie': 'private-session=fixture-secret' }, body: 'private response body' } : null);
  const pauses = [];
  await assert.rejects(verifyProductionRelease({
    commit: COMMIT, manifest: f.manifest, baseUrl: f.baseUrl, pause: async ms => pauses.push(ms),
  }), error => {
    assert.match(error.message, /HTTP 503; Content-Type: text\/html; charset=utf-8; attempt 30\/30/u);
    assert.doesNotMatch(error.message, /private|fixture-secret|Set-Cookie/iu);
    return true;
  });
  assert.equal(f.requests.length, 30);
  assert.ok(f.requests.every(request => request === `${RELEASE_MANIFEST_PATH}?commit=${COMMIT}`));
  assert.deepEqual(pauses, Array(29).fill(5000));
});

for (const beforeServerAdmission of [false, true]) {
  test(`${beforeServerAdmission ? 'a stalled client before server admission' : 'a stalled server'} cannot exceed its bounded request budget`, { timeout: 2500 }, async t => {
    const f = await fixture(t, ({ url }) => url.pathname === RELEASE_MANIFEST_PATH ? { hang: true } : null);
    const clientAttempts = [];
    const maxDurationMs = 240;
    const started = Date.now();
    const fetcher = (url, options) => {
      clientAttempts.push({ url: url.href, signal: options.signal, startedAt: Date.now() });
      assert.ok(options.signal instanceof AbortSignal);
      if (!beforeServerAdmission) return fetch(url, options);
      // A closed admission gate models a request cancelled before the server can receive it.
      return new Promise((resolve, reject) => {
        const abort = () => reject(options.signal.reason);
        if (options.signal.aborted) abort();
        else options.signal.addEventListener('abort', abort, { once: true });
      });
    };
    await assert.rejects(verifyProductionRelease({
      ...verification(f), attempts: 2, delayMs: 0, timeoutMs: 80, maxDurationMs, fetcher,
    }), /verification failed/u);
    assert.ok(Date.now() - started < 1500);
    assert.ok(clientAttempts.length >= 1 && clientAttempts.length <= 2, `client attempts: ${clientAttempts.length}`);
    assert.ok(clientAttempts.every(attempt => attempt.url === new URL(`${RELEASE_MANIFEST_PATH}?commit=${COMMIT}`, f.baseUrl).href));
    assert.ok(clientAttempts.every(attempt => attempt.signal.aborted && attempt.signal.reason?.name === 'TimeoutError'));
    const firstAttemptAt = clientAttempts[0].startedAt;
    assert.ok(clientAttempts.every(attempt => attempt.startedAt - firstAttemptAt < maxDurationMs));
    const completedAttempts = clientAttempts.length;
    // The internal deadline starts before the first fetch, so this is beyond that deadline too.
    await new Promise(resolve => setTimeout(resolve, Math.max(1, firstAttemptAt + maxDurationMs + 1 - Date.now())));
    assert.equal(clientAttempts.length, completedAttempts, 'no request starts after the bounded verification has rejected');
    assert.ok(f.requests.length <= clientAttempts.length);
    if (beforeServerAdmission) assert.equal(f.requests.length, 0);
  });
}

test('ordinary live HTML smoke includes EN/UK and local assets without requiring a new release', async t => {
  const f = await fixture(t);
  const result = await verifyLocaleSmoke({ baseUrl: f.baseUrl });
  assert.deepEqual(result.locales, RELEASE_LOCALES);
  assert.equal(result.assets, 2);
  assert.ok(!f.requests.some(request => request.startsWith(RELEASE_MANIFEST_PATH)));
});

test('unsafe artifact paths are rejected before any HTTP request', async t => {
  const f = await fixture(t);
  const malformed = structuredClone(f.manifest);
  malformed.assets[0].path = '/../outside.js';
  await assert.rejects(verifyProductionRelease({ ...verification(f), manifest: malformed }), /Invalid release asset path/u);
  assert.equal(f.requests.length, 0);
});

test('production deploy requires exact-revision macOS WebKit while Linux retains the complete release gate', () => {
  const workflow = name => readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  const job = (source, name) => {
    const start = source.indexOf(`\n  ${name}:\n`);
    assert.notEqual(start, -1, `required workflow job ${name}`);
    return source.slice(start + 1).split(/\n(?=  [\w-]+:\n)/u)[0];
  };
  const ci = workflow('ci.yml');
  const release = workflow('cloudflare-pages.yml');
  const webkit = job(release, 'webkit');
  const deploy = job(release, 'deploy');
  assert.match(webkit, /^    runs-on: macos-latest$/mu);
  assert.equal(webkit.split('    permissions:\n')[1]?.split(/\n(?=    \S)/u)[0].trim(), 'contents: read');
  assert.doesNotMatch(webkit, /^    if:|continue-on-error|\$\{\{\s*secrets\.|BOOKING_SELECT_PHASES|--test-name-pattern/mu);
  assert.match(webkit, /^      BOOKING_SELECT_ENGINES: webkit$/mu);
  assert.match(webkit, /run: npm ci\n/u);
  assert.match(webkit, /run: npx --no-install playwright install webkit\n/u);
  assert.match(webkit, /run: node --test tools\/booking-select-refresh\.test\.mjs\n/u);
  const webkitSteps = webkit.split(/\n(?=      - )/u);
  const contacts = webkitSteps.find(step => step.includes('run: node tools/burger-menu-smoke.mjs'));
  assert.ok(contacts, 'native WebKit contacts regression remains required on every release path');
  assert.match(contacts, /BURGER_MENU_ENGINE: webkit/u);
  assert.match(contacts, /BURGER_MENU_CASE: ru-390-contacts-no-preference/u);
  assert.match(contacts, /BURGER_MENU_OUTPUT: output\/webkit-release-burger/u);
  assert.doesNotMatch(contacts, /\bif:|continue-on-error|always\(\)|BURGER_MENU_ROOT:/u);
  assert.ok(
    webkit.indexOf(contacts) > webkit.indexOf('run: node --test tools/booking-select-refresh.test.mjs'),
    'contacts regression follows the existing booking gate'
  );
  const mapLifecycle = webkitSteps.find(step => step.includes('run: node tools/contact-map-smoke.mjs'));
  assert.ok(mapLifecycle, 'WebKit map renderer lifecycle remains required on every release path');
  assert.match(mapLifecycle, /CONTACT_MAP_ENGINE: webkit/u);
  assert.doesNotMatch(mapLifecycle, /\bif:|continue-on-error|always\(\)/u);
  assert.ok(webkit.indexOf(mapLifecycle) > webkit.indexOf(contacts), 'map lifecycle follows native contacts');
  const fixtureUpload = webkitSteps.find(step => step.includes('uses: actions/upload-artifact@'));
  assert.ok(fixtureUpload, 'public WebKit evidence upload remains present');
  assert.ok(webkit.indexOf(mapLifecycle) < webkit.indexOf(fixtureUpload), 'map lifecycle precedes evidence upload');
  assert.match(fixtureUpload, /if: always\(\)/u);
  assert.match(fixtureUpload, /output\/webkit-release-check\//u);
  assert.match(fixtureUpload, /output\/webkit-release-burger\//u);
  const checkout = webkit.indexOf('uses: actions/checkout@');
  assert.ok(checkout > 0);
  for (const guard of [
    'test "$GITHUB_REF" = \'refs/heads/main\'',
    '[[ "$RELEASE_COMMIT" =~ ^[a-f0-9]{40}$ ]]',
    'test "$RELEASE_COMMIT" = "$GITHUB_SHA"',
    '[[ "$ARTIFACT_ID" =~ ^[0-9]+$ ]]',
  ]) {
    const position = webkit.indexOf(guard);
    assert.ok(position >= 0 && position < checkout, `${guard} must run before checkout`);
  }
  assert.match(webkit, /ref: \$\{\{ inputs\.release_commit \|\| github\.sha \}\}/u);
  assert.match(webkit, /persist-credentials: false/u);
  assert.match(deploy, /^    needs: webkit$/mu);
  assert.doesNotMatch(deploy, /^    if:|continue-on-error/mu);
  const caller = job(ci, 'deploy');
  assert.match(caller, /needs: \[validate-build, security\]/u);
  assert.match(caller, /uses: \.\/\.github\/workflows\/cloudflare-pages\.yml/u);
  for (const linux of [job(ci, 'validate-build'), deploy]) {
    assert.match(linux, /^    runs-on: ubuntu-latest$/mu);
    const qa = linux.split(/\n(?=      - )/u).find(step => step.includes('run: npm run qa:max'));
    assert.ok(qa, 'the complete Linux qa:max step remains required');
    assert.match(qa, /BOOKING_SELECT_ENGINES: chromium/u);
    assert.doesNotMatch(qa, /continue-on-error|always\(\)/u);
    assert.doesNotMatch(linux, /^      BOOKING_SELECT_ENGINES:/mu, 'engine selection is scoped to the QA step');
  }
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(manifest.scripts['qa:max'], /npm run test:browser/u);
  assert.match(manifest.scripts['test:browser'], /npm run test:booking-selects/u);
  assert.equal(manifest.scripts['test:contact-map'], 'node tools/contact-map-smoke.mjs');
  const browserChecks = manifest.scripts['test:browser'].split(' && ');
  for (const check of [
    'test:visual',
    'test:a11y',
    'test:burger-menu',
    'test:burger-menu:scroll',
    'test:social-media',
    'test:weather-forecast-render',
    'test:booking-selects',
    'test:contact-map',
  ]) {
    assert.ok(browserChecks.includes(`npm run ${check}`), `${check} remains in the complete browser gate`);
  }
  assert.doesNotMatch(manifest.scripts['qa:max'], /BOOKING_SELECT_ENGINES/u);
});
