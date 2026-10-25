import { spawn } from 'node:child_process';
import { ACCOUNT_ID, cloudflareApi, loadWranglerOAuth, refreshWranglerOAuth } from './lib/cloudflare-auth.mjs';
import {
  parseCloudflareTailEvents,
  readSendPulseEmailDiagnostics,
  sendPulseEmailWasAccepted,
} from './lib/cloudflare-tail-logs.mjs';

const auth = await refreshWranglerOAuth(loadWranglerOAuth());
const project = await cloudflareApi(auth, `/accounts/${ACCOUNT_ID}/pages/projects/hundesalon-nika`);
const env = { ...process.env };
delete env.CLOUDFLARE_API_TOKEN;
const tail = spawn(process.execPath, [
  'node_modules/wrangler/bin/wrangler.js', 'pages', 'deployment', 'tail', project.canonical_deployment.id,
  '--project-name', 'hundesalon-nika', '--environment', 'production', '--format', 'json',
  '--method', 'POST',
], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let captured = '';
let diagnostic = '';
tail.stdout.on('data', chunk => { captured += chunk; });
tail.stderr.on('data', chunk => { diagnostic += chunk; });
try {
  await new Promise(resolve => setTimeout(resolve, 8000));
  if (tail.exitCode !== null) {
    console.log((diagnostic || captured).replace(/Bearer\s+\S+/g, 'Bearer [redacted]').slice(-2000));
    throw new Error('Production log connection failed');
  }
  const test = spawn(process.execPath, ['tools/verify-client-register.mjs', '--public-http'], { env, stdio: 'inherit' });
  const code = await new Promise(resolve => test.on('close', resolve));
  if (code !== 0) throw new Error('Public registration test failed');
  await new Promise(resolve => setTimeout(resolve, 8000));
  // Emit status-only summaries; never print request bodies, addresses, or raw provider logs.
  const diagnostics = readSendPulseEmailDiagnostics(captured);
  console.log(JSON.stringify({
    cloudflareTailEventsSeen: parseCloudflareTailEvents(captured).length,
    tailOutputBytes: Buffer.byteLength(captured),
    tailStderrReceived: diagnostic.trim().length > 0,
    providerLogMessages: diagnostics,
    sendPulseAccepted: sendPulseEmailWasAccepted(diagnostics),
  }));
} finally {
  tail.kill();
}
