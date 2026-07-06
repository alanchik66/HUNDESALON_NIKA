/**
 * Full AI-agent environment: GCP impersonation, Cloudflare token, IDE terminals, MCP, WIF.
 * npm run agents:setup
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadAllCredentials } from './lib/cf-api-token.mjs';

const ROOT = process.cwd();
const PROJECT_ID = 'hundesalon-nika-shell-2026';
const REGION = 'europe-west3';
const ACCOUNT_ID = '25e872aeab8cb246c69142ab07cd0fee';
const SERVICE_ACCOUNT = `ai-agents-admin@${PROJECT_ID}.iam.gserviceaccount.com`;

const AGENT_ENV = {
  GOOGLE_CLOUD_PROJECT: PROJECT_ID,
  GCP_PROJECT: PROJECT_ID,
  CLOUDSDK_CORE_PROJECT: PROJECT_ID,
  CLOUDSDK_COMPUTE_REGION: REGION,
  GOOGLE_AUTH_IMPERSONATE_SERVICE_ACCOUNT: SERVICE_ACCOUNT,
  CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID,
};

function runPwsh(script, args = []) {
  const result = spawnSync(
    'pwsh',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...args],
    { cwd: ROOT, encoding: 'utf8', shell: false }
  );
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `pwsh failed: ${script}`).trim());
  }
  return (result.stdout || '').trim();
}

function runNode(script) {
  const result = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `node failed: ${script}`).trim());
  }
}

function setWindowsUserEnv(key, value) {
  const safe = String(value).replace(/'/g, "''");
  spawnSync(
    'pwsh',
    ['-NoProfile', '-Command', `[Environment]::SetEnvironmentVariable('${key}', '${safe}', 'User')`],
    { encoding: 'utf8' }
  );
}

function clearWindowsUserEnv(key) {
  spawnSync(
    'pwsh',
    ['-NoProfile', '-Command', `[Environment]::SetEnvironmentVariable('${key}', $null, 'User')`],
    { encoding: 'utf8' }
  );
}

function syncUserEnv() {
  for (const [key, value] of Object.entries(AGENT_ENV)) {
    setWindowsUserEnv(key, value);
  }
  clearWindowsUserEnv('GOOGLE_APPLICATION_CREDENTIALS');

  loadAllCredentials();
  const cfToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (cfToken) {
    setWindowsUserEnv('CLOUDFLARE_API_TOKEN', cfToken);
  }
}

function upsertJsonBlock(filePath, key, block) {
  const raw = existsSync(filePath) ? readFileSync(filePath, 'utf8') : '{}';
  const data = JSON.parse(raw);
  data[key] = { ...(data[key] || {}), ...block };
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function configureVsCodeTerminalEnv() {
  const filePath = join(ROOT, '.vscode', 'settings.json');
  const raw = readFileSync(filePath, 'utf8');
  const marker = '// ─── AI Agents: GCP + Cloudflare env (auto) ───';
  const envBlock = `${marker}
  "terminal.integrated.env.windows": ${JSON.stringify(AGENT_ENV, null, 2).replace(/\n/g, '\n  ')},`;

  let next;
  if (raw.includes('"terminal.integrated.env.windows"')) {
    next = raw.replace(
      /\/\/ ─── AI Agents: GCP \+ Cloudflare env \(auto\) ───[\s\S]*?"terminal\.integrated\.env\.windows":\s*\{[\s\S]*?\},/m,
      envBlock.trimEnd() + ','
    );
  } else {
    next = raw.replace(
      /("terminal\.integrated\.defaultProfile\.windows":\s*"PowerShell",)/,
      `$1\n\n  ${envBlock}`
    );
  }
  writeFileSync(filePath, next, 'utf8');
  return filePath;
}

function configureDevinLocal() {
  const filePath = join(homedir(), '.devin', 'config.local.json');
  const data = existsSync(filePath) ? JSON.parse(readFileSync(filePath, 'utf8')) : { version: 1 };

  data.workspace = {
    ...(data.workspace || {}),
    name: 'HUNDESALON_NIKA Google-Shell',
    root: 'C:\\PROJEKT\\HUNDESALON_NIKA',
    googleCloudProject: PROJECT_ID,
    googleCloudRegion: REGION,
    googleCloudServiceAccount: SERVICE_ACCOUNT,
    cloudflareAccountId: ACCOUNT_ID,
    authMode: 'gcloud-impersonation',
  };

  const allow = new Set(data.permissions?.allow || []);
  [
    'Exec(gcloud config list)',
    'Exec(gcloud projects describe)',
    'Exec(gcloud run services list)',
    'Exec(gcloud run services describe)',
    'Exec(gcloud storage ls)',
    'Exec(npm run google:setup-agents)',
    'Exec(npm run agents:setup)',
    'Exec(npm run cf:ensure-api-token)',
    'Exec(npm run mcp:configure)',
    'Exec(npm run deploy)',
    'Exec(wrangler pages deploy)',
  ].forEach((item) => allow.add(item));

  data.permissions = {
    ...(data.permissions || {}),
    allow: [...allow],
  };

  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return filePath;
}

function main() {
  console.log('HUNDESALON — full AI agents environment setup\n');

  console.log('1/6 GCP impersonation (gcloud profile + ADC)...');
  runPwsh(join(ROOT, 'tools', 'setup-ai-agents-gcp.ps1'), ['-SkipAdcLogin']);

  console.log('2/6 Windows user env vars (GCP + Cloudflare)...');
  syncUserEnv();
  console.log('     User env synced.');

  console.log('3/6 VS Code / Cursor terminal env...');
  console.log(`     ${configureVsCodeTerminalEnv()}`);

  console.log('4/6 Devin local config...');
  console.log(`     ${configureDevinLocal()}`);

  console.log('5/6 MCP clients + Workload Identity Federation...');
  runNode(join(ROOT, 'tools', 'configure-mcp-clients.mjs'));
  runNode(join(ROOT, 'tools', 'setup-gcp-workload-identity.mjs'));

  console.log('6/6 Reload IDE windows...');
  runPwsh(join(ROOT, 'tools', 'reload-agent-ides.ps1'));

  console.log('\nAll agent environments configured.');
  console.log('  Local:  gcloud impersonation + ADC');
  console.log('  Remote: WIF pool ai-agents-pool (GitHub OIDC)');
  console.log('  DNS:    CLOUDFLARE_API_TOKEN from .dev.vars');
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
