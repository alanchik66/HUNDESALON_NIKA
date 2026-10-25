import { spawn } from 'node:child_process';
import { ACCOUNT_ID, cloudflareApi, loadWranglerOAuth, refreshWranglerOAuth } from './lib/cloudflare-auth.mjs';

// Read-only log listener: never prints HTTP headers, bodies, or signed URLs.
const auth = await refreshWranglerOAuth(loadWranglerOAuth());
const project = await cloudflareApi(auth, `/accounts/${ACCOUNT_ID}/pages/projects/hundesalon-nika`);
const env = { ...process.env };
delete env.CLOUDFLARE_API_TOKEN;
const tail = spawn(
  process.execPath,
  [
    'node_modules/wrangler/bin/wrangler.js',
    'pages',
    'deployment',
    'tail',
    project.canonical_deployment.id,
    '--project-name',
    'hundesalon-nika',
    '--environment',
    'production',
    '--format',
    'json',
    '--method',
    'POST',
  ],
  { env, stdio: ['ignore', 'pipe', 'pipe'] }
);
let captured = '';
let diagnostic = '';
tail.stdout.on('data', chunk => {
  captured += chunk;
});
tail.stderr.on('data', chunk => { diagnostic += chunk; });
try {
  console.log(`Read-only diagnostic listener started for ${project.canonical_deployment.id}.`);
  await new Promise(resolve => setTimeout(resolve, 45000));
  const messages = [...captured.matchAll(/"message"\s*:\s*(\[[\s\S]*?\])/g)]
    .flatMap(match => {
      try {
        return JSON.parse(match[1]);
      } catch {
        return [];
      }
    })
    .filter(
      value => typeof value === 'string' && /booking_confirmation_failed|booking_google_request_failed/.test(value)
    );
  console.log(JSON.stringify({ messages, listenerExitCode: tail.exitCode,
    diagnostic: diagnostic.replace(/https?:\/\/\S+/g, '[URL]').replace(/Bearer\s+\S+/g, '[TOKEN]').slice(-1200) }));
  if (tail.exitCode) process.exitCode = 1;
} finally {
  tail.kill();
}
