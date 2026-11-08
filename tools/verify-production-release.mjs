/** Prepare the tested artifact, verify downloaded bytes, or verify its public release. */
import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  prepareProductionRelease, verifyProductionArtifact, verifyProductionRelease, resolveWeatherReleaseAssets,
  parseWranglerPagesDeploymentOutput,
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
  const wranglerOutput = option('--wrangler-output');
  const baseUrl = option('--base-url');
  if (wranglerOutput && baseUrl) throw new Error('--wrangler-output cannot be combined with --base-url.');
  if (wranglerOutput && (args.includes('--prepare') || args.includes('--verify-artifact'))) {
    throw new Error('--wrangler-output is only valid for public deployment verification.');
  }
  if (args.includes('--prepare')) {
    const extraAssets = resolveWeatherReleaseAssets(root, directory);
    const manifest = prepareProductionRelease({ directory, commit, extraAssets });
    verifyProductionArtifact({ directory, manifest, commit, stamp, requiredAssets: extraAssets });
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `asset_stamp=${manifest.stamp}\nrelease_commit=${manifest.commit}\n`);
    console.log(JSON.stringify({ commit: manifest.commit, stamp: manifest.stamp, assets: manifest.assets.length, prepared: true }));
    return;
  }
  const manifest = manifestFile ? JSON.parse(readFileSync(path.resolve(root, manifestFile), 'utf8')) : undefined;
  if (args.includes('--verify-artifact')) {
    if (!manifest) throw new Error('--verify-artifact requires --manifest.');
    verifyProductionArtifact({ directory, manifest, commit, stamp, requiredAssets: resolveWeatherReleaseAssets(root, directory) });
    console.log(JSON.stringify({ commit, stamp: manifest.stamp, artifactVerified: true }));
    return;
  }
  if (wranglerOutput && !manifest) throw new Error('--wrangler-output requires the validated --manifest.');
  const deployment = wranglerOutput
    ? parseWranglerPagesDeploymentOutput(readFileSync(path.resolve(root, wranglerOutput), 'utf8'), { commit }) : undefined;
  const result = await verifyProductionRelease({ commit, stamp, manifest, baseUrl: deployment?.baseUrl || baseUrl,
    requiredAssets: resolveWeatherReleaseAssets(root, directory) });
  console.log(JSON.stringify(deployment ? {
    ...result, deploymentId: deployment.deploymentId, verificationScope: 'deployment-host',
    canonicalDomainVerified: false, canonicalDomainVerification: 'pending-watcher',
  } : result));
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
