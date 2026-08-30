import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const MAX_PAGES_FILE_BYTES = 24 * 1024 * 1024;

const VERSIONED_ASSET_EXTENSIONS = new Set(['.css', '.js']);
const LOCAL_ASSET_REFERENCE =
  /((?:src|href)=["'](?:\/|(?:\.\.?\/)*)assets\/(?:css|js)\/[^"'?]+\.(?:css|js))(?:\?[^"']*)?(["'])/gi;

const PRODUCTION_MINIFY_ASSETS = [
  'assets/css/style.css',
  'assets/css/page-modules.css',
  'assets/js/site-shell.js',
  'assets/js/main.js',
  'assets/js/page-modules.js',
  'assets/js/tooltip.js',
  'assets/js/newsletter.js',
  'assets/js/sendpulse-integrations.js',
  'assets/css/ai-chat.css',
  'assets/js/ai-chat.js',
  'assets/js/testimonials.js',
];

const SKIP_RELATIVE_PATHS = new Set([
  '3d-weather-codrops-main/dist-widget/assets/Moon/Moon_NASA_LRO_23k_Topo.usdz',
  '3d-weather-codrops-main/dist-widget/assets/Moon/mission_2160p30.mp4',
  '3d-weather-codrops-main/dist-widget/assets/Moon/mission_720p30.mp4',
  '3d-weather-codrops-main/dist-widget/assets/Moon/moon_texture_23k.png',
  '3d-weather-codrops-main/dist-widget/assets/Moon/moon_texture_web.png',
]);

const copyEntries = [
  'index.html',
  '404.html',
  'telegram-menu.html',
  'assets',
  'config',
  'data',
  'de',
  'en',
  'ru',
  'uk',
  'functions',
  '3d-weather-codrops-main/dist-widget',
  '.well-known',
  '_headers',
  '_redirects',
  'robots.txt',
  'llms.txt',
  'sitemap.xml',
  'sitemap-brand.xml',
  'indexnow-key.txt',
  'favicon.ico',
  'site.webmanifest',
  'sw.js',
  'browserconfig.xml',
  'BingSiteAuth.xml',
];

function copyRecursive(source, target) {
  if (!fs.existsSync(source)) return;

  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      copyRecursive(path.join(source, entry), path.join(target, entry));
    }
    return;
  }

  const relativeSource = path.relative(root, source).replaceAll('\\', '/');
  if (SKIP_RELATIVE_PATHS.has(relativeSource)) {
    return;
  }

  if (stat.size > MAX_PAGES_FILE_BYTES) {
    console.warn(
      `Skipped oversized file for Pages deploy: ${relativeSource} (${Math.round(stat.size / (1024 * 1024))} MB)`
    );
    return;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function ensureLeafletVendorBundle() {
  const vendorJs = path.join(root, 'assets/vendor/leaflet/1.9.4/leaflet.js');
  const sourceJs = path.join(root, 'node_modules/leaflet/dist/leaflet.js');
  if (fs.existsSync(vendorJs) || !fs.existsSync(sourceJs)) {
    return;
  }

  const vendorDir = path.join(root, 'assets/vendor/leaflet/1.9.4');
  const sourceDir = path.join(root, 'node_modules/leaflet/dist');
  fs.mkdirSync(path.join(vendorDir, 'images'), { recursive: true });
  for (const fileName of ['leaflet.css', 'leaflet.js']) {
    fs.copyFileSync(path.join(sourceDir, fileName), path.join(vendorDir, fileName));
  }
  for (const imageName of fs.readdirSync(path.join(sourceDir, 'images'))) {
    fs.copyFileSync(path.join(sourceDir, 'images', imageName), path.join(vendorDir, 'images', imageName));
  }
  console.log('Copied Leaflet vendor assets from node_modules.');
}

function emptyDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
  for (const entry of fs.readdirSync(directory)) {
    fs.rmSync(path.join(directory, entry), {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 250,
    });
  }
}

function assertNoSecretArtifacts(directory) {
  const forbiddenName = /(?:^|\/)(?:\.dev\.vars(?:\.|$)|.*\.token$|__dev_service_gateway_key\.txt$|\.cloudflare-.*)$/i;
  const forbiddenContent = /(?:SERVICE_GATEWAY_API_KEY|CLOUDFLARE_API_TOKEN)\s*=/;

  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      const relativePath = path.relative(directory, fullPath).replaceAll('\\', '/');
      if (forbiddenName.test(relativePath)) {
        throw new Error(`Refusing production build: secret-like artifact found in dist/${relativePath}`);
      }
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry.isFile() && fs.statSync(fullPath).size <= 2 * 1024 * 1024) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (forbiddenContent.test(content)) {
          throw new Error(`Refusing production build: secret assignment found in dist/${relativePath}`);
        }
      }
    }
  }

  walk(directory);
}

ensureLeafletVendorBundle();

emptyDirectory(dist);

for (const entry of copyEntries) {
  copyRecursive(path.join(root, entry), path.join(dist, entry));
}

function minifyProductionAssets(directory) {
  for (const relativePath of PRODUCTION_MINIFY_ASSETS) {
    const target = path.join(directory, relativePath);
    if (!fs.existsSync(target)) continue;
    const loader = path.extname(target).toLowerCase() === '.css' ? 'css' : 'js';
    const source = fs.readFileSync(target, 'utf8');
    const result = transformSync(source, {
      loader,
      minify: true,
      legalComments: 'none',
      sourcefile: relativePath,
    });
    fs.writeFileSync(target, result.code, 'utf8');
  }
}

minifyProductionAssets(dist);

function deployAssetVersion() {
  if (process.env.DEPLOY_ASSET_VERSION?.trim()) {
    return process.env.DEPLOY_ASSET_VERSION.trim();
  }
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const files = [];

  function collect(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        collect(fullPath);
      } else if (entry.isFile() && VERSIONED_ASSET_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        files.push(fullPath);
      }
    }
  }

  collect(path.join(dist, 'assets'));
  const contentHash = createHash('sha256');
  for (const file of files.sort()) {
    contentHash.update(path.relative(dist, file).replaceAll('\\', '/'));
    contentHash.update(fs.readFileSync(file));
  }
  const digest = contentHash.digest('hex').slice(0, 8);

  try {
    const hash = execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim();
    return `${date}-prod-${hash}-${digest}`;
  } catch {
    return `${date}-prod-${digest}`;
  }
}

function stampDistAssetVersions(directory, version) {
  let htmlFiles = 0;

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.name.endsWith('.html')) continue;

      const original = fs.readFileSync(fullPath, 'utf8');
      let next = original.replace(LOCAL_ASSET_REFERENCE, `$1?v=${version}$2`);
      // CSP blocks inline onload handlers, leaving deferred stylesheets stuck at media="print".
      next = next.replace(/\s+media="print"\s+onload="this\.media\s*=\s*'all'"/g, '');
      if (next !== original) {
        fs.writeFileSync(fullPath, next, 'utf8');
        htmlFiles += 1;
      }
    }
  }

  walk(directory);
  fs.mkdirSync(path.join(directory, 'config'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'config', 'deploy-asset-version.txt'), `${version}\n`, 'utf8');
  return htmlFiles;
}

function assertLocalAssetVersions(directory, version) {
  const invalid = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.name.endsWith('.html')) continue;

      const html = fs.readFileSync(fullPath, 'utf8');
      const pattern = new RegExp(LOCAL_ASSET_REFERENCE.source, LOCAL_ASSET_REFERENCE.flags);
      for (const match of html.matchAll(pattern)) {
        if (!match[0].includes(`?v=${version}`)) {
          invalid.push(`${path.relative(directory, fullPath).replaceAll('\\', '/')}: ${match[0]}`);
        }
      }
    }
  }

  walk(directory);
  if (invalid.length > 0) {
    throw new Error(`Unversioned local JS/CSS references in production build:\n${invalid.join('\n')}`);
  }
}

function normalizePublicContact(directory) {
  let htmlFiles = 0;

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.name.endsWith('.html')) continue;
      const original = fs.readFileSync(fullPath, 'utf8');
      const next = original.replaceAll('info@hundesalon-nika.com', 'support@hundesalon-nika.com');
      if (next !== original) {
        fs.writeFileSync(fullPath, next, 'utf8');
        htmlFiles += 1;
      }
    }
  }

  walk(directory);
  return htmlFiles;
}

function deferNonCriticalScripts(directory, version) {
  let htmlFiles = 0;
  const scriptPattern = /\s*<script\s+src="[^"]*(?:newsletter|testimonials|tooltip)\.js\?[^"\s]+"[^>]*><\/script>/g;

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.name.endsWith('.html')) continue;
      const original = fs.readFileSync(fullPath, 'utf8');
      if (!scriptPattern.test(original)) {
        scriptPattern.lastIndex = 0;
        continue;
      }
      scriptPattern.lastIndex = 0;
      const prefix = path.relative(path.dirname(fullPath), path.join(directory, 'assets/js')).replaceAll('\\', '/');
      const loader = `\n<script src="${prefix}/non-critical-loader.js?v=${version}"></script>`;
      const next = original.replace(scriptPattern, '').replace('</body>', `${loader}\n</body>`);
      if (next !== original) {
        fs.writeFileSync(fullPath, next, 'utf8');
        htmlFiles += 1;
      }
    }
  }

  walk(directory);
  return htmlFiles;
}

function injectSendPulseIntegrations(directory, version) {
  let htmlFiles = 0;
  const integrationScriptPattern = /\s*<script\s+src="[^"]*sendpulse-integrations\.js\?[^"\s]+"[^>]*><\/script>/g;
  const aiChatScriptPattern = /\s*<script\s+src="[^"]*ai-chat\.js\?[^"\s]+"[^>]*><\/script>/g;
  const aiChatStylePattern = /\s*<link\s+[^>]*href="[^"]*ai-chat\.css\?[^"\s]+"[^>]*>/g;
  const liveChatScriptPattern = /\s*<script\s+src="https:\/\/cdn\.pulse\.is\/livechat\/loader\.js"[^>]*><\/script>/g;
  const popupScriptPattern = /\s*<script\s+src="https:\/\/static\.sppopups\.com\/assets\/loader\.js"[^>]*><\/script>/g;

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.name.endsWith('.html')) continue;

      const relativePath = path.relative(directory, fullPath).replaceAll('\\', '/');
      if (relativePath === 'telegram-menu.html') continue;

      const original = fs.readFileSync(fullPath, 'utf8');
      const cleaned = original
        .replace(integrationScriptPattern, '')
        .replace(aiChatScriptPattern, '')
        .replace(aiChatStylePattern, '')
        .replace(liveChatScriptPattern, '')
        .replace(popupScriptPattern, '');

      const scriptPrefix = path
        .relative(path.dirname(fullPath), path.join(directory, 'assets/js'))
        .replaceAll('\\', '/');
      const stylePrefix = path
        .relative(path.dirname(fullPath), path.join(directory, 'assets/css'))
        .replaceAll('\\', '/');
      const stylesheet = `<link rel="stylesheet" href="${stylePrefix}/ai-chat.css?v=${version}">`;
      const loaders = [
        `<script src="${scriptPrefix}/sendpulse-integrations.js?v=${version}"></script>`,
        `<script src="${scriptPrefix}/ai-chat.js?v=${version}"></script>`,
      ].join('\n');
      const next = cleaned.replace('</head>', `${stylesheet}\n</head>`).replace('</body>', `\n${loaders}\n</body>`);
      if (next !== original) {
        fs.writeFileSync(fullPath, next, 'utf8');
        htmlFiles += 1;
      }
    }
  }

  walk(directory);
  return htmlFiles;
}

const assetVersion = deployAssetVersion();
const stamped = stampDistAssetVersions(dist, assetVersion);
assertNoSecretArtifacts(dist);
const publicContactFiles = normalizePublicContact(dist);
const deferredScriptFiles = deferNonCriticalScripts(dist, assetVersion);
const sendPulseFiles = injectSendPulseIntegrations(dist, assetVersion);
assertLocalAssetVersions(dist, assetVersion);

console.log('Production bundle created in dist/.');
console.log(`Asset cache version: ${assetVersion} (${stamped} HTML files stamped).`);
console.log(`Public contact normalized in ${publicContactFiles} HTML files.`);
console.log(`Deferred non-critical scripts in ${deferredScriptFiles} HTML files.`);
console.log(`Injected SendPulse integrations in ${sendPulseFiles} HTML files.`);
