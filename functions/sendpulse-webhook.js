/**
 * Cloudflare Pages Function: POST /sendpulse-webhook
 * Receives SendPulse SMTP delivery events and acknowledges them safely.
 *
 * Required Pages secret: SENDPULSE_WEBHOOK_SECRET
 * SendPulse URL: /sendpulse-webhook?token=<same-secret>
 */

import {
  enforceRateLimit,
  isRequestBodyTooLarge,
  jsonResponse,
  readTextBody,
  timingSafeEqualStrings,
} from './_lib/http-security.js';
import { getEnvValue } from './_lib/platform-integrations.js';

const MAX_BODY_BYTES = 512 * 1024;

function getWebhookToken(request) {
  const headerToken = String(request.headers.get('X-SendPulse-Webhook-Secret') || '').trim();
  if (headerToken) return headerToken;
  return new URL(request.url).searchParams.get('token')?.trim() || '';
}

function getEventType(payload) {
  return String(payload?.event || payload?.event_type || payload?.type || payload?.status || 'unknown')
    .trim()
    .slice(0, 80);
}

function getEventId(payload) {
  return String(payload?.id || payload?.event_id || payload?.message_id || payload?.email_id || '')
    .trim()
    .slice(0, 120);
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  }

  const secret = getEnvValue(env, 'SENDPULSE_WEBHOOK_SECRET');
  if (!secret) {
    return jsonResponse({ error: 'Webhook is not configured' }, 503);
  }

  if (!(await timingSafeEqualStrings(getWebhookToken(request), secret))) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const rateLimited = await enforceRateLimit(request, {
    route: 'sendpulse-webhook',
    limit: 120,
    windowSec: 60,
  });
  if (rateLimited) return rateLimited;

  let rawBody;
  try {
    rawBody = await readTextBody(request, MAX_BODY_BYTES);
  } catch (error) {
    return jsonResponse(
      { error: isRequestBodyTooLarge(error) ? 'Payload too large' : 'Invalid request body' },
      isRequestBodyTooLarge(error) ? 413 : 400
    );
  }

  let payload;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const eventType = getEventType(payload);
  const eventId = getEventId(payload);
  console.info('SendPulse SMTP webhook accepted', { eventType, eventId: eventId || undefined });

  return jsonResponse({ ok: true, accepted: true }, 200);
}
