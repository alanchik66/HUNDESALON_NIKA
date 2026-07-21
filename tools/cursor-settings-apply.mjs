/**
 * Apply professional Cursor Settings (reactive storage + privacy keys).
 * Run: node tools/cursor-settings-apply.mjs
 * Retries when Cursor has the DB locked.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

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
  // Separate PRAGMA so its "15000" output does not pollute SELECT JSON
  execFileSync(sqlite, [db, 'PRAGMA busy_timeout=15000;'], {
    encoding: 'utf8',
  });
  return execFileSync(sqlite, [db, q], { encoding: 'utf8' }).trim();
}

function withRetry(fn, tries = 8) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return fn();
    } catch (e) {
      last = e;
      const msg = String(e?.stderr || e?.message || e);
      if (!/locked|busy/i.test(msg) || i === tries - 1) throw e;
      sleep(400 + i * 200);
    }
  }
  throw last;
}

function readReactive() {
  return JSON.parse(sql(`SELECT value FROM ItemTable WHERE key = '${key}';`));
}

function writeReactive(o) {
  const out = JSON.stringify(o);
  const hex = Buffer.from(out, 'utf8').toString('hex');
  const sqlPath = path.join(os.tmpdir(), 'cursor-apply.sql');
  fs.writeFileSync(
    sqlPath,
    `PRAGMA busy_timeout=15000;\nBEGIN IMMEDIATE;\nUPDATE ItemTable SET value = X'${hex}' WHERE key = '${key}';\nCOMMIT;\n`
  );
  execFileSync(sqlite, [db, `.read ${sqlPath.replace(/\\/g, '/')}`]);
  return out.length;
}

const o = withRetry(readReactive);
o.explicitlyEnableSemanticSearch = true;
o.indexRepository = true;
o.cppEnabled = true;
o.cppAutoImportEnabled = true;
o.useOpenAIKey = false;
o.openAIBaseUrl = null;
o.systemNotificationsEnabled = true;
o.cursorIgnore = { hierarchicalEnabled: true, ignoreSymlinks: false };

const auto = {
  modelName: 'default',
  maxMode: false,
  selectedModels: [{ modelId: 'default', parameters: [] }],
};
const autoMax = {
  modelName: 'default',
  maxMode: true,
  selectedModels: [{ modelId: 'default', parameters: [] }],
};
const grok = {
  modelName: 'grok-4.5',
  maxMode: true,
  selectedModels: [
    {
      modelId: 'grok-4.5',
      parameters: [
        { id: 'effort', value: 'high' },
        { id: 'fast', value: 'true' },
      ],
    },
  ],
};

o.aiSettings ??= {};
o.aiSettings.modelConfig ??= {};
Object.assign(o.aiSettings.modelConfig, {
  composer: grok,
  'background-composer': autoMax,
  'quick-agent': auto,
  'cmd-k': auto,
});

o.composerState ??= {};
Object.assign(o.composerState, {
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
if (Array.isArray(o.composerState.modes4)) {
  for (const mode of o.composerState.modes4) {
    if (!mode || typeof mode !== 'object') continue;
    mode.autoRun = true;
    mode.fullAutoRun = true;
  }
}

const n = withRetry(() => writeReactive(o));

const kv = [
  ['cursorai/donotchange/privacyMode', 'true'],
  [
    'cursorai/donotchange/newPrivacyMode2',
    JSON.stringify({ privacyMode: 'PRIVACY_MODE_NO_TRAINING' }),
  ],
  ['cursorai/donotchange/partnerDataShare', 'false'],
  ['cursor/autoRunBugbotOnCommit', 'true'],
  ['cursor/bugbotDeepReviewDefault', 'true'],
  ['cursor/composerAutocompleteHeuristicsEnabled', 'true'],
  // false = Enter sends message; Ctrl+Enter inserts newline
  ['cursor/chatSubmitOnCmdEnter', 'false'],
  ['cursor/noInlineDiffs', 'false'],
];
for (const [k, v] of kv) {
  const esc = v.replace(/'/g, "''");
  withRetry(() =>
    sql(
      `INSERT INTO ItemTable(key,value) VALUES('${k}','${esc}') ON CONFLICT(key) DO UPDATE SET value=excluded.value;`
    )
  );
}

// CLI attribution (Git & PRs)
const cliPath = path.join(os.homedir(), '.cursor', 'cli-config.json');
if (fs.existsSync(cliPath)) {
  const cli = JSON.parse(fs.readFileSync(cliPath, 'utf8'));
  cli.attribution = {
    attributeCommitsToAgent: true,
    attributePRsToAgent: true,
  };
  cli.approvalMode = 'unrestricted';
  fs.writeFileSync(cliPath, JSON.stringify(cli, null, 2) + '\n');
}

const v = withRetry(readReactive);
console.log(
  JSON.stringify(
    {
      bytes: n,
      semanticSearch: v.explicitlyEnableSemanticSearch,
      hierarchicalIgnore: v.cursorIgnore,
      yolo: v.composerState?.yoloEnableRunEverything,
      composer: v.aiSettings?.modelConfig?.composer?.modelName,
      mcp: v.composerState?.mcpAllowedTools?.length,
      hooks: fs.existsSync(
        path.join(process.cwd(), '.cursor', 'hooks.json')
      ),
    },
    null,
    2
  )
);
