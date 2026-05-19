/**
 * Smoke-test production /openrouter proxy (uses min max_tokens OpenRouter accepts).
 */
const url = process.env.OPENROUTER_CHECK_URL || 'https://hundesalon-nika.com/openrouter';
const origin = process.env.OPENROUTER_CHECK_ORIGIN || 'https://hundesalon-nika.com';

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
  console.error(`OpenRouter proxy check failed: ${response.status}\n${body}`);
  process.exit(1);
}

console.log(`OpenRouter proxy OK (${url}, status ${response.status})`);
