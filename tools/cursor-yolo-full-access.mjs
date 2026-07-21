/**
 * Force Cursor Agent full auto-run (no confirmations).
 * Run: node tools/cursor-yolo-full-access.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sqlite = path.join(os.tmpdir(), 'sqlite3.exe');
const db = path.join(
  process.env.APPDATA,
  'Cursor/User/globalStorage/state.vscdb'
);
const key =
  'src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser';

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function sql(q) {
  execFileSync(sqlite, [db, 'PRAGMA busy_timeout=20000;'], { encoding: 'utf8' });
  return execFileSync(sqlite, [db, q], { encoding: 'utf8' }).trim();
}

function withRetry(fn, tries = 12) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return fn();
    } catch (e) {
      last = e;
      sleep(400 + i * 250);
    }
  }
  throw last;
}

function readReactive() {
  return JSON.parse(withRetry(() => sql(`SELECT value FROM ItemTable WHERE key = '${key}';`)));
}

function writeReactive(o) {
  const out = JSON.stringify(o);
  const hex = Buffer.from(out, 'utf8').toString('hex');
  const sqlPath = path.join(os.tmpdir(), 'cursor-yolo-full.sql');
  fs.writeFileSync(
    sqlPath,
    `PRAGMA busy_timeout=20000;\nBEGIN IMMEDIATE;\nUPDATE ItemTable SET value = X'${hex}' WHERE key = '${key}';\nCOMMIT;\n`
  );
  withRetry(() =>
    execFileSync(sqlite, [db, `.read ${sqlPath.replace(/\\/g, '/')}`])
  );
  return out.length;
}

function applyComposer(cs) {
  Object.assign(cs, {
    yoloEnableRunEverything: true,
    yoloOutsideWorkspaceDisabled: false,
    yoloMcpToolsDisabled: false,
    yoloDeleteFileDisabled: false,
    yoloCommandAllowlist: ['*'],
    yoloCommandDenylist: [],
    smartAllowlistDenylist: [],
    enableSmartAuto: true,
    autoAcceptWebSearchTool: true,
    webFetchDomainAllowlist: ['*'],
    autoApproveModeTransitions: true,
    doNotShowYoloModeWarningAgain: true,
    doNotShowFullYoloModeWarningAgain: true,
    doNotShowAutoReviewNudgeAgain: true,
    doNotShowShellApprovalAutoReviewNudgeAgain: true,
    doNotDefaultEnableShellApprovalAutoReviewNudge: true,
    playwrightProtection: false,
    mcpAuthBlocking: false,
    mcpAllowedTools: ['*:*'],
    autoApplyFilesOutsideContext: true,
  });
  if (Array.isArray(cs.modes4)) {
    for (const mode of cs.modes4) {
      if (!mode || typeof mode !== 'object') continue;
      mode.autoRun = true;
      mode.fullAutoRun = true;
    }
  }
  return cs;
}

if (!fs.existsSync(sqlite)) {
  console.error('Missing sqlite3.exe in %TEMP% — install tools first');
  process.exit(1);
}
if (!fs.existsSync(db)) {
  console.error('Missing Cursor state.vscdb');
  process.exit(1);
}

const o = readReactive();
o.composerState ??= {};
applyComposer(o.composerState);
o.explicitlyEnableSemanticSearch = true;
o.indexRepository = true;
o.cppEnabled = true;
o.cppAutoImportEnabled = true;
o.useOpenAIKey = false;
o.openAIBaseUrl = null;
o.cursorIgnore = { hierarchicalEnabled: true, ignoreSymlinks: false };

const n = writeReactive(o);
sleep(500);
const v = readReactive();
const cs = v.composerState || {};
const report = {
  bytes: n,
  yolo: cs.yoloEnableRunEverything === true,
  outsideWorkspaceAllowed: cs.yoloOutsideWorkspaceDisabled === false,
  mcpAllowed: cs.yoloMcpToolsDisabled === false,
  deleteAllowed: cs.yoloDeleteFileDisabled === false,
  mcpTools: cs.mcpAllowedTools,
  modes: (cs.modes4 || []).map((m) => ({
    id: m.id,
    autoRun: m.autoRun,
    fullAutoRun: m.fullAutoRun,
  })),
};

// permissions + cli
const home = os.homedir();
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
  path.join(home, '.cursor', 'permissions.json'),
  path.join(process.cwd(), '.cursor', 'permissions.json'),
]) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(perm, null, 2) + '\n');
}

const cliPath = path.join(home, '.cursor', 'cli-config.json');
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
  cli.attribution = {
    attributeCommitsToAgent: true,
    attributePRsToAgent: true,
  };
  fs.writeFileSync(cliPath, JSON.stringify(cli, null, 2) + '\n');
}

console.log(JSON.stringify(report, null, 2));
if (!report.yolo) process.exit(2);
