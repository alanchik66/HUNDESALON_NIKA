/**
 * Runs npm without Grok/WebStorm ACP env noise (min-release-age warning).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node tools/run-npm-quiet.mjs <npm-args...>');
  process.exit(1);
}

const env = { ...process.env };
delete env.NPM_CONFIG_MIN_RELEASE_AGE;
delete env.npm_config_min_release_age;

function resolveNpmCmd() {
  if (process.platform === 'win32') {
    const candidates = [
      join(dirname(process.execPath), 'npm.cmd'),
      'C:\\Program Files\\nodejs\\npm.cmd',
      'npm.cmd',
    ];
    for (const candidate of candidates) {
      if (candidate === 'npm.cmd' || existsSync(candidate)) return candidate;
    }
  }
  return 'npm';
}

const npmCmd = resolveNpmCmd();
const result = spawnSync(npmCmd, args, {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
