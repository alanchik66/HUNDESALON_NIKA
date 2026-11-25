import { spawn } from 'node:child_process';
import { access, mkdir, realpath, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const instance = path.join(root, 'output', 'local-site-admin');
const runtime = path.join(instance, 'runtime');
const cli = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const db = 'f5c3ffe4-824a-4c24-838b-282349991f70';
const host = '127.0.0.1';
const port = '8796';

// The isolated Pages configuration has no remote bindings or account credentials.
async function prepare() {
  await access(path.join(root, 'dist', 'index.html'));
  await mkdir(runtime, { recursive: true });
  // Pages finds the nearest package.json when choosing where to load its runtime configuration.
  await writeFile(path.join(runtime, 'package.json'), '{"private":true}\n');
  for (const name of ['functions', 'migrations']) {
    const target = path.join(root, name);
    const junction = path.join(runtime, name);
    try {
      await symlink(target, junction, 'junction');
    } catch (error) {
      if (error.code !== 'EEXIST' || await realpath(junction) !== await realpath(target)) throw error;
    }
  }
  const binding = [
    'binding = "CHAT_DB"', 'database_name = "nika-owner-offline"',
    `database_id = "${db}"`, `preview_database_id = "${db}"`,
  ].join('\n');
  await writeFile(path.join(runtime, 'wrangler.toml'), [
    'name = "nika-owner-offline"', 'pages_build_output_dir = "../../../dist"',
    'compatibility_date = "2026-08-08"', 'compatibility_flags = ["nodejs_compat", "global_fetch_strictly_public"]',
    '[[d1_databases]]', binding, '[[env.preview.d1_databases]]', binding,
    '[env.preview.vars]', 'PAYMENTS_ONLINE_ENABLED = "false"', '',
  ].join('\n'));
}

function run(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: runtime, env, windowsHide: true, stdio: 'ignore',
    });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error('Wrangler failed')));
  });
}

let stage = 'prepare';
try {
  let key = '';
  for await (const chunk of process.stdin) key += chunk;
  key = key.trim();
  if (!/^[a-zA-Z0-9+/]{43}=$/.test(key)) throw new Error('Invalid local credential');
  await prepare();
  const env = {};
  for (const name of ['PATH', 'SystemRoot', 'WINDIR', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'TEMP', 'TMP', 'SystemDrive', 'ComSpec', 'PATHEXT', 'OS', 'PROCESSOR_ARCHITECTURE']) {
    if (process.env[name]) env[name] = process.env[name];
  }
  env.WRANGLER_SEND_METRICS = 'false';
  env.WRANGLER_LOG = 'error';
  env.WRANGLER_LOG_SANITIZE = 'true';
  env.WRANGLER_LOG_PATH = path.join(instance, 'logs');
  const state = ['--persist-to', path.join(instance, 'd1')];
  stage = 'migration';
  await run(['d1', 'migrations', 'apply', 'CHAT_DB', '--local', ...state], env);
  stage = 'serve';
  // Wrangler reads this value as a secret from the child environment, never from a CLI argument.
  await run([
    'pages', 'dev', path.join(root, 'dist'), '--d1', 'CHAT_DB=' + db,
    '--ip', host, '--port', port, '--inspector-port', '0', ...state, '--log-level', 'error',
  ], { ...env, CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true', SITE_ADMIN_KEY: key });
} catch {
  await writeFile(path.join(instance, 'last-error.txt'), stage + '\n');
  process.exitCode = 1;
}
