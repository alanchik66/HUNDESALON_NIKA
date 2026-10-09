import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { transformSync, version as esbuildVersion } from 'esbuild';
import { deployedModulePaths, canonicalRecoveredModule } from './module-source.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.dirname(projectRoot);
const runtimeDirectory = path.join(projectRoot, 'dist-widget');
const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'build-manifest.json'), 'utf8'));
const argumentsList = process.argv.slice(2);
const checking = argumentsList.includes('--check');
const outputArgumentIndex = argumentsList.indexOf('--out-dir');
const outputDirectory = path.resolve(
  repositoryRoot,
  outputArgumentIndex >= 0 ? argumentsList[outputArgumentIndex + 1] || '' : 'output/weather-source-candidate'
);
const sha256 = content => createHash('sha256').update(content).digest('hex');

if (esbuildVersion !== manifest.toolchain.esbuild) {
  throw new Error(`Use the locked esbuild ${manifest.toolchain.esbuild}; found ${esbuildVersion}.`);
}
if (!checking && outputArgumentIndex >= 0 && !argumentsList[outputArgumentIndex + 1]) {
  throw new Error('--out-dir requires a directory.');
}
const relativeOutput = path.relative(repositoryRoot, outputDirectory);
if (
  !relativeOutput ||
  relativeOutput.startsWith(`..${path.sep}`) ||
  path.isAbsolute(relativeOutput) ||
  outputDirectory === runtimeDirectory ||
  outputDirectory.startsWith(`${runtimeDirectory}${path.sep}`)
) {
  // Candidate builds must not overwrite the currently deployed files or another workspace.
  throw new Error('Output must be a separate directory inside the repository.');
}

const generated = [];
for (const vendor of manifest.vendorInputs) {
  const bytes = fs.readFileSync(path.join(runtimeDirectory, vendor.file));
  if (sha256(bytes) !== vendor.sha256) {
    throw new Error(`Vendored input changed without a provenance review: ${vendor.file}`);
  }
  generated.push({ name: vendor.file, bytes });
}

for (const entry of manifest.entries) {
  const source = fs.readFileSync(path.join(projectRoot, entry.source), 'utf8');
  if (checking && sha256(canonicalRecoveredModule(source, entry, manifest)) !== entry.canonicalSha256) {
    throw new Error(`Recovered module differs from its recorded runtime baseline: ${entry.source}`);
  }
  const result = transformSync(deployedModulePaths(source, manifest), {
    format: entry.output.endsWith('iife.js') ? 'iife' : 'esm',
    target: 'es2022',
    minify: false,
    legalComments: 'inline',
    sourcemap: 'external',
    sourcesContent: true,
    sourcefile: entry.source,
  });
  generated.push({ name: entry.output, bytes: Buffer.from(result.code) });
  generated.push({ name: `${entry.output}.map`, bytes: Buffer.from(result.map) });
}

const noticePath = path.join(runtimeDirectory, 'THIRD_PARTY_LICENSES.txt');
generated.push({ name: 'THIRD_PARTY_LICENSES.txt', bytes: fs.readFileSync(noticePath) });

if (checking) {
  console.log(
    `Weather recovery check passed: ${manifest.entries.length} authored modules, ${manifest.vendorInputs.length} unchanged vendor inputs.`
  );
} else {
  fs.mkdirSync(outputDirectory, { recursive: true });
  for (const item of generated) {
    fs.writeFileSync(path.join(outputDirectory, item.name), item.bytes);
  }

  // Use the same tracked assets as a clean checkout; exclude large local source media.
  const assetPaths = execFileSync('git', ['ls-files', '-z', '--', '3d-weather-codrops-main/dist-widget/assets'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean);
  for (const relativeAsset of assetPaths) {
    const destination = path.join(
      outputDirectory,
      path.relative(runtimeDirectory, path.join(repositoryRoot, relativeAsset))
    );
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(repositoryRoot, relativeAsset), destination);
  }
  fs.writeFileSync(
    path.join(outputDirectory, 'build-report.json'),
    `${JSON.stringify(
      {
        reconstructedFrom: manifest.reconstructedFrom,
        toolchain: manifest.toolchain,
        generated: generated.map(item => ({ file: item.name, bytes: item.bytes.length, sha256: sha256(item.bytes) })),
        trackedAssets: assetPaths.length,
      },
      null,
      2
    )}\n`
  );
  console.log(
    `Weather candidate built in ${relativeOutput.replaceAll('\\', '/')}; production runtime was not overwritten.`
  );
}
