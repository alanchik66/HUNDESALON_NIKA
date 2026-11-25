import { pathToFileURL } from 'node:url';

const admin = 'https://admin.hundesalon-nika.com';
const apex = 'https://hundesalon-nika.com';
const pages = 'https://hundesalon-nika.pages.dev';
const team = 'https://hundesalon-nika.cloudflareaccess.com';
const adminHost = new URL(admin).hostname;
const loginPath = '/cdn-cgi/access/login/' + adminHost;
const visitorPath = '/ru/';
const protectedPaths = [
  '/admin/', '/api/admin/settings', '/api/admin/media', '/api/admin/session',
  '/assets/css/site-admin.css', '/assets/js/site-admin.js',
];
const directPaths = ['/admin', ...protectedPaths, '/api/admin/pages', '/api/admin/comparisons'];
const releaseStamp = /^20\d{6}-prod-[a-f0-9]{7,8}-[a-f0-9]{7,8}$/;
const maxPublicBytes = 512 * 1024;

function returnsTo(value, path) {
  return Boolean(value && URL.canParse(value, admin) && new URL(value, admin).href === admin + path);
}

function accessAudience(response, path) {
  const location = response.headers.get('location');
  if (response.status !== 302 || !location || location.length > 18000 || !URL.canParse(location)) return null;
  const url = new URL(location);
  if (
    url.origin !== team ||
    url.pathname !== loginPath ||
    url.username ||
    url.password ||
    url.hash ||
    [...url.searchParams.keys()].some(key =>
      /^(?:cf_authorization|cf-access-jwt-assertion|token|access_token|id_token)$/i.test(key)
    )
  ) {
    return null;
  }
  const parameters = ['kid', 'meta', 'redirect_url'].map(key => url.searchParams.getAll(key));
  if (parameters.some(values => values.length !== 1)) return null;
  const [[kid], [meta], [destination]] = parameters;
  if (!/^[a-zA-Z0-9_-]+$/.test(kid) || !returnsTo(destination, path)) return null;
  if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(meta)) return null;
  try {
    // Compare the audience announced by each redirect. These claims are diagnostic
    // only and are never used to authenticate a request.
    const [header, payload] = meta.split('.');
    const { alg } = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return alg === 'RS256' &&
      claims.type === 'meta' &&
      claims.hostname === adminHost &&
      returnsTo(claims.redirect_url, path) &&
      typeof claims.aud === 'string' &&
      /^[a-f0-9]{64}$/i.test(claims.aud)
      ? claims.aud
      : null;
  } catch {
    return null;
  }
}

async function visitorHtml(response) {
  if (
    response.status !== 200 ||
    !/^text\/html(?:\s*;|$)/i.test(response.headers.get('content-type') || '') ||
    !response.body
  ) {
    return '';
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let html = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return html + decoder.decode();
      size += value.byteLength;
      if (size > maxPublicBytes) return '';
      html += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

async function probe(request, origin, path, inspect) {
  let response;
  try {
    response = await request(origin + path, {
      method: 'GET',
      redirect: 'manual',
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    return { status: response.status, evidence: await inspect(response) };
  } catch {
    return { status: response?.status ?? null, evidence: null };
  } finally {
    await response?.body?.cancel().catch(() => {});
  }
}

export async function verifyHostedSiteAdmin({ request = fetch, expectedPublicRelease } = {}) {
  if (expectedPublicRelease !== undefined && !releaseStamp.test(expectedPublicRelease)) {
    throw new Error('Invalid expected public release');
  }

  const [protectedResponses, directResponses, publicResponse] = await Promise.all([
    Promise.all(
      protectedPaths.map(async path => ({
        path,
        ...(await probe(request, admin, path, response => accessAudience(response, path))),
      }))
    ),
    Promise.all(
      [apex, pages].flatMap(origin =>
        directPaths.map(async path => ({
          origin,
          path,
          ...(await probe(request, origin, path, response => response.status === 404 || response.status === 410)),
        }))
      )
    ),
    probe(request, apex, visitorPath, async response => {
      const html = await visitorHtml(response);
      const visitor =
        /<html\b[^>]*\blang=["']ru["']/i.test(html) &&
        /<main\b/i.test(html) &&
        /HUNDESALON[ _-]+NIKA/i.test(html) &&
        !/\bid=["'](?:login-form|console-title)["']/i.test(html);
      const releaseMatches = expectedPublicRelease === undefined || html.includes(expectedPublicRelease);
      return visitor && releaseMatches;
    }),
  ]);

  const sameAccessApplication =
    protectedResponses.every(entry => Boolean(entry.evidence)) &&
    new Set(protectedResponses.map(entry => entry.evidence)).size === 1;
  const adminChecks = protectedResponses.map(({ path, status, evidence }) => ({
    path,
    status,
    accessChallenge: Boolean(evidence),
  }));
  const directChecks = directResponses.map(({ origin, path, status, evidence }) => ({
    origin,
    path,
    status,
    blocked: evidence === true,
  }));
  const publicHome = {
    origin: apex,
    path: visitorPath,
    status: publicResponse.status,
    valid: publicResponse.evidence === true,
  };
  return {
    ok: sameAccessApplication && directChecks.every(entry => entry.blocked) && publicHome.valid,
    adminOrigin: admin,
    sameAccessApplication,
    adminChecks,
    directChecks,
    publicHome,
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    const args = process.argv.slice(2);
    const prefix = '--expect-public-release=';
    if (args.length > 1 || (args.length === 1 && !args[0].startsWith(prefix))) throw new Error('Invalid arguments');
    const report = await verifyHostedSiteAdmin({ expectedPublicRelease: args[0]?.slice(prefix.length) });
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
  } catch {
    console.error('Usage: node tools/verify-hosted-site-admin.mjs [--expect-public-release=BUILD_ID]');
    process.exitCode = 2;
  }
}
