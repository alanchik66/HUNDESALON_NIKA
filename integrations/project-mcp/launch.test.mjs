import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('Windows startup pins its toolchain, retries failed installs and accepts native stderr only on success', { skip: process.platform !== 'win32' }, async t => {
  const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'nika mcp launch-')));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const commit = '1'.repeat(40);
  const cache = path.join(directory, 'devin-project-mcp', commit);
  const sdk = path.join(cache, 'node_modules', '@modelcontextprotocol', 'sdk');
  const node = path.join(directory, 'devin-node', 'node-v24.16.0-win-x64', 'node.exe');
  const npm = path.join(directory, 'devin-node', 'npm-11.17.0', 'node_modules', 'npm', 'bin', 'npm-cli.js');
  await fs.mkdir(sdk, { recursive: true });
  await fs.mkdir(path.dirname(node), { recursive: true });
  await fs.mkdir(path.dirname(npm), { recursive: true });
  await fs.mkdir(path.join(directory, 'repos', 'HUNDESALON_NIKA'), { recursive: true });
  await fs.link(process.execPath, node).catch(() => fs.copyFile(process.execPath, node));
  await fs.writeFile(path.join(directory, '.node-version'), '26.0.0');
  await fs.writeFile(path.join(directory, 'package.json'), '{"packageManager":"npm@99.0.0"}');
  await fs.writeFile(path.join(sdk, 'package.json'), '{}');
  const marker = path.join(cache, '.installed-lock.sha256');
  const hash = createHash('sha256').update('{}\n').digest('hex').toUpperCase();
  await fs.writeFile(marker, hash);
  await fs.writeFile(npm, `
    const fs = require('node:fs');
    const path = require('node:path');
    const cache = process.argv[process.argv.indexOf('--prefix') + 1];
    if (fs.existsSync(path.join(cache, '.installed-lock.sha256'))) process.exit(99);
    fs.writeFileSync(path.join(cache, 'install-started'), 'marker absent');
    process.exit(42);
  `);
  const quote = value => `'${value.replaceAll("'", "''")}'`;
  const launcher = fileURLToPath(new URL('./launch.ps1', import.meta.url));
  const bootstrap = fileURLToPath(new URL('./bootstrap.ps1', import.meta.url));
  const setup = `
    $env:LOCALAPPDATA = ${quote(directory)}
    $env:USERPROFILE = ${quote(directory)}
    function git {
      $global:LASTEXITCODE = 0
      if ($args[2] -eq 'remote') { return 'https://github.com/alanchik66/HUNDESALON_NIKA.git' }
      if ($args[2] -eq 'rev-parse') { $global:LASTEXITCODE = 1; return }
      if ($args[2] -eq 'fetch') {
        & ${quote(node)} -e "process.stderr.write('fetch diagnostic\\n'); process.exit(Number(process.env.NIKA_MCP_TEST_FETCH_EXIT))"
        return
      }
      if ($args[2] -eq 'show') {
        switch (($args[3] -split ':', 2)[1]) {
          'integrations/project-mcp/launch.ps1' { return [IO.File]::ReadAllLines(${quote(launcher)}) }
          '.node-version' { return '24.16.0' }
          'package.json' { return '{"packageManager":"npm@11.17.0"}' }
          'integrations/project-mcp/package.json' { return '{}' }
          'integrations/project-mcp/package-lock.json' { return '{}' }
          'integrations/project-mcp/policy.mjs' { return 'export {};' }
          'integrations/project-mcp/server.mjs' { return 'export {};' }
        }
      }
      $global:LASTEXITCODE = 1
    }
  `;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'psmodulepath'));
  const run = (entry = `& ([scriptblock]::Create([IO.File]::ReadAllText(${quote(launcher)}))) -RepoRoot ${quote(directory)} -Commit '${commit}' -PrepareOnly`, fetchExit = 0) => {
    const script = `${setup}\n${entry}\nexit $LASTEXITCODE`;
    return spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { env: { ...env, NIKA_MCP_TEST_FETCH_EXIT: String(fetchExit) }, encoding: 'utf8', timeout: 30000 });
  };
  const cached = run();
  assert.equal(cached.status, 0, cached.stderr);
  assert.equal(cached.stdout, '');
  assert.equal(cached.stderr, '');
  assert.equal(await fs.readFile(marker, 'utf8'), hash);
  await fs.rm(sdk, { recursive: true });
  const failed = run();
  assert.equal(failed.status, 1, failed.stderr);
  assert.equal(failed.stdout, '');
  assert.match(failed.stderr, /dependency installation/);
  assert.equal(await fs.readFile(path.join(cache, 'install-started'), 'utf8'), 'marker absent');
  await assert.rejects(() => fs.stat(marker), { code: 'ENOENT' });
  const retried = run();
  assert.equal(retried.status, 1, retried.stderr);
  assert.match(retried.stderr, /dependency installation/);
  await assert.rejects(() => fs.stat(marker), { code: 'ENOENT' });
  await fs.writeFile(npm, `
    const fs = require('node:fs');
    const path = require('node:path');
    const cache = process.argv[process.argv.indexOf('--prefix') + 1];
    const sdk = path.join(cache, 'node_modules', '@modelcontextprotocol', 'sdk');
    fs.mkdirSync(sdk, { recursive: true });
    fs.writeFileSync(path.join(sdk, 'package.json'), '{}');
    process.stdout.write('installed successfully\\n'.repeat(4096));
    process.stderr.write('npm notice diagnostic\\n'.repeat(4096));
  `);
  const installed = run();
  assert.equal(installed.status, 0, installed.stderr);
  assert.equal(installed.stdout, '');
  assert.match(installed.stderr, /installed successfully/);
  assert.match(installed.stderr, /npm notice diagnostic/);
  assert.equal(await fs.readFile(marker, 'utf8'), hash);
  const bootstrapEntry = `& ([scriptblock]::Create([IO.File]::ReadAllText(${quote(bootstrap)}))) -Commit '${commit}'`;
  const bootstrapped = run(bootstrapEntry);
  assert.equal(bootstrapped.status, 0, bootstrapped.stderr);
  assert.equal(bootstrapped.stdout, '');
  assert.equal(bootstrapped.stderr, '');
  const fetchFailed = run(undefined, 42);
  assert.equal(fetchFailed.status, 1, fetchFailed.stderr);
  assert.match(fetchFailed.stderr, /pinned source fetch/);
  const bootstrapFetchFailed = run(bootstrapEntry, 42);
  assert.equal(bootstrapFetchFailed.status, 1, bootstrapFetchFailed.stderr);
  assert.match(bootstrapFetchFailed.stderr, /Project MCP bootstrap failed/);
});
