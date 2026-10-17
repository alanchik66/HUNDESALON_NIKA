import fs from 'node:fs/promises';
import path from 'node:path';

const MAX_BYTES = 256 * 1024;
const MAX_ENTRIES = 200;
const EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.json', '.md', '.html', '.css', '.toml', '.yml', '.yaml', '.txt', '.svg']);
const DOT_NAMES = new Set(['.github', '.gitignore', '.gitattributes', '.node-version', '.editorconfig']);
const BLOCKED_DIRECTORIES = new Set(['node_modules', 'dist', 'output', 'coverage', 'playwright-report', 'test-results', 'backups']);
const SENSITIVE_NAME = /(?:^|[._-])(?:credentials?|secrets?|tokens?|passwords?)(?:[._-]|$)/i;

function permittedParts(value) {
  if (typeof value !== 'string' || !value || value.length > 4096 || /[\\:*?"<>|\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error('Path is not permitted');
  }
  if (value === '.') return [];
  const parts = value.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || part.endsWith('.') || part.endsWith(' ') ||
    (part.startsWith('.') && !DOT_NAMES.has(part)) || BLOCKED_DIRECTORIES.has(part.toLowerCase()) ||
    SENSITIVE_NAME.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
    throw new Error('Path is not permitted');
  }
  return parts;
}

function isTextFile(name) {
  return DOT_NAMES.has(name) || EXTENSIONS.has(path.extname(name).toLowerCase());
}

export async function createProjectReader(directory) {
  const root = await fs.realpath(directory);
  if (!(await fs.stat(root)).isDirectory()) throw new Error('A project directory is required');

  async function resolve(value) {
    const parts = permittedParts(value);
    let current = root;
    let stat = await fs.lstat(root);
    for (const part of parts) {
      current = path.join(current, part);
      stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new Error('Links are not permitted');
    }
    const real = await fs.realpath(current);
    const relative = path.relative(root, real);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Path is outside the project');
    return { filename: real, stat };
  }

  return {
    async list(value = '.') {
      const { filename, stat } = await resolve(value);
      if (!stat.isDirectory()) throw new Error('A directory is required');
      const entries = await fs.opendir(filename);
      const files = [];
      let scanned = 0;
      let truncated = false;
      try {
        for await (const entry of entries) {
          if (++scanned > 1000 || files.length >= MAX_ENTRIES) { truncated = true; break; }
          try {
            const relative = value === '.' ? entry.name : `${value}/${entry.name}`;
            permittedParts(relative);
            if (entry.isSymbolicLink()) continue;
            if (!entry.isDirectory() && (!entry.isFile() || !isTextFile(entry.name))) continue;
            files.push({ name: entry.name, type: entry.isDirectory() ? 'directory' : 'file' });
          } catch {}
        }
      } finally {
        await entries.close().catch(() => {});
      }
      files.sort((a, b) => a.name.localeCompare(b.name));
      return { entries: files, truncated };
    },
    async read(value) {
      if (!isTextFile(path.basename(value))) throw new Error('Only source text files are permitted');
      const { filename, stat } = await resolve(value);
      if (!stat.isFile() || stat.nlink !== 1 || stat.size > MAX_BYTES) throw new Error('File is not permitted');
      const handle = await fs.open(filename, 'r');
      try {
        const opened = await handle.stat();
        if (opened.dev !== stat.dev || opened.ino !== stat.ino || opened.nlink !== 1 || opened.size > MAX_BYTES) {
          throw new Error('File changed during access');
        }
        const buffer = Buffer.alloc(MAX_BYTES + 1);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
        if (bytesRead > MAX_BYTES || buffer.subarray(0, bytesRead).includes(0)) throw new Error('File is not permitted');
        return new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, bytesRead));
      } finally { await handle.close(); }
    },
  };
}
