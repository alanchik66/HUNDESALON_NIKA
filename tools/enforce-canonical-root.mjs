/**
 * Soft path helper for HUNDESALON_NIKA agents.
 * Canonical project root for this repo: D:\HUNDESALON_NIKA
 *
 * Does NOT delete C:\PROJEKT or other user folders.
 * Only keeps Devin/MCP configs for this project pointed at D:.
 *
 * npm run agents:enforce-root
 * npm run agents:enforce-root -- --scrub-ides   (rewrite IDE refs for HUNDESALON under old C: path)
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const CANONICAL = 'D:\\HUNDESALON_NIKA';
const report = { patched: [], skipped: [], notes: [] };

function log(step, msg) {
  console.log(`[${step}] ${msg}`);
}

function assertCanonicalPresent() {
  if (!existsSync(join(CANONICAL, 'package.json'))) {
    throw new Error(`Canonical project missing: ${CANONICAL}\\package.json`);
  }
}

function scrubText(raw) {
  let next = raw;
  const pairs = [
    ['C:\\PROJEKT\\HUNDESALON_NIKA', CANONICAL],
    ['C:/PROJEKT/HUNDESALON_NIKA', 'D:/HUNDESALON_NIKA'],
    ['c:/PROJEKT/HUNDESALON_NIKA', 'D:/HUNDESALON_NIKA'],
    ['c:\\PROJEKT\\HUNDESALON_NIKA', CANONICAL],
    ['file:///c%3A/PROJEKT/HUNDESALON_NIKA', 'file:///d%3A/HUNDESALON_NIKA'],
    ['file:///C%3A/PROJEKT/HUNDESALON_NIKA', 'file:///d%3A/HUNDESALON_NIKA'],
    ['/c:/PROJEKT/HUNDESALON_NIKA', '/d:/HUNDESALON_NIKA'],
    ['/C:/PROJEKT/HUNDESALON_NIKA', '/d:/HUNDESALON_NIKA'],
    ['C:\\\\PROJEKT\\\\HUNDESALON_NIKA', 'D:\\\\HUNDESALON_NIKA'],
  ];
  for (const [from, to] of pairs) {
    if (next.includes(from)) next = next.split(from).join(to);
  }
  return { next, changed: next !== raw };
}

function patchFile(filePath) {
  if (!existsSync(filePath)) return false;
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    report.skipped.push(filePath);
    return false;
  }
  if (!raw.includes('PROJEKT') || !raw.includes('HUNDESALON')) return false;
  const { next, changed } = scrubText(raw);
  if (!changed) return false;
  writeFileSync(filePath, next, 'utf8');
  report.patched.push(filePath);
  return true;
}

function knownConfigFiles() {
  const home = homedir();
  const appData = process.env.APPDATA || join(home, 'AppData', 'Roaming');
  return [
    join(home, '.devin', 'config.local.json'),
    join(appData, 'Code', 'User', 'globalStorage', 'storage.json'),
    join(appData, 'Code', 'User', 'globalStorage', 'sixth.sixth-ai', 'settings', 'sixth-mcp-settings.json'),
    join(appData, 'Devin', 'User', 'globalStorage', 'storage.json'),
    join(appData, 'Cursor', 'User', 'globalStorage', 'storage.json'),
    join(home, '.cursor', 'mcp.json'),
  ];
}

function enforceDevinLocal() {
  const filePath = join(homedir(), '.devin', 'config.local.json');
  mkdirSync(dirname(filePath), { recursive: true });
  const data = existsSync(filePath) ? JSON.parse(readFileSync(filePath, 'utf8')) : { version: 1 };
  data.version = data.version || 1;
  data.workspace = {
    ...(data.workspace || {}),
    name: 'HUNDESALON_NIKA',
    root: CANONICAL,
  };
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  report.patched.push(filePath);
}

function noteProjektFolder() {
  if (existsSync('C:\\PROJEKT')) {
    report.notes.push('C:\\PROJEKT exists — left untouched (user may create any path).');
    log('disk', 'C:\\PROJEKT present — not deleting');
  } else {
    log('disk', 'C:\\PROJEKT absent');
  }
}

function uninstallWatchdogIfPresent() {
  const r = spawnSync('schtasks.exe', ['/Delete', '/TN', 'HundesalonCanonicalRoot', '/F'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (r.status === 0) {
    log('task', 'Removed daily HundesalonCanonicalRoot watchdog');
    report.notes.push('Removed auto-delete scheduled task');
  }
}

function main() {
  const scrubIdes = process.argv.includes('--scrub-ides');
  console.log('HUNDESALON — soft canonical root helper\n');
  console.log(`  Canonical for this project: ${CANONICAL}`);
  console.log('  Policy: never delete user folders like C:\\PROJEKT\n');

  assertCanonicalPresent();
  uninstallWatchdogIfPresent();
  noteProjektFolder();
  enforceDevinLocal();

  if (scrubIdes) {
    for (const f of knownConfigFiles()) patchFile(f);
  } else {
    report.notes.push('IDE scrub skipped (pass --scrub-ides to rewrite old HUNDESALON C: refs)');
  }

  console.log('\nSummary');
  console.log(`  patched: ${report.patched.length}`);
  console.log(`  skipped: ${report.skipped.length}`);
  for (const n of report.notes) console.log(`  note: ${n}`);
  console.log('\nOK — project agents use D:\\HUNDESALON_NIKA; other paths are free.');
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
