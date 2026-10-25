import { ACCOUNT_ID, cloudflareApi, loadWranglerOAuth, refreshWranglerOAuth } from './lib/cloudflare-auth.mjs';

const projectName = 'hundesalon-nika';
const expectedCommit = process.argv.find(argument => argument.startsWith('--commit='))?.slice(9);
if (!/^[a-f0-9]{40}$/.test(expectedCommit || '')) throw new Error('A full expected --commit is required.');
const auth = await refreshWranglerOAuth(loadWranglerOAuth());
const projectPath = `/accounts/${ACCOUNT_ID}/pages/projects/${projectName}`;
const project = await cloudflareApi(auth, projectPath);
const current = project.canonical_deployment;
if (project.production_branch !== 'main' || current?.deployment_trigger?.metadata?.commit_hash !== expectedCommit) {
  throw new Error('Production branch or commit changed; retry stopped.');
}
console.log(
  JSON.stringify({
    branch: project.production_branch,
    commit: expectedCommit,
    deployment: current.id,
    apply: process.argv.includes('--apply'),
  })
);
if (process.argv.includes('--apply')) {
  const deployment = await cloudflareApi(auth, `${projectPath}/deployments/${current.id}/retry`, { method: 'POST' });
  for (let attempt = 0; attempt < 60; attempt++) {
    const status = await cloudflareApi(auth, `${projectPath}/deployments/${deployment.id}`);
    console.log(
      JSON.stringify({ deployment: status.id, stage: status.latest_stage?.name, status: status.latest_stage?.status })
    );
    if (status.latest_stage?.status === 'failure' || status.latest_stage?.status === 'canceled') {
      throw new Error('Deployment did not complete successfully.');
    }
    if (status.latest_stage?.name === 'deploy' && status.latest_stage.status === 'success') {
      if (status.deployment_trigger?.metadata?.commit_hash !== expectedCommit)
        throw new Error('Deployed commit mismatch.');
      console.log('Production retry completed with the expected commit.');
      break;
    }
    if (attempt === 59) throw new Error('Deployment verification timed out.');
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
}
