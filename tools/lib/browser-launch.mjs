import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const pidRoot = path.join(process.env.TEMP || '.', 'hundesalon-nika-browser-pids');

function ensurePidRoot() {
  mkdirSync(pidRoot, { recursive: true });
}

export function browserPidFile(name) {
  ensurePidRoot();
  return path.join(pidRoot, `${name}.pid`);
}

function readPid(pidFile) {
  try {
    const value = Number.parseInt(readFileSync(pidFile, 'utf8').trim(), 10);
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function tasklistImageForPid(pid) {
  try {
    const output = execFileSync(
      'tasklist',
      ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'],
      { encoding: 'utf8' }
    ).trim();

    if (!output || /^INFO:/i.test(output)) return null;

    const match = output.match(/^"([^"]+)","(\d+)"/);
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

export function stopTrackedBrowser(pidFile, imageNames = ['msedge.exe']) {
  if (process.platform !== 'win32') return false;

  const pid = readPid(pidFile);
  if (!pid) return false;

  const image = tasklistImageForPid(pid);
  if (!image) {
    rmSync(pidFile, { force: true });
    return false;
  }

  const allowedImages = imageNames.map(name => String(name).toLowerCase());
  if (!allowedImages.includes(image)) return false;

  try {
    execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  } catch {
    // stale or already exiting
  } finally {
    rmSync(pidFile, { force: true });
  }

  return true;
}

export function launchTrackedBrowser(executable, args, pidFile) {
  ensurePidRoot();
  const child = spawn(executable, args, { detached: true, stdio: 'ignore' });
  writeFileSync(pidFile, String(child.pid), 'utf8');
  child.unref();
  return child;
}
