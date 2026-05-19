/**
 * Validate OpenRouter API key is suitable for chat (not provisioning/management only).
 */
export async function validateInferenceKey(apiKey) {
  const auth = await fetch('https://openrouter.ai/api/v1/auth/key', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!auth.ok) {
    return { ok: false, reason: `auth/key ${auth.status}` };
  }
  const payload = await auth.json();
  const data = payload?.data ?? payload;
  if (data?.is_provisioning_key || data?.is_management_key) {
    return {
      ok: false,
      reason:
        'OPENROUTER_API_KEY is a management/provisioning key. Use an inference key from https://openrouter.ai/keys',
    };
  }
  const probe = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://hundesalon-nika.com',
      'X-Title': 'HUNDESALON NIKA',
    },
    body: JSON.stringify({
      model: 'openai/gpt-5.2',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 16,
    }),
  });
  if (!probe.ok) {
    return { ok: false, reason: `chat probe ${probe.status}` };
  }
  return { ok: true };
}
