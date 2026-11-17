import { glob, readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lint, readConfig } from 'markdownlint/promise';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const toPosix = file => file.split(path.sep).join('/');
const MAX_HIDDEN_DIRECTORY_DEPTH = 64;

export async function findMarkdownFiles(cwd = process.cwd()) {
  const { globs, ignores } = JSON.parse(
    await readFile(path.join(projectRoot, 'config/markdownlint-files.json'), 'utf8')
  );
  const files = new Set();
  const options = { cwd, exclude: ignores, followSymlinks: true };
  // CLI2 included dotfiles; native glob requires an explicit leading dot.
  const patterns = [...globs, ...globs.map(pattern => pattern.replace('*.md', '.*.md'))];
  for await (const file of glob(patterns, options)) {
    if ((await stat(path.resolve(cwd, file))).isFile()) files.add(toPosix(file));
  }
  async function collectHiddenMarkdown(directoryPath, ancestors = new Set(), depth = 0) {
    if (depth >= MAX_HIDDEN_DIRECTORY_DEPTH) throw new Error('Markdown directory depth exceeds 64.');
    const resolved = await realpath(directoryPath);
    const identity = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    if (ancestors.has(identity)) throw new Error('Markdown directory cycle.');
    ancestors.add(identity);
    try {
      for (const entry of await readdir(directoryPath, { withFileTypes: true })) {
        const entryPath = path.join(directoryPath, entry.name);
        const metadata = entry.isSymbolicLink() ? await stat(entryPath) : entry;
        if (metadata.isDirectory()) await collectHiddenMarkdown(entryPath, ancestors, depth + 1);
        else if (metadata.isFile() && entry.name.endsWith('.md')) {
          files.add(toPosix(path.relative(cwd, entryPath)));
        }
      }
    } finally {
      ancestors.delete(identity);
    }
  }
  // Discover hidden directories only in the existing recursive Markdown scopes.
  for (const pattern of globs.filter(value => value.endsWith('/**/*.md'))) {
    const scope = pattern.slice(0, -'/**/*.md'.length);
    for await (const directory of glob(`${scope}/**/.*`, { ...options, withFileTypes: true })) {
      const directoryPath = path.join(directory.parentPath, directory.name);
      const metadata = directory.isSymbolicLink() ? await stat(directoryPath) : directory;
      if (metadata.isDirectory()) await collectHiddenMarkdown(directoryPath);
    }
  }
  return [...files].sort();
}

export async function lintMarkdown(cwd = process.cwd()) {
  const files = await findMarkdownFiles(cwd);
  const config = await readConfig(path.join(projectRoot, '.markdownlint.json'));
  const results = await lint({ files: files.map(file => path.resolve(cwd, file)), config });
  const errorCount = Object.values(results).reduce((count, issues) => count + issues.length, 0);
  return { files, results, errorCount };
}

if (import.meta.main) {
  try {
    const { files, results, errorCount } = await lintMarkdown();
    console.log(`Markdown: ${files.length} files checked, ${errorCount} errors.`);
    if (errorCount) {
      for (const [file, issues] of Object.entries(results)) {
        for (const issue of issues) {
          console.error(
            `${toPosix(path.relative(process.cwd(), file))}:${issue.lineNumber} ${issue.ruleNames.join('/')} ${issue.ruleDescription}${issue.errorDetail ? ` [${issue.errorDetail}]` : ''}`
          );
        }
      }
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
