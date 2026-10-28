import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

if (process.platform !== 'win32') throw new Error('This persistent preview installer is for Windows.');
const root = fileURLToPath(new URL('../', import.meta.url));
const appData = process.env.APPDATA;
if (!appData || !path.isAbsolute(appData)) throw new Error('Windows APPDATA path is unavailable.');
const startup = path.join(appData, 'Microsoft/Windows/Start Menu/Programs/Startup');
const filename = path.join(startup, 'HUNDESALON_NIKA-LocalPreview.vbs');
const supervisor = path.join(root, 'tools/dev-preview-supervisor.mjs');
const output = path.join(root, 'output/local-preview');
const marker = "' Managed HUNDESALON_NIKA local preview";
const command = `"${process.execPath}" "${supervisor}"`;
const vbsString = text => `"${text.replaceAll('"', '""')}"`;
const source = `${marker}\r\nSet previewShell = CreateObject("WScript.Shell")\r\npreviewShell.CurrentDirectory = ${vbsString(root)}\r\nDo\r\n  previewExit = previewShell.Run(${vbsString(command)}, 0, True)\r\n  If previewExit = 23 Then Exit Do\r\n  WScript.Sleep 3000\r\nLoop\r\n`;
if (existsSync(filename) && !(await readFile(filename, 'utf8')).startsWith(marker)) {
  throw new Error(`Existing startup file was preserved: ${filename}`);
}
await mkdir(startup, { recursive: true });
await mkdir(output, { recursive: true });
await writeFile(filename, source, 'utf8');
const probe = async () => {
  try {
    const response = await fetch('http://127.0.0.1:5513/status', { signal: AbortSignal.timeout(2000) });
    const state = await response.json();
    return response.ok && state.project === 'HUNDESALON_NIKA' && state.root === root ? state : null;
  } catch {
    return null;
  }
};
let state = await probe();
let launcherPid = state?.parentPid || null;
if (!state) {
  const wscript = path.join(process.env.SystemRoot || 'C:/Windows', 'System32/wscript.exe');
  if (!existsSync(wscript)) throw new Error('Windows Script Host is unavailable.');
  const launcher = spawn(wscript, ['//B', '//NoLogo', filename], {
    cwd: root,
    windowsHide: true,
    detached: true,
    stdio: 'ignore',
  });
  await new Promise((resolve, reject) => {
    launcher.once('spawn', resolve);
    launcher.once('error', reject);
  });
  launcherPid = launcher.pid;
  launcher.unref();
}
for (let attempt = 0; attempt < 40; attempt++) {
  state = await probe();
  if (state?.services.every(service => service.healthy)) break;
  await new Promise(resolve => setTimeout(resolve, 500));
}
if (!state?.services.every(service => service.healthy)) {
  throw new Error('Preview is not healthy; inspect output/local-preview/supervisor.log.');
}
const result = {
  startupFile: filename,
  launcherPid,
  supervisorPid: state.supervisorPid,
  root,
  url: 'http://127.0.0.1:5502/ru/prays-list.html',
  installedAt: new Date().toISOString(),
};
await writeFile(path.join(output, 'installation.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
