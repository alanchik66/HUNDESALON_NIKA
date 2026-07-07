/**
 * Runs npm without Grok/WebStorm ACP env noise (min-release-age warning).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

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
    const candidates = [join(dirname(process.execPath), 'npm.cmd'), 'C:\\Program Files\\nodejs\\npm.cmd', 'npm.cmd'];
    for (const candidate of candidates) {
      if (candidate === 'npm.cmd' || existsSync(candidate)) return candidate;
    }
  }
  return 'npm';
}

const npmCmd = resolveNpmCmd();
let result;
if (process.platform === 'win32') {
  const npmCliCandidates = [
    join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    'C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js',
  ];
  const npmCli = npmCliCandidates.find(candidate => candidate === npmCliCandidates[1] || existsSync(candidate));
  result = spawnSync(process.execPath, [npmCli || npmCmd, ...args], {
    stdio: 'inherit',
    env,
    shell: false,
  });
} else {
  result = spawnSync(npmCmd, args, {
    stdio: 'inherit',
    env,
    shell: false,
  });
}

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
