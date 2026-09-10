import {
  assertAllowedOrigin,
  enforceRateLimit,
  isRequestBodyTooLarge,
  jsonResponse,
  readJsonBody,
} from '../_lib/http-security.js';
import { cleanText, sendTelegramMessage } from '../_lib/platform-integrations.js';
import {
  createOneDriveUploadSession,
  ensureOneDriveSessionFolder,
  getOneDriveAccessToken,
  getOneDriveItem,
  isOneDriveConfigured,
  saveOneDriveTranscript,
  signOneDriveUploadUrl,
  verifyOneDriveUploadUrl,
} from '../_lib/onedrive.js';

export const AI_CHAT_UPLOAD_MAX_BYTES = 150 * 1024 * 1024;
export const AI_CHAT_UPLOAD_CHUNK_MAX_BYTES = 10 * 1024 * 1024;
const JSON_BODY_MAX_BYTES = 96 * 1024;
const TRANSCRIPT_MESSAGE_LIMIT = 24;
const TRANSCRIPT_CONTENT_LIMIT = 4000;

function normalizedFile(input) {
  const size = Number(input?.size);
  const rawName = cleanText(input?.fileName, 180).replace(/[\\/:*?"<>|]/g, '-').replace(/^\.+/, '');
  const fileName = rawName || 'attachment';
  const rawType = cleanText(input?.mimeType, 120).toLowerCase().split(';', 1)[0].trim();
  const mimeType = /^[\w!#$&^_.+-]+\/[\w!#$&^_.+-]+$/.test(rawType)
    ? rawType
    : 'application/octet-stream';
  const kind = input?.kind === 'voice' ? 'voice' : 'file';
  return {
    valid: Number.isSafeInteger(size) && size > 0 && size <= AI_CHAT_UPLOAD_MAX_BYTES,
    fileName,
    size,
    mimeType,
    kind,
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
    return jsonResponse({ success: false, message: 'File must be between 1 byte and 150 MB.' }, 400, origin);
  }
  const session = await sessionContext(env, payload?.sessionId);
  if (!session) return unconfigured(origin);
  const storedName = `${Date.now()}-${crypto.randomUUID()}-${file.fileName}`;
  const upload = await createOneDriveUploadSession(env, session.token, session.folder.id, storedName);
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

async function completeUpload(env, payload, origin) {
  const fileId = cleanText(payload?.fileId, 220);
  if (!/^[\w!.-]{10,220}$/.test(fileId)) {
    return jsonResponse({ success: false, message: 'Invalid uploaded file identifier.' }, 400, origin);
  }
  const session = await sessionContext(env, payload?.sessionId);
  if (!session) return unconfigured(origin);
  const item = await getOneDriveItem(session.token, fileId);
  const size = Number(item?.size);
  if (
    item?.id !== fileId ||
    item?.parentReference?.id !== session.folder.id ||
    !item?.file ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > AI_CHAT_UPLOAD_MAX_BYTES
  ) {
    return jsonResponse({ success: false, message: 'Uploaded OneDrive file did not pass verification.' }, 400, origin);
  }
  const kind = payload?.kind === 'voice' ? 'Голосовое сообщение' : 'Файл';
  const link = cleanText(item.webUrl, 1000);
  const notification = await sendTelegramMessage(env, {
    category: 'messages',
    text: [
      `📎 ${kind} из AI-чата сайта`,
      `Имя: ${cleanText(item.name, 220)}`,
      `Размер: ${(size / 1024 / 1024).toFixed(2)} МБ`,
      `Тип: ${cleanText(item.file?.mimeType, 140) || 'application/octet-stream'}`,
      `Язык: ${cleanText(payload?.locale, 8) || '—'}`,
      'Хранилище: OneDrive',
      link,
    ].join('\n'),
  });
  return jsonResponse(
    {
      success: true,
      fileId,
      fileUrl: link,
      storage: 'onedrive',
      notified: Boolean(notification?.ok),
      notificationSkipped: Boolean(notification?.skipped),
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
  if (!transcript.sessionId || !transcript.messages.length) {
    return jsonResponse({ success: false, message: 'Transcript is empty.' }, 400, origin);
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
  if (action === 'start' || action === 'transcript') {
    const limited = await enforceRateLimit(request, {
      route: `ai-chat-upload-${action}`,
      limit: action === 'start' ? 6 : 40,
      windowSec: 600,
    });
    if (limited) return limited;
  }
  if (action === 'start') return startUpload(env, payload, originCheck.origin);
  if (action === 'transcript') return storeTranscript(env, payload, originCheck.origin);
  return completeUpload(env, payload, originCheck.origin);
}
