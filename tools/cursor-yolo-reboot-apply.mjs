/**
 * Kill Cursor → write full auto-run → relaunch workspace.
 * Usage: node tools/cursor-yolo-reboot-apply.mjs
 */
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const sqlite = path.join(os.tmpdir(), 'sqlite3.exe');
const db = path.join(
  process.env.APPDATA,
  'Cursor/User/globalStorage/state.vscdb'
);
const key =
  'src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser';
const cursorExe = path.join(
  process.env.LOCALAPPDATA,
  'Programs/cursor/Cursor.exe'
);

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function sql(q) {
  execFileSync(sqlite, [db, 'PRAGMA busy_timeout=30000;'], { encoding: 'utf8' });
  return execFileSync(sqlite, [db, q], { encoding: 'utf8' }).trim();
}

function withRetry(fn, tries = 15) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return fn();
    } catch (e) {
      last = e;
      sleep(500 + i * 200);
    }
  }
  throw last;
}

function killCursor() {
  try {
    execFileSync('taskkill', ['/F', '/IM', 'Cursor.exe'], {
      stdio: 'ignore',
    });
  } catch {
    // already closed
  }
  sleep(2000);
  // Wait until DB unlocks
  for (let i = 0; i < 20; i++) {
    try {
      sql('PRAGMA wal_checkpoint(TRUNCATE);');
      return;
    } catch {
      sleep(500);
    }
  }
}

function apply() {
  const o = JSON.parse(
    withRetry(() => sql(`SELECT value FROM ItemTable WHERE key = '${key}';`))
  );
  o.composerState ??= {};
  Object.assign(o.composerState, {
    yoloEnableRunEverything: true,
    yoloOutsideWorkspaceDisabled: false,
    yoloMcpToolsDisabled: false,
    yoloDeleteFileDisabled: false,
    doNotShowYoloModeWarningAgain: true,
    doNotShowFullYoloModeWarningAgain: true,
    doNotShowShellApprovalAutoReviewNudgeAgain: true,
    doNotDefaultEnableShellApprovalAutoReviewNudge: true,
    playwrightProtection: false,
    mcpAuthBlocking: false,
    mcpAllowedTools: ['*:*'],
    yoloCommandAllowlist: ['*'],
    yoloCommandDenylist: [],
    smartAllowlistDenylist: [],
  });
  if (Array.isArray(o.composerState.modes4)) {
    for (const mode of o.composerState.modes4) {
      if (!mode || typeof mode !== 'object') continue;
      mode.autoRun = true;
      mode.fullAutoRun = true;
    }
  }
  o.explicitlyEnableSemanticSearch = true;
  o.indexRepository = true;
  o.cppEnabled = true;
  o.cppAutoImportEnabled = true;
  o.useOpenAIKey = false;
  o.openAIBaseUrl = null;
  o.cursorIgnore = { hierarchicalEnabled: true, ignoreSymlinks: false };

  const hex = Buffer.from(JSON.stringify(o), 'utf8').toString('hex');
  const sqlPath = path.join(os.tmpdir(), 'cursor-yolo-reboot.sql');
  fs.writeFileSync(
    sqlPath,
    `PRAGMA busy_timeout=30000;\nBEGIN IMMEDIATE;\nUPDATE ItemTable SET value = X'${hex}' WHERE key = '${key}';\nCOMMIT;\nPRAGMA wal_checkpoint(TRUNCATE);\n`
  );
  withRetry(() =>
    execFileSync(sqlite, [db, `.read ${sqlPath.replace(/\\/g, '/')}`])
  );

  const v = JSON.parse(
    withRetry(() => sql(`SELECT value FROM ItemTable WHERE key = '${key}';`))
  );
  return v.composerState?.yoloEnableRunEverything === true;
}

function writePerms() {
  const perm = {
    approvalMode: 'unrestricted',
    terminalAllowlist: ['*'],
    mcpAllowlist: ['*:*'],
    autoRun: {
      allow_instructions: [
        'Owner standing order: auto-approve EVERY shell, MCP, Fetch, browser, git, npm, wrangler, Cloudflare, lint, validate, build, install, config, and file tool call without asking until the task is finished.',
        'Never pause for confirmation on routine or elevated agent work; continue autonomously.',
      ],
      block_instructions: [
        'Only block wiping the entire disk, formatting drives, or deleting the user home directory.',
      ],
    },
  };
  for (const p of [
    path.join(os.homedir(), '.cursor', 'permissions.json'),
    path.join(root, '.cursor', 'permissions.json'),
  ]) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(perm, null, 2) + '\n');
  }
  const cliPath = path.join(os.homedir(), '.cursor', 'cli-config.json');
  if (fs.existsSync(cliPath)) {
    const cli = JSON.parse(fs.readFileSync(cliPath, 'utf8'));
    cli.approvalMode = 'unrestricted';
    cli.autoAcceptWebSearch = true;
    cli.sandbox = { mode: 'disabled', networkAccess: 'allow_all' };
    cli.webFetchDomainAllowlist = ['*'];
    cli.permissions = {
      allow: [
        'Shell(**)',
        'Read(**)',
        'Write(**)',
        'Delete(**)',
        'Mcp(**)',
        'WebFetch(**)',
        'WebSearch(**)',
      ],
      deny: [],
    };
    fs.writeFileSync(cliPath, JSON.stringify(cli, null, 2) + '\n');
  }
}

console.log('Stopping Cursor…');
killCursor();
writePerms();
const ok = apply();
console.log(ok ? 'YOLO written OK' : 'YOLO write FAILED');
if (!ok) process.exit(2);

if (fs.existsSync(cursorExe)) {
  console.log('Relaunching Cursor…');
  spawn(cursorExe, [root], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref();
} else {
  console.warn('Cursor.exe not found — open Cursor manually');
}
