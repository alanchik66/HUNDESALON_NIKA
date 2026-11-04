import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  PRODUCTION_ORIGIN, RELEASE_LOCALES, RELEASE_MANIFEST_PATH,
  prepareProductionRelease, verifyProductionArtifact, verifyProductionRelease, verifyLocaleSmoke,
  resolveWeatherReleaseAssets,
  parseWranglerPagesDeploymentOutput,
} from './lib/production-release-verification.mjs';

const COMMIT = 'a'.repeat(40);
const STAMP = `20261104-prod-${COMMIT.slice(0, 7)}-1234abcd`;
const SCRIPT = `/assets/js/app.js?v=${STAMP}`;
const STYLESHEET = `/assets/css/app.css?v=${STAMP}`;
const VENDOR_STYLESHEET = '/assets/fonts/fontawesome/all.min.css?v=20260329-0192';
const WEATHER = '/weather/runtime.mjs?v=weather-v6';
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

async function fixture(t, intercept = () => null, { includeVendor = false } = {}) {
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
  for (const locale of RELEASE_LOCALES) {
    writeFileSync(path.join(directory, locale, 'index.html'), `<!doctype html><html lang="${locale}"><head>
      <link href="${PRODUCTION_ORIGIN}/${locale}/" rel="canonical"><link rel="icon" href="/favicon.ico">
      <link href="${STYLESHEET}" rel="stylesheet"><script src="${SCRIPT}"></script>
      ${includeVendor ? `<link rel="stylesheet" href="${VENDOR_STYLESHEET}">` : ''}
      <script src="https://third-party.example/external.js"></script></head><body>${locale}</body></html>`);
  }
  const manifest = prepareProductionRelease({ directory, commit: COMMIT, extraAssets: [WEATHER] });
  const routes = new Map([
    [RELEASE_MANIFEST_PATH, path.join(directory, 'config/release-manifest.json')],
    ['/config/deploy-asset-version.txt', path.join(directory, 'config/deploy-asset-version.txt')],
    ['/assets/js/app.js', path.join(directory, 'assets/js/app.js')],
    ['/assets/css/app.css', path.join(directory, 'assets/css/app.css')],
    ['/weather/runtime.mjs', path.join(directory, 'weather/runtime.mjs')],
    ...RELEASE_LOCALES.map(locale => [`/${locale}/`, path.join(directory, locale, 'index.html')]),
  ]);
  if (includeVendor) routes.set('/assets/fonts/fontawesome/all.min.css', vendorFile);
  const requests = [];
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://fixture.invalid');
    requests.push(url.pathname + url.search);
    const overridden = intercept({ url, requests, manifest });
    if (overridden?.hang) return;
    if (overridden) {
      response.writeHead(overridden.status ?? 200, { 'Content-Type': overridden.type || 'application/json', ...overridden.headers });
      response.end(typeof overridden.body === 'string' ? overridden.body : JSON.stringify(overridden.body));
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
      const type = /\.html$/u.test(local) ? 'text/html' : /\.css$/u.test(local) ? 'text/css' : /\.m?js$/u.test(local) ? 'application/javascript' : /\.json$/u.test(local) ? 'application/json' : 'text/plain';
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
  return { directory, manifest, requests, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

const verification = f => ({ commit: COMMIT, manifest: f.manifest, baseUrl: f.baseUrl, attempts: 1 });

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
  ]);
  writeFileSync(path.join(f.directory, 'assets/js/site-shell.js'), 'const unrelated = true;');
  assert.throws(() => resolveWeatherReleaseAssets(f.directory), /Missing maintained weather module manifest or version/u);
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
  const f = await fixture(t, ({ url }) => url.pathname === '/assets/js/app.js'
    ? { status: 302, headers: { Location: '/unexpected/' }, body: '' } : null);
  await assert.rejects(verifyProductionRelease(verification(f)), /Served asset mismatch/u);
  assert.ok(!f.requests.includes('/unexpected/'));
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

test('a stalled server cannot keep verification running beyond its bounded request budget', async t => {
  const f = await fixture(t, ({ url }) => url.pathname === RELEASE_MANIFEST_PATH ? { hang: true } : null);
  const started = Date.now();
  await assert.rejects(verifyProductionRelease({ ...verification(f), attempts: 2, delayMs: 0, timeoutMs: 80, maxDurationMs: 240 }), /verification failed/u);
  assert.ok(Date.now() - started < 1500);
  assert.ok(f.requests.length >= 1 && f.requests.length <= 2);
});

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
