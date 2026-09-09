import {
  assertAllowedOrigin,
  enforceRateLimit,
  isRequestBodyTooLarge,
  jsonResponse,
  readJsonBody,
} from '../_lib/http-security.js';
import {
  cleanText,
  getGoogleAccessToken,
  getGoogleOAuthAccessToken,
  sendTelegramMessage,
} from '../_lib/platform-integrations.js';

export const AI_CHAT_UPLOAD_MAX_BYTES = 150 * 1024 * 1024;
const JSON_BODY_MAX_BYTES = 16 * 1024;
const DRIVE_SCOPE = ['https://www.googleapis.com/auth/drive.file'];
const DRIVE_UPLOAD_URL =
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,mimeType,webViewLink,parents';

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

async function driveToken(env) {
  return (await getGoogleAccessToken(env, DRIVE_SCOPE)) || (await getGoogleOAuthAccessToken(env));
}

function unconfigured(origin) {
  return jsonResponse(
    { success: false, configured: false, message: 'Secure file storage is not configured.' },
    503,
    origin
  );
}

async function startUpload(env, payload, origin) {
  const file = normalizedFile(payload);
  if (!file.valid) {
    return jsonResponse({ success: false, message: 'File must be between 1 byte and 150 MB.' }, 400, origin);
  }

  const folderId = cleanText(env?.DRIVE_UPLOAD_FOLDER, 160);
  const token = await driveToken(env);
  if (!folderId || !token) return unconfigured(origin);

  const locale = cleanText(payload?.locale, 8);
  const sessionId = cleanText(payload?.sessionId, 80);
  const pagePath = cleanText(payload?.pagePath, 240);
  const metadata = {
    name: `${Date.now()}-${crypto.randomUUID()}-${file.fileName}`,
    parents: [folderId],
    description: JSON.stringify({ source: 'ai-chat', kind: file.kind, locale, sessionId, pagePath }),
  };
  const response = await fetch(DRIVE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Length': String(file.size),
      'X-Upload-Content-Type': file.mimeType,
    },
    body: JSON.stringify(metadata),
  });
  const uploadUrl = response.headers.get('location') || '';
  if (!response.ok || !uploadUrl.startsWith('https://www.googleapis.com/upload/')) {
    console.error('[ai-chat-upload] Drive session failed', JSON.stringify({ status: response.status }));
    return jsonResponse({ success: false, message: 'Could not start the secure upload.' }, 502, origin);
  }

  return jsonResponse(
    {
      success: true,
      uploadUrl,
      fileName: file.fileName,
      size: file.size,
      mimeType: file.mimeType,
      chunkSize: 8 * 1024 * 1024,
    },
    200,
    origin
  );
}

async function completeUpload(env, payload, origin) {
  const fileId = cleanText(payload?.fileId, 160);
  if (!/^[\w-]{10,160}$/.test(fileId)) {
    return jsonResponse({ success: false, message: 'Invalid uploaded file identifier.' }, 400, origin);
  }

  const folderId = cleanText(env?.DRIVE_UPLOAD_FOLDER, 160);
  const token = await driveToken(env);
  if (!folderId || !token) return unconfigured(origin);

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,size,mimeType,webViewLink,parents`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) {
    return jsonResponse({ success: false, message: 'Uploaded file verification failed.' }, 502, origin);
  }

  const driveFile = await response.json();
  const size = Number(driveFile?.size);
  if (
    driveFile?.id !== fileId ||
    !Array.isArray(driveFile?.parents) ||
    !driveFile.parents.includes(folderId) ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > AI_CHAT_UPLOAD_MAX_BYTES
  ) {
    return jsonResponse({ success: false, message: 'Uploaded file did not pass verification.' }, 400, origin);
  }

  const kind = payload?.kind === 'voice' ? 'Голосовое сообщение' : 'Файл';
  const link = cleanText(driveFile.webViewLink, 800) || `https://drive.google.com/file/d/${fileId}/view`;
  const notification = await sendTelegramMessage(env, {
    category: 'messages',
    text: [
      `📎 ${kind} из AI-чата сайта`,
      `Имя: ${cleanText(driveFile.name, 220)}`,
      `Размер: ${(size / 1024 / 1024).toFixed(2)} МБ`,
      `Тип: ${cleanText(driveFile.mimeType, 140) || 'application/octet-stream'}`,
      `Язык: ${cleanText(payload?.locale, 8) || '—'}`,
      link,
    ].join('\n'),
  });

  return jsonResponse(
    {
      success: true,
      fileId,
      fileUrl: link,
      notified: Boolean(notification?.ok),
      notificationSkipped: Boolean(notification?.skipped),
    },
    200,
    origin
  );
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  }

  const originCheck = assertAllowedOrigin(request);
  if (!originCheck.ok) return jsonResponse({ success: false, message: 'Forbidden' }, 403);

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

  const action = payload?.action === 'complete' ? 'complete' : payload?.action === 'start' ? 'start' : '';
  if (!action) return jsonResponse({ success: false, message: 'Unknown upload action.' }, 400, originCheck.origin);

  const rateLimited = await enforceRateLimit(request, {
    route: `ai-chat-upload-${action}`,
    limit: action === 'start' ? 6 : 12,
    windowSec: 600,
  });
  if (rateLimited) {
    return jsonResponse({ success: false, message: 'Too many uploads. Please try again later.' }, 429, originCheck.origin);
  }

  return action === 'start'
    ? startUpload(env, payload, originCheck.origin)
    : completeUpload(env, payload, originCheck.origin);
}
