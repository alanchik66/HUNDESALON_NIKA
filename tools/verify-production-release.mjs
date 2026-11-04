/** Prepare the tested artifact, verify downloaded bytes, or verify its public release. */
import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  prepareProductionRelease, verifyProductionArtifact, verifyProductionRelease, resolveWeatherReleaseAssets,
} from './lib/production-release-verification.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = name => {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing ${name} value.`);
  return args[index + 1];
};

async function main() {
  const commit = option('--commit') || process.env.GITHUB_SHA;
  if (!/^[a-f0-9]{40}$/u.test(commit || '')) throw new Error('Pass the full reviewed commit SHA.');
  const stamp = option('--stamp');
  const directory = path.resolve(root, option('--dist') || 'dist');
  const manifestFile = option('--manifest');
  if (args.includes('--prepare')) {
    const extraAssets = resolveWeatherReleaseAssets(root);
    const manifest = prepareProductionRelease({ directory, commit, extraAssets });
    verifyProductionArtifact({ directory, manifest, commit, stamp });
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `asset_stamp=${manifest.stamp}\nrelease_commit=${manifest.commit}\n`);
    console.log(JSON.stringify({ commit: manifest.commit, stamp: manifest.stamp, assets: manifest.assets.length, prepared: true }));
    return;
  }
  const manifest = manifestFile ? JSON.parse(readFileSync(path.resolve(root, manifestFile), 'utf8')) : undefined;
  if (args.includes('--verify-artifact')) {
    if (!manifest) throw new Error('--verify-artifact requires --manifest.');
    verifyProductionArtifact({ directory, manifest, commit, stamp });
    console.log(JSON.stringify({ commit, stamp: manifest.stamp, artifactVerified: true }));
    return;
  }
  console.log(JSON.stringify(await verifyProductionRelease({ commit, stamp, manifest, baseUrl: option('--base-url') })));
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
