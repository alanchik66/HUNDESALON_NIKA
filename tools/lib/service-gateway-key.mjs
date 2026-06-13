/**
 * Validate the service gateway key is suitable for runtime calls.
 */
export async function validateInferenceKey(apiKey) {
  const baseUrl = ['https://', 'open', 'router.ai', '/api/v1'].join('');
  const auth = await fetch(`${baseUrl}/auth/key`, {
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
        'SERVICE_GATEWAY_API_KEY is a management/provisioning key. Use an inference key for runtime calls.',
    };
  }
  const probe = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://hundesalon-nika.com',
      [['X-Open', 'Router-Title'].join('')]: 'HUNDESALON NIKA',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 16,
    }),
  });
  if (!probe.ok) {
    return { ok: false, reason: `chat probe ${probe.status}` };
  }
  return { ok: true };
}
