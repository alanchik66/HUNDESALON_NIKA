import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(directory, '../../..');
const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'plugins.json'), 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const argumentIndex = process.argv.indexOf('--upstream-dir');
const upstreamDirectory =
  argumentIndex < 0 ? null : path.resolve(repositoryRoot, process.argv[argumentIndex + 1] || '');
if (argumentIndex >= 0 && !process.argv[argumentIndex + 1]) throw new Error('--upstream-dir needs a directory.');

for (const plugin of manifest.plugins) {
  const runtime = path.join(repositoryRoot, 'knowledge/.obsidian/plugins', plugin.id, 'main.js');
  assert.equal(hash(fs.readFileSync(runtime)), plugin.runtimeSha256, plugin.id + ': reviewed runtime changed');
  for (const record of [plugin.license, plugin.bundledNotices, plugin.runtimePatch].filter(Boolean)) {
    assert.equal(
      hash(fs.readFileSync(path.join(directory, record.file))),
      record.sha256,
      plugin.id + ': provenance input changed'
    );
  }
  if (upstreamDirectory && plugin.runtimePatch) {
    const upstream = fs.readFileSync(path.join(upstreamDirectory, plugin.id + '.upstream-main.js'));
    assert.equal(hash(upstream), plugin.upstreamRuntimeSha256, plugin.id + ': upstream release mismatch');
    if (plugin.id === 'dataview') {
      const descriptor = JSON.parse(fs.readFileSync(path.join(directory, plugin.runtimePatch.file), 'utf8'));
      assert.equal(hash(upstream), descriptor.upstreamSha256);
      let code = upstream.toString('utf8');
      assert.equal(code.split(descriptor.codeReplacement.before).length, 2, 'Dataview replacement must be unique');
      const mapExpression = /sourceMappingURL=data:application\/json;charset=utf-8;base64,([^\r\n]+)/;
      const encodedMap = code.match(mapExpression)?.[1];
      assert.ok(encodedMap, 'Dataview inline source map missing');
      const map = JSON.parse(Buffer.from(encodedMap, 'base64').toString('utf8'));
      const operation = descriptor.sourceMapMappingsReplacement;
      assert.equal(
        hash(map.mappings.slice(operation.offset, operation.offset + operation.removedLength)),
        operation.removedSha256
      );
      map.mappings =
        map.mappings.slice(0, operation.offset) +
        operation.insert +
        map.mappings.slice(operation.offset + operation.removedLength);
      code = code
        .replace(descriptor.codeReplacement.before, descriptor.codeReplacement.after)
        .replace(encodedMap, Buffer.from(JSON.stringify(map)).toString('base64'));
      assert.equal(hash(code), descriptor.restoredSha256, 'Dataview runtime restoration mismatch');
    } else {
      // Git applies the recorded textual delta; no vendor runtime is executed.
      const outputRoot = path.join(repositoryRoot, 'output/plugin-provenance');
      fs.mkdirSync(outputRoot, { recursive: true });
      const temporaryDirectory = fs.mkdtempSync(path.join(outputRoot, 'verify-'));
      const relative = path.relative(repositoryRoot, temporaryDirectory).replaceAll('\\', '/');
      try {
        fs.writeFileSync(path.join(temporaryDirectory, 'main.js'), upstream);
        execFileSync(
          'git',
          ['apply', '--unidiff-zero', '--directory=' + relative, '--', path.join(directory, plugin.runtimePatch.file)],
          { cwd: repositoryRoot, stdio: 'pipe' }
        );
        assert.equal(
          hash(fs.readFileSync(path.join(temporaryDirectory, 'main.js'))),
          plugin.runtimeSha256,
          plugin.id + ': runtime restoration mismatch'
        );
      } finally {
        const resolved = path.resolve(temporaryDirectory);
        assert.ok(
          resolved.startsWith(path.resolve(outputRoot) + path.sep),
          'Temporary cleanup must stay in its output directory'
        );
        fs.rmSync(resolved, { recursive: true, force: true });
      }
    }
  }
  console.log('PASS ' + plugin.id);
}
for (const component of manifest.components || []) {
  if (component.license) {
    assert.equal(
      hash(fs.readFileSync(path.join(directory, component.license.file))),
      component.license.sha256,
      component.name + ': license changed'
    );
  }
  assert.equal(
    hash(fs.readFileSync(path.join(directory, component.sourceFile))),
    component.sha256,
    component.name + ': source changed'
  );
}
console.log('Verified ' + manifest.plugins.length + ' plugin runtimes and retained provenance inputs.');
