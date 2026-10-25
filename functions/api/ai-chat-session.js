import { assertAllowedOrigin, enforceRateLimit, isRequestBodyTooLarge, jsonResponse, readJsonBody } from '../_lib/http-security.js';
import {
  authenticateChatSession,
  listChatReplies,
  registerChatCustomer,
  renewChatSession,
  setChatSessionMode,
} from '../_lib/chat-crm.js';
import { sendSendPulseAutomationEvent } from '../_lib/platform-integrations.js';

const MAX_BODY_BYTES = 16 * 1024;

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  }
  const originCheck = assertAllowedOrigin(request);
  if (!originCheck.ok) return jsonResponse({ success: false, error: 'Forbidden' }, 403);
  const limited = await enforceRateLimit(request, { route: 'ai-chat-session', limit: 20, windowSec: 60 });
  if (limited) return limited;

  let payload;
  try {
    payload = await readJsonBody(request, MAX_BODY_BYTES);
  } catch (error) {
    return jsonResponse(
      { success: false, error: isRequestBodyTooLarge(error) ? 'Payload too large' : 'Invalid request' },
      isRequestBodyTooLarge(error) ? 413 : 400,
      originCheck.origin
    );
  }

  if (payload?.action === 'register') {
    const result = await registerChatCustomer(env, payload);
    if (!result.ok) {
      return jsonResponse(
        { success: false, error: result.code },
        result.code === 'NOT_CONFIGURED' ? 503 : result.code === 'INVALID_PROFILE' ? 400 : 502,
        originCheck.origin
      );
    }
    const contactSync = await sendSendPulseAutomationEvent(env, {
      eventType: 'client_registration',
      data: {
        email: result.customer.email,
        first_name: result.customer.first_name,
        last_name: result.customer.last_name,
        phone: result.customer.phone,
        language: result.customer.locale,
        source: 'website_ai_chat',
        chat_session_id: result.sessionId,
      },
    }).catch(() => ({ ok: false }));
    return jsonResponse(
      {
        success: true,
        sessionId: result.sessionId,
        sessionToken: result.token,
        customer: {
          firstName: result.customer.first_name,
          lastName: result.customer.last_name,
          email: result.customer.email,
          phone: result.customer.phone,
        },
        sendPulseSynced: contactSync?.ok === true,
      },
      200,
      originCheck.origin
    );
  }

  const session = await authenticateChatSession(env, payload?.sessionId, payload?.sessionToken);
  if (!session) return jsonResponse({ success: false, error: 'Session authorization required' }, 401, originCheck.origin);

  if (payload?.action === 'set-mode') {
    if (!['ai', 'human'].includes(payload?.mode)) {
      return jsonResponse({ success: false, error: 'Invalid conversation mode' }, 400, originCheck.origin);
    }
    await setChatSessionMode(env, session.session_id, payload.mode);
    const updatedSession = await authenticateChatSession(env, payload.sessionId, payload.sessionToken);
    const updatedMode = updatedSession?.conversation_mode === 'human' ? 'human' : 'ai';
    if (!updatedSession || updatedMode !== payload.mode) {
      return jsonResponse({ success: false, error: 'Could not update conversation mode' }, 502, originCheck.origin);
    }
    return jsonResponse({ success: true, mode: updatedMode }, 200, originCheck.origin);
  }

  if (payload?.action === 'renew') {
    const renewed = await renewChatSession(env, payload.sessionId, payload.sessionToken, payload.pagePath);
    if (!renewed) return jsonResponse({ success: false, error: 'Could not renew session' }, 502, originCheck.origin);
    return jsonResponse({ success: true, sessionId: renewed.sessionId, sessionToken: renewed.token }, 200, originCheck.origin);
  }
  if (payload?.action === 'poll') {
    const replies = await listChatReplies(env, session, payload.afterSequence);
    return jsonResponse(
      { success: true, replies, mode: session.conversation_mode === 'human' ? 'human' : 'ai' },
      200,
      originCheck.origin
    );
  }
  return jsonResponse({ success: false, error: 'Unsupported action' }, 400, originCheck.origin);
}
