import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sqlite = path.join(os.tmpdir(), 'sqlite3.exe');
const live = path.join(
  process.env.APPDATA,
  'Cursor/User/globalStorage/state.vscdb'
);

function q(sql) {
  execFileSync(sqlite, [live, 'PRAGMA busy_timeout=15000;'], {
    encoding: 'utf8',
  });
  return execFileSync(sqlite, [live, sql], { encoding: 'utf8' }).trim();
}

const key =
  'src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser';
const o = JSON.parse(q(`SELECT value FROM ItemTable WHERE key = '${key}';`));
const get = (k) => {
  try {
    return q(`SELECT value FROM ItemTable WHERE key = '${k}';`);
  } catch {
    return null;
  }
};

const repo = 'd:/HUNDESALON_NIKA';
const cli = JSON.parse(
  fs.readFileSync(path.join(os.homedir(), '.cursor/cli-config.json'), 'utf8')
);

const report = {
  Hooks: {
    ok: fs.existsSync(`${repo}/.cursor/hooks.json`),
    detail: 'block-secrets.mjs on beforeShellExecution + beforeReadFile',
  },
  Attribution: {
    ok: !!cli.attribution?.attributeCommitsToAgent,
    detail: cli.attribution,
  },
  Indexing: {
    ok: o.indexRepository === true,
    detail: {
      indexRepository: o.indexRepository,
      cursorignore: fs.existsSync(`${repo}/.cursorignore`),
    },
  },
  Semantic: {
    ok: o.explicitlyEnableSemanticSearch === true,
    hierarchicalIgnore: o.cursorIgnore,
  },
  Browser: {
    ok: true,
    detail: 'Playwright MCP :8931; Kilo browser automation on (workspace)',
  },
  Network: {
    ok: o.openAIBaseUrl == null && o.useOpenAIKey === false,
    detail: {
      openAIBaseUrl: o.openAIBaseUrl,
      useOpenAIKey: o.useOpenAIKey,
      privacy: get('cursorai/donotchange/newPrivacyMode2'),
    },
  },
  'Cloud Agents': {
    ok: fs.existsSync(`${repo}/.cursor/environment.json`),
    detail: 'environment.json install/start ports 5502/8788',
  },
  Rules: {
    ok: fs.readdirSync(`${repo}/.cursor/rules`).length >= 8,
    count: fs.readdirSync(`${repo}/.cursor/rules`).length,
  },
  Agents: {
    ok: o.composerState?.yoloEnableRunEverything === true,
    model: o.aiSettings?.modelConfig?.composer?.modelName,
  },
  Tab: {
    ok: o.cppEnabled === true,
    cppAutoImport: o.cppAutoImportEnabled,
  },
  chatSubmitOnCmdEnter: get('cursor/chatSubmitOnCmdEnter'),
  bugbot: get('cursor/autoRunBugbotOnCommit'),
};

console.log(JSON.stringify(report, null, 2));
