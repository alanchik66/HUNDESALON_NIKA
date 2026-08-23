import { loadDevVars } from './lib/cloudflare-auth.mjs';

const API_URL = 'https://api.sendpulse.com';
const CORPORATE_DOMAIN = '@hundesalon-nika.com';

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] || '').trim().toLowerCase() : '';
}

async function getAccessToken() {
  loadDevVars();
  const apiKey = String(process.env.SENDPULSE_API_KEY || '').trim();
  if (apiKey) return apiKey;

  const clientId = String(process.env.SENDPULSE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.SENDPULSE_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) {
    throw new Error('SendPulse API credentials are not configured locally.');
  }

  const response = await fetch(`${API_URL}/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(`SendPulse authentication failed with status ${response.status}.`);
  }
  return payload.access_token;
}

async function sendPulseRequest(token, path, init = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.message || payload.error || `status ${response.status}`;
    throw new Error(`SendPulse request failed: ${message}`);
  }
  return payload;
}

async function listSenders(token) {
  const result = await sendPulseRequest(token, '/senders');
  return Array.isArray(result) ? result : [];
}

async function main() {
  const target = getArg('--email');
  const shouldDelete = process.argv.includes('--delete');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(target)) {
    throw new Error('Pass one valid sender with --email.');
  }
  if (target.endsWith(CORPORATE_DOMAIN)) {
    throw new Error('Refusing to delete a corporate sender.');
  }

  const token = await getAccessToken();
  const before = await listSenders(token);
  const sender = before.find(item => String(item.email || '').trim().toLowerCase() === target);
  if (!sender) {
    console.log(JSON.stringify({ target, present: false, deleted: false }));
    return;
  }
  if (!shouldDelete) {
    console.log(JSON.stringify({
      target,
      present: true,
      status: sender.status || '',
      name: sender.name || '',
      deleted: false,
    }));
    return;
  }

  const result = await sendPulseRequest(token, '/senders', {
    method: 'DELETE',
    body: JSON.stringify({ email: target }),
  });
  if (result.result !== true) {
    throw new Error('SendPulse did not confirm sender deletion.');
  }

  const after = await listSenders(token);
  const stillPresent = after.some(item => String(item.email || '').trim().toLowerCase() === target);
  if (stillPresent) {
    throw new Error('Sender is still present after the delete request.');
  }

  console.log(JSON.stringify({ target, present: false, deleted: true }));
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
