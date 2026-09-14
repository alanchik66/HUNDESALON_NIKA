import {
  assertAllowedOrigin,
  enforceRateLimit,
  isRequestBodyTooLarge,
  jsonResponse,
  readJsonBody,
} from '../_lib/http-security.js';
import {
  cleanText,
  sendTelegramDocument,
  sendTelegramMessage,
  TELEGRAM_FILE_MAX_BYTES,
} from '../_lib/platform-integrations.js';
import {
  claimOneDriveCompletion,
  createOneDriveUploadSession,
  ensureOneDriveSessionFolder,
  getOneDriveAccessToken,
  getOneDriveDownloadUrl,
  getOneDriveItem,
  getOneDriveItemByContentIdentity,
  isOneDriveConfigured,
  oneDriveContentIdentity,
  oneDriveContentFileName,
  reconcileOneDriveContentCopies,
  releaseOneDriveCompletionClaim,
  saveOneDriveTranscript,
  signOneDriveUploadUrl,
  verifyOneDriveUploadUrl,
} from '../_lib/onedrive.js';
import {
  authenticateChatSession,
  formatChatCustomer,
  recordChatMessage,
  registerTelegramDelivery,
} from '../_lib/chat-crm.js';

export const AI_CHAT_UPLOAD_MAX_BYTES = 150 * 1024 * 1024;
export const AI_CHAT_UPLOAD_CHUNK_MAX_BYTES = 10 * 1024 * 1024;
const JSON_BODY_MAX_BYTES = 96 * 1024;
const TRANSCRIPT_MESSAGE_LIMIT = 24;
const TRANSCRIPT_CONTENT_LIMIT = 4000;
const CONTENT_HASH_RE = /^[a-f0-9]{64}$/;
const SESSION_ID_RE = /^[a-zA-Z0-9_-]{16,64}$/;

function normalizedFile(input) {
  const size = Number(input?.size);
  const rawName = cleanText(input?.fileName, 180).replace(/[\\/:*?"<>|]/g, '-').replace(/^\.+/, '');
  const fileName = rawName || 'attachment';
  const rawType = cleanText(input?.mimeType, 120).toLowerCase().split(';', 1)[0].trim();
  const mimeType = /^[\w!#$&^_.+-]+\/[\w!#$&^_.+-]+$/.test(rawType)
    ? rawType
    : 'application/octet-stream';
  const kind = input?.kind === 'voice' ? 'voice' : 'file';
  const mode = input?.mode === 'human' ? 'human' : 'ai';
  const contentSha256 = cleanText(input?.contentSha256, 64).toLowerCase();
  const sessionId = cleanText(input?.sessionId, 80);
  return {
    valid:
      Number.isSafeInteger(size) &&
      size > 0 &&
      size <= AI_CHAT_UPLOAD_MAX_BYTES &&
      CONTENT_HASH_RE.test(contentSha256) &&
      SESSION_ID_RE.test(sessionId),
    fileName,
    size,
    mimeType,
    kind,
    mode,
    contentSha256,
    sessionId,
  };
}

function unconfigured(origin) {
  return jsonResponse(
    { success: false, configured: false, message: 'Secure OneDrive storage is not configured.' },
    503,
    origin
  );
}

async function sessionContext(env, sessionId) {
  if (!isOneDriveConfigured(env)) return null;
  const token = await getOneDriveAccessToken(env);
  if (!token) return null;
  const folder = await ensureOneDriveSessionFolder(env, token, sessionId);
  return folder?.id ? { token, folder } : null;
}

async function startUpload(env, payload, origin) {
  const file = normalizedFile(payload);
  if (!file.valid) {
    return jsonResponse({ success: false, message: 'Invalid file, session, or content hash.' }, 400, origin);
  }
  const session = await sessionContext(env, file.sessionId);
  if (!session) return unconfigured(origin);
  const contentIdentity = await oneDriveContentIdentity({ scope: 'ai-chat', ...file });
  const storedName = await oneDriveContentFileName({ scope: 'ai-chat', ...file });
  if (!contentIdentity || !storedName) {
    return jsonResponse({ success: false, message: 'Invalid file identity.' }, 400, origin);
  }

  const resolveExisting = async () => {
    const existing = await getOneDriveItemByContentIdentity(
      session.token,
      session.folder.id,
      contentIdentity,
      storedName
    );
    if (!existing.ok) return { response: jsonResponse({ success: false, message: 'Could not verify OneDrive storage.' }, 502, origin) };
    if (!existing.item) return { item: null };
    if (!existing.item.file || Number(existing.item.size) !== file.size) {
      return { response: jsonResponse({ success: false, message: 'OneDrive content identity conflict.' }, 409, origin) };
    }
    return {
      response: jsonResponse(
        {
          success: true,
          deduplicated: true,
          storage: 'onedrive',
          fileId: existing.item.id,
          fileName: file.fileName,
          size: file.size,
          mimeType: file.mimeType,
        },
        200,
        origin
      ),
    };
  };

  const existing = await resolveExisting();
  if (existing.response) return existing.response;
  const upload = await createOneDriveUploadSession(env, session.token, session.folder.id, storedName);
  if (upload?.conflict) {
    const raced = await resolveExisting();
    return raced.response || jsonResponse({ success: false, message: 'OneDrive upload conflict.' }, 409, origin);
  }
  if (!upload?.uploadUrl) {
    return jsonResponse({ success: false, message: 'Could not start the secure OneDrive upload.' }, 502, origin);
  }
  const uploadSignature = await signOneDriveUploadUrl(env, upload.uploadUrl);
  if (!uploadSignature) return unconfigured(origin);
  return jsonResponse(
    {
      success: true,
      uploadUrl: upload.uploadUrl,
      uploadSignature,
      fileName: file.fileName,
      size: file.size,
      mimeType: file.mimeType,
      chunkSize: AI_CHAT_UPLOAD_CHUNK_MAX_BYTES,
    },
    200,
    origin
  );
}

async function completeUpload(env, payload, origin, crmSession) {
  const file = normalizedFile(payload);
  if (!file.valid) {
    return jsonResponse({ success: false, message: 'Invalid file, session, or content hash.' }, 400, origin);
  }
  const fileId = cleanText(payload?.fileId, 220);
  if (!/^[\w!.-]{10,220}$/.test(fileId)) {
    return jsonResponse({ success: false, message: 'Invalid uploaded file identifier.' }, 400, origin);
  }
  const session = await sessionContext(env, file.sessionId);
  if (!session) return unconfigured(origin);
  const contentIdentity = await oneDriveContentIdentity({ scope: 'ai-chat', ...file });
  const expectedName = await oneDriveContentFileName({ scope: 'ai-chat', ...file });
  let item = await getOneDriveItem(session.token, fileId);
  let deduplicated = false;
  if (!item) {
    const existing = await getOneDriveItemByContentIdentity(
      session.token,
      session.folder.id,
      contentIdentity,
      expectedName
    );
    if (!existing.ok) {
      return jsonResponse({ success: false, message: 'Could not verify OneDrive storage.' }, 502, origin);
    }
    item = existing.item;
    deduplicated = Boolean(item);
  }
  let size = Number(item?.size);
  const identityName = item?.name === contentIdentity || item?.name?.startsWith(`${contentIdentity}.`);
  deduplicated = deduplicated || item?.id !== fileId || item?.name !== expectedName;
  if (
    item?.parentReference?.id !== session.folder.id ||
    !identityName ||
    !item?.file ||
    !Number.isSafeInteger(size) ||
    size !== file.size
  ) {
    return jsonResponse({ success: false, message: 'Uploaded OneDrive file did not pass verification.' }, 400, origin);
  }
  const reconciled = await reconcileOneDriveContentCopies(
    session.token,
    session.folder.id,
    contentIdentity,
    item,
    file.size
  );
  if (!reconciled.ok || !reconciled.item) {
    return jsonResponse({ success: false, message: 'Could not reconcile OneDrive content.' }, 502, origin);
  }
  deduplicated = deduplicated || reconciled.deduplicated || reconciled.item.id !== fileId;
  item = reconciled.item;
  const deliveryItem = await getOneDriveItem(session.token, item.id);
  if (deliveryItem?.id === item.id) item = deliveryItem;
  size = Number(item.size);
  const receipt = await claimOneDriveCompletion(env, session.token, session.folder.id, contentIdentity, {
    fileId: item.id,
    contentSha256: file.contentSha256,
    completedAt: new Date().toISOString(),
  });
  if (!receipt.ok) {
    return jsonResponse({ success: false, message: 'Could not record upload completion.' }, 502, origin);
  }
  if (!receipt.claimed) {
    return jsonResponse(
      {
        success: true,
        fileId: item.id,
        fileUrl: cleanText(item.webUrl, 1000),
        storage: 'onedrive',
        deduplicated: true,
        notified: false,
        completionClaimed: false,
        retryable: false,
        notificationSkipped: true,
      },
      200,
      origin
    );
  }
  const sourceMessageId = cleanText(payload?.clientMessageId, 80);
  await recordChatMessage(env, crmSession, {
    id: sourceMessageId,
    direction: 'inbound',
    channel: 'web',
    kind: file.kind,
    body: file.fileName,
    fileName: file.fileName,
    mimeType: cleanText(item.file?.mimeType, 140) || file.mimeType,
    fileSize: size,
    oneDriveItemId: item.id,
    oneDriveUrl: cleanText(item.webUrl, 1000),
  });
  const kind = file.kind === 'voice' ? 'Голосовое сообщение' : 'Файл';
  const personalMode = file.mode === 'human';
  const telegramCategory = personalMode ? 'personal' : 'messages';
  const link = cleanText(item.webUrl, 1000);
  const telegramCaption = [
    `📎 ${kind} из ${personalMode ? 'личной консультации сайта' : 'AI-чата сайта'}`,
    `Имя: ${file.fileName}`,
    `Размер: ${(size / 1024 / 1024).toFixed(2)} МБ`,
    `Тип: ${cleanText(item.file?.mimeType, 140) || 'application/octet-stream'}`,
    `Язык: ${cleanText(payload?.locale, 8) || '—'}`,
    formatChatCustomer(crmSession),
    'Хранилище: OneDrive',
    link,
  ].join('\n');
  const downloadUrl =
    String(item?.['@microsoft.graph.downloadUrl'] || '').trim() ||
    (await getOneDriveDownloadUrl(session.token, item.id));
  const telegramFileEligible = size <= TELEGRAM_FILE_MAX_BYTES;
  const telegramDelivery = telegramFileEligible ? 'file' : 'link';
  let notification = { ok: false, skipped: false };
  try {
    if (telegramFileEligible) {
      notification = await sendTelegramDocument(env, {
        category: telegramCategory,
        documentUrl: downloadUrl,
        fileName: file.fileName,
        fileSize: size,
        mimeType: cleanText(item.file?.mimeType, 140) || file.mimeType,
        caption: telegramCaption,
      });
    } else {
      notification = await sendTelegramMessage(env, {
        category: telegramCategory,
        text: `${telegramCaption}\nОригинал больше 50 МБ: Telegram Bot API не принимает такой файл, поэтому используйте ссылку OneDrive.`,
      });
    }
  } catch (error) {
    console.error('[ai-chat-upload] Staff notification failed', String(error?.name || 'Error').slice(0, 80));
  }
  const telegramDelivered = Boolean(notification?.ok && notification?.body?.ok !== false);
  if (telegramDelivered) {
    await registerTelegramDelivery(env, crmSession, notification, sourceMessageId).catch(() => false);
  }
  let retryable = false;
  if (!telegramDelivered) {
    console.error(
      '[ai-chat-upload] Telegram delivery rejected',
      JSON.stringify({
        status: Number(notification?.status) || 0,
        skipped: Boolean(notification?.skipped),
        reason: cleanText(notification?.reason, 120),
        code: Number(notification?.body?.error_code) || 0,
        description: cleanText(notification?.body?.description, 200),
      })
    );
    try {
      retryable = await releaseOneDriveCompletionClaim(session.token, session.folder.id, contentIdentity);
    } catch {
      retryable = false;
    }
    if (!retryable) console.error('[ai-chat-upload] Could not release failed notification claim.');
  }
  return jsonResponse(
    {
      success: true,
      fileId: item.id,
      fileUrl: link,
      storage: 'onedrive',
      deduplicated,
      notified: telegramDelivered,
      completionClaimed: true,
      retryable,
      notificationSkipped: Boolean(notification?.skipped),
      telegramDelivery: telegramDelivered ? telegramDelivery : 'pending',
      telegramFileAttached: Boolean(telegramDelivered && telegramDelivery === 'file'),
    },
    200,
    origin
  );
}

function normalizedTranscript(payload) {
  const messages = Array.isArray(payload?.messages) ? payload.messages.slice(-TRANSCRIPT_MESSAGE_LIMIT) : [];
  return {
    source: 'hundesalon-ai-chat',
    sessionId: cleanText(payload?.sessionId, 80),
    locale: cleanText(payload?.locale, 8),
    pagePath: cleanText(payload?.pagePath, 240),
    updatedAt: new Date().toISOString(),
    revision: Number(payload?.revision),
    messages: messages
      .map(message => ({
        role: message?.role === 'assistant' ? 'assistant' : 'user',
        content: cleanText(message?.content, TRANSCRIPT_CONTENT_LIMIT),
        attachment:
          message?.attachment && typeof message.attachment === 'object'
            ? {
                name: cleanText(message.attachment.name, 180),
                size: Number(message.attachment.size) || 0,
                mimeType: cleanText(message.attachment.mimeType, 120),
                kind: message.attachment.kind === 'voice' ? 'voice' : 'file',
                delivered: message.attachment.delivered === true,
              }
            : null,
      }))
      .filter(message => message.content || message.attachment?.name),
  };
}

async function storeTranscript(env, payload, origin) {
  const transcript = normalizedTranscript(payload);
  if (
    !SESSION_ID_RE.test(transcript.sessionId) ||
    !Number.isSafeInteger(transcript.revision) ||
    transcript.revision < 1 ||
    !transcript.messages.length
  ) {
    return jsonResponse({ success: false, message: 'Transcript or session is invalid.' }, 400, origin);
  }
  const session = await sessionContext(env, transcript.sessionId);
  if (!session) return unconfigured(origin);
  const item = await saveOneDriveTranscript(session.token, session.folder.id, transcript.sessionId, transcript);
  if (!item?.id) {
    return jsonResponse({ success: false, message: 'Could not store the OneDrive transcript.' }, 502, origin);
  }
  return jsonResponse({ success: true, storage: 'onedrive', transcriptId: item.id }, 200, origin);
}

export async function proxyUploadChunk(request, env, origin) {
  const uploadUrl = cleanText(request.headers.get('X-Upload-Url'), 4096);
  const signature = cleanText(request.headers.get('X-Upload-Signature'), 128);
  const contentRange = cleanText(request.headers.get('Content-Range'), 100);
  const match = contentRange.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
  const contentLength = Number(request.headers.get('Content-Length'));
  if (!(await verifyOneDriveUploadUrl(env, uploadUrl, signature)) || !match) {
    return jsonResponse({ success: false, message: 'Invalid upload chunk.' }, 400, origin);
  }
  const limited = await enforceRateLimit(request, {
    route: `ai-chat-upload-chunk-${signature.slice(0, 16)}`,
    limit: 24,
    windowSec: 600,
  });
  if (limited) return limited;
  const [, rawStart, rawEnd, rawTotal] = match;
  const start = Number(rawStart);
  const end = Number(rawEnd);
  const total = Number(rawTotal);
  const chunkBytes = end - start + 1;
  const finalChunk = end === total - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    !Number.isSafeInteger(total) ||
    start < 0 ||
    end < start ||
    total < 1 ||
    total > AI_CHAT_UPLOAD_MAX_BYTES ||
    end >= total ||
    chunkBytes > AI_CHAT_UPLOAD_CHUNK_MAX_BYTES ||
    (!finalChunk && chunkBytes % (320 * 1024) !== 0) ||
    (Number.isFinite(contentLength) && contentLength !== chunkBytes)
  ) {
    return jsonResponse({ success: false, message: 'Upload chunk did not pass validation.' }, 400, origin);
  }
  const chunk = await request.arrayBuffer();
  if (chunk.byteLength !== chunkBytes) {
    return jsonResponse({ success: false, message: 'Upload chunk did not pass validation.' }, 400, origin);
  }
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Range': contentRange,
    },
    body: chunk,
  });
  if (response.status === 202) return jsonResponse({ success: true, complete: false }, 200, origin);
  if (response.status === 200 || response.status === 201) {
    const file = await response.json().catch(() => ({}));
    if (file?.id) return jsonResponse({ success: true, complete: true, file }, 200, origin);
  }
  if (response.status === 409) {
    return jsonResponse({ success: false, conflict: true, message: 'OneDrive item already exists.' }, 409, origin);
  }
  console.error('[ai-chat-upload] OneDrive chunk failed', JSON.stringify({ status: response.status }));
  return jsonResponse({ success: false, message: 'Could not upload the OneDrive file chunk.' }, 502, origin);
}

export async function onRequestChunk({ request, env }) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  }
  const originCheck = assertAllowedOrigin(request);
  if (!originCheck.ok) return jsonResponse({ success: false, message: 'Forbidden' }, 403);
  return proxyUploadChunk(request, env, originCheck.origin);
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  }
  const originCheck = assertAllowedOrigin(request);
  if (!originCheck.ok) return jsonResponse({ success: false, message: 'Forbidden' }, 403);
  if (new URL(request.url).searchParams.get('action') === 'chunk') {
    return proxyUploadChunk(request, env, originCheck.origin);
  }
  let payload;
  try {
    payload = await readJsonBody(request, JSON_BODY_MAX_BYTES);
  } catch (error) {
    return jsonResponse(
      { success: false, message: isRequestBodyTooLarge(error) ? 'Request is too large.' : 'Invalid request body.' },
      isRequestBodyTooLarge(error) ? 413 : 400,
      originCheck.origin
    );
  }
  const action = ['start', 'complete', 'transcript'].includes(payload?.action) ? payload.action : '';
  if (!action) return jsonResponse({ success: false, message: 'Unknown upload action.' }, 400, originCheck.origin);
  const crmSession = await authenticateChatSession(env, payload?.sessionId, payload?.sessionToken);
  if (!crmSession) {
    return jsonResponse({ success: false, message: 'Session authorization required.' }, 401, originCheck.origin);
  }
  if (crmSession.conversation_mode === 'human') payload.mode = 'human';
  if (action !== 'transcript' && !/^[a-f0-9-]{36}$/i.test(cleanText(payload?.clientMessageId, 80))) {
    return jsonResponse({ success: false, message: 'Invalid client message identifier.' }, 400, originCheck.origin);
  }
  if (action === 'start' || action === 'complete' || action === 'transcript') {
    const limited = await enforceRateLimit(request, {
      route: `ai-chat-upload-${action}`,
      limit: action === 'transcript' ? 40 : action === 'start' ? 6 : 12,
      windowSec: 600,
    });
    if (limited) return limited;
  }
  if (action === 'start') return startUpload(env, payload, originCheck.origin);
  if (action === 'transcript') return storeTranscript(env, payload, originCheck.origin);
  return completeUpload(env, payload, originCheck.origin, crmSession);
}
