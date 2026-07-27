/**
 * Smoke-test production message draft endpoint.
 * Retries briefly: custom-domain → Pages proxy can lag a few seconds after deploy.
 */
const url = process.env.MESSAGE_DRAFT_CHECK_URL || 'https://hundesalon-nika.com/message-draft';
const origin = process.env.MESSAGE_DRAFT_CHECK_ORIGIN || 'https://hundesalon-nika.com';
const attempts = Math.max(1, Number(process.env.MESSAGE_DRAFT_CHECK_ATTEMPTS || 5));
const delayMs = Math.max(0, Number(process.env.MESSAGE_DRAFT_CHECK_DELAY_MS || 2500));

const payload = JSON.stringify({
  messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
  max_tokens: 32,
});
const authorization = process.env.MESSAGE_DRAFT_CHECK_SECRET?.trim();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let lastStatus = 0;
let lastBody = '';

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
      ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
    },
    body: payload,
  });

  lastStatus = response.status;
  lastBody = (await response.text()).slice(0, 300);

  if (response.ok || (!authorization && response.status === 401)) {
    if (!response.ok) {
      console.log(`Message draft endpoint correctly rejects unauthenticated calls (${url}, status ${response.status})`);
    } else {
    console.log(`Message draft endpoint OK (${url}, status ${response.status})`);
    }
    process.exitCode = 0;
    break;
  }

  if (attempt < attempts) {
    console.warn(`Message draft check attempt ${attempt}/${attempts}: ${lastStatus} — retry in ${delayMs}ms`);
    await sleep(delayMs);
    continue;
  }

  console.error(`Message draft check failed: ${lastStatus}\n${lastBody}`);
  process.exitCode = 1;
}
