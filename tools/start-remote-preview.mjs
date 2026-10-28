import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'output/local-preview');
await mkdir(output, { recursive: true });
const configFile = path.join(output, 'remote-config.json');
try {
  await writeFile(configFile, JSON.stringify({ key: randomBytes(32).toString('base64url') }), {
    mode: 0o600,
    flag: 'wx',
  });
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
}
const config = JSON.parse(await readFile(configFile, 'utf8'));
if (!/^[A-Za-z0-9_-]{43}$/.test(config.key || '')) throw new Error('Invalid local preview access key.');
const emailIndex = process.argv.indexOf('--email');
const requestedEmail = emailIndex < 0 ? null : process.argv[emailIndex + 1];
const publicReadOnly = process.argv.includes('--public-read-only');
if (emailIndex >= 0 && !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(requestedEmail || ''))
  throw new Error('A valid access email is required.');
const probe = async () => {
  try {
    const response = await fetch('http://127.0.0.1:5514/__preview_health', { signal: AbortSignal.timeout(2000) });
    const state = await response.json();
    return state.project === 'HUNDESALON_NIKA' && state.role === 'remote-preview' ? state : null;
  } catch {
    return null;
  }
};
if (process.argv.includes('--stop')) {
  const response = await fetch('http://127.0.0.1:5514/__preview_stop', {
    method: 'POST',
    headers: { 'X-Preview-Admin': config.key },
  });
  if (!response.ok) throw new Error(`Stop failed: ${response.status}`);
  console.log('Remote preview stopped.');
  process.exit(0);
}
let state = await probe();
if (
  (requestedEmail && (requestedEmail !== config.allowedEmail || config.publicReadOnly)) ||
  (publicReadOnly && !config.publicReadOnly)
) {
  if (state) {
    const response = await fetch('http://127.0.0.1:5514/__preview_stop', {
      method: 'POST',
      headers: { 'X-Preview-Admin': config.key },
    });
    if (!response.ok) throw new Error('Existing preview could not be stopped safely.');
    for (let attempt = 0; attempt < 30 && (await probe()); attempt++)
      await new Promise(resolve => setTimeout(resolve, 200));
    if (await probe()) throw new Error('Existing preview is still stopping.');
  }
  config.allowedEmail = publicReadOnly ? null : requestedEmail;
  config.publicReadOnly = publicReadOnly;
  await writeFile(configFile, JSON.stringify(config), { mode: 0o600 });
  state = null;
}
if (!state) {
  const binary = path.join(output, 'cloudflared.exe');
  if (!existsSync(binary)) {
    const releaseResponse = await fetch('https://api.github.com/repos/cloudflare/cloudflared/releases/latest', {
      headers: { 'User-Agent': 'HUNDESALON-NIKA-local-preview' },
    });
    if (!releaseResponse.ok) throw new Error(`Cloudflare release lookup failed: ${releaseResponse.status}`);
    const release = await releaseResponse.json();
    const asset = release.assets.find(item => item.name === 'cloudflared-windows-amd64.exe');
    if (!asset) throw new Error('Official Cloudflare Windows binary was not found.');
    const response = await fetch(asset.browser_download_url);
    if (!response.ok) throw new Error(`Cloudflare download failed: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    if (asset.digest && digest !== asset.digest) throw new Error('Official binary checksum mismatch.');
    await writeFile(binary, bytes);
    await writeFile(
      path.join(output, 'cloudflared-release.json'),
      JSON.stringify(
        { version: release.tag_name, source: asset.browser_download_url, digest, officialDigest: asset.digest || null },
        null,
        2
      )
    );
  }
  const command = `"${process.execPath}" "${path.join(root, 'tools/dev-remote-preview.mjs')}"`;
  const vbs = text => `"${text.replaceAll('"', '""')}"`;
  const launcher = path.join(output, 'remote-preview.vbs');
  await writeFile(
    launcher,
    `Set previewShell = CreateObject("WScript.Shell")\r\npreviewShell.CurrentDirectory = ${vbs(root)}\r\nDo\r\n  previewExit = previewShell.Run(${vbs(command)}, 0, True)\r\n  If previewExit = 23 Then Exit Do\r\n  WScript.Sleep 3000\r\nLoop\r\n`
  );
  const child = spawn(
    path.join(process.env.SystemRoot || 'C:/Windows', 'System32/wscript.exe'),
    ['//B', '//NoLogo', launcher],
    { cwd: root, windowsHide: true, detached: true, stdio: 'ignore' }
  );
  await new Promise((resolve, reject) => {
    child.once('spawn', resolve);
    child.once('error', reject);
  });
  child.unref();
}
for (let attempt = 0; attempt < 120; attempt++) {
  state = await probe();
  if (state?.publicUrl) break;
  await new Promise(resolve => setTimeout(resolve, 500));
}
if (!state?.publicUrl) throw new Error('Tunnel URL is not ready; inspect output/local-preview/tunnel.log.');
const url =
  config.allowedEmail || config.publicReadOnly
    ? `${state.publicUrl}/ru/prays-list.html`
    : `${state.publicUrl}/__preview_login?key=${config.key}`;
await writeFile(
  path.join(output, 'iphone-link.json'),
  JSON.stringify({ url, publicUrl: state.publicUrl, updatedAt: new Date().toISOString() }, null, 2),
  { mode: 0o600 }
);
console.log(JSON.stringify({ url, pid: state.pid }, null, 2));
