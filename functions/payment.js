import { assertAllowedOrigin, jsonResponse } from './_lib/http-security.js';
import { cleanText } from './_lib/platform-integrations.js';

export async function onRequest(context) {
  const { request } = context;
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  }

  const originCheck = assertAllowedOrigin(request);
  if (!originCheck.ok) {
    return jsonResponse({ success: false, message: 'Forbidden' }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const payment = {
    amount: cleanText(body.amount, 32),
    currency: cleanText(body.currency || 'EUR', 8),
    bookingId: cleanText(body.bookingId, 120),
    provider: cleanText(body.provider || 'TODO', 32),
  };

  // TODO: connect PayPal or Stripe here through a server-side SDK/API.
  // Never expose provider secret keys in browser JavaScript. Use Cloudflare env vars.
  return jsonResponse(
    {
      success: true,
      status: 'TODO',
      message: 'Payment integration placeholder. Connect PayPal or Stripe before enabling live payments.',
      payment,
    },
    200,
    originCheck.origin
  );
}
