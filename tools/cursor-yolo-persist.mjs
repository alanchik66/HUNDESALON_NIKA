/**
 * Re-apply full YOLO until it sticks (Cursor overwrites from memory).
 * Usage: node tools/cursor-yolo-persist.mjs [seconds=90]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const seconds = Math.max(15, Number(process.argv[2] || 90));
const root = path.dirname(fileURLToPath(import.meta.url));
const apply = path.join(root, 'cursor-yolo-full-access.mjs');
const sqlite = path.join(os.tmpdir(), 'sqlite3.exe');
const db = path.join(
  process.env.APPDATA,
  'Cursor/User/globalStorage/state.vscdb'
);
const key =
  'src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser';
const tmp = path.join(os.tmpdir(), 'cursor-yolo-check.json');

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function readYolo() {
  const r = spawnSync(
    sqlite,
    [db, `SELECT value FROM ItemTable WHERE key = '${key}';`],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
  );
  if (r.status !== 0) throw new Error(r.stderr || 'sqlite read failed');
  fs.writeFileSync(tmp, r.stdout.trim());
  const o = JSON.parse(fs.readFileSync(tmp, 'utf8'));
  const cs = o.composerState || {};
  return {
    yolo: cs.yoloEnableRunEverything === true,
    outsideOk: cs.yoloOutsideWorkspaceDisabled === false,
    allow: Array.isArray(cs.yoloCommandAllowlist)
      ? cs.yoloCommandAllowlist
      : [],
    fullAgent: !!(cs.modes4 || []).find(
      (m) => m.id === 'agent' && m.fullAutoRun === true
    ),
    mcpAuthBlocking: cs.mcpAuthBlocking,
  };
}

const deadline = Date.now() + seconds * 1000;
let last = null;
let okStreak = 0;

while (Date.now() < deadline) {
  spawnSync(process.execPath, [apply], { stdio: 'inherit' });
  sleep(1500);
  last = readYolo();
  const good =
    last.yolo &&
    last.outsideOk &&
    (last.allow.includes('*') || last.allow.length > 0) &&
    last.fullAgent &&
    last.mcpAuthBlocking === false;
  console.log(JSON.stringify({ t: new Date().toISOString(), good, ...last }));
  if (good) {
    okStreak += 1;
    if (okStreak >= 3) {
      console.log('STUCK_OK — YOLO survived 3 consecutive checks');
      process.exit(0);
    }
  } else {
    okStreak = 0;
  }
  sleep(2500);
}

console.error('NOT_STUCK — Cursor memory still overwriting. Use UI Run Everything + Reload.');
console.error(JSON.stringify(last));
process.exit(2);
