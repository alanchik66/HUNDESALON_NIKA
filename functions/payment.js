import { assertAllowedOrigin, jsonResponse } from './_lib/http-security.js';
import { cleanText, getEnvValue, hasUsableValue } from './_lib/platform-integrations.js';

export async function onRequest(context) {
  const { request, env } = context;
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
    provider: cleanText(body.provider || '', 32),
  };

  const paymentKey = getEnvValue(env, 'PAYMENT_PROVIDER_KEY');
  if (!hasUsableValue(paymentKey)) {
    return jsonResponse(
      {
        success: false,
        status: 'not-configured',
        message:
          'Payment integration is disabled. Configure PAYMENT_PROVIDER_KEY in Cloudflare Pages secrets and implement provider-specific logic in functions/payment.js.',
      },
      501,
      originCheck.origin
    );
  }

  return jsonResponse(
    {
      success: false,
      status: 'not-implemented',
      message:
        'Payment integration is configured in environment, but the provider flow is not implemented yet. Add Stripe or PayPal server-side SDK/API calls before enabling live payments.',
      payment,
    },
    501,
    originCheck.origin
  );
}
