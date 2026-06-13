/**
 * Smoke-test production message draft endpoint.
 */
const url = process.env.MESSAGE_DRAFT_CHECK_URL || 'https://hundesalon-nika.com/message-draft';
const origin = process.env.MESSAGE_DRAFT_CHECK_ORIGIN || 'https://hundesalon-nika.com';

const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: origin },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
    max_tokens: 32,
  }),
});

if (!response.ok) {
  const body = (await response.text()).slice(0, 300);
  console.error(`Message draft check failed: ${response.status}\n${body}`);
  process.exit(1);
}

console.log(`Message draft endpoint OK (${url}, status ${response.status})`);
