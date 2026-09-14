import { assertAllowedOrigin, enforceRateLimit, jsonResponse, readFormDataBody } from './_lib/http-security.js';
import {
  PET_PHOTO_MAX_BYTES,
  PET_PHOTO_MAX_MB,
  detectPetPhotoMimeType,
  isAllowedPetPhotoType,
  petPhotoTooLarge,
} from './_lib/pet-photo-upload.js';
import {
  ensureOneDriveSessionFolder,
  getOneDriveAccessToken,
  getOneDriveItemByContentIdentity,
  isOneDriveConfigured,
  oneDriveContentIdentity,
  oneDriveContentFileName,
  signOneDriveFileReference,
  uploadSmallFileToOneDrive,
} from './_lib/onedrive.js';
import { cleanText } from './_lib/platform-integrations.js';

const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;
const UPLOAD_SESSION_RE = /^[a-zA-Z0-9_-]{16,64}$/;

/** Read a field from multipart FormData (FormData has no property access). */
function readUploadField(fields, key) {
  return typeof fields?.get === 'function' ? fields.get(key) : '';
}

export function bookingMetadata(fields) {
  return {
    lang: cleanText(readUploadField(fields, 'lang'), 8),
    service: cleanText(readUploadField(fields, 'service'), 160),
    date: cleanText(readUploadField(fields, 'date'), 32),
    time: cleanText(readUploadField(fields, 'time'), 32),
  };
}

function oneDriveNotConfiguredResponse(origin) {
  return jsonResponse(
    {
      success: false,
      configured: false,
      fileUrl: '',
      message: 'Secure OneDrive storage is not configured. Remove the photo or try again later.',
    },
    503,
    origin
  );
}

function bytesToHex(value) {
  return Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function handleMultipartUpload(request, env, origin) {
  let formData;
  try {
    formData = await readFormDataBody(request, PET_PHOTO_MAX_BYTES + MULTIPART_OVERHEAD_BYTES);
  } catch {
    return jsonResponse({ success: false, message: 'Invalid or oversized upload body' }, 400, origin);
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return jsonResponse({ success: false, message: 'Missing file' }, 400, origin);
  }

  if (!isAllowedPetPhotoType(file.type)) {
    return jsonResponse({ success: false, message: 'Only JPG and PNG files are accepted.' }, 400, origin);
  }

  if (petPhotoTooLarge(file.size)) {
    return jsonResponse({ success: false, message: `File is larger than ${PET_PHOTO_MAX_MB} MB.` }, 400, origin);
  }

  const detectedMimeType = await detectPetPhotoMimeType(file);
  if (!detectedMimeType) {
    return jsonResponse({ success: false, message: 'The uploaded file is not a valid JPG or PNG image.' }, 400, origin);
  }

  const uploadSessionId = cleanText(readUploadField(formData, 'upload_session_id'), 80);
  if (!UPLOAD_SESSION_RE.test(uploadSessionId)) {
    return jsonResponse({ success: false, message: 'Invalid booking upload session.' }, 400, origin);
  }
  if (!isOneDriveConfigured(env)) return oneDriveNotConfiguredResponse(origin);

  const token = await getOneDriveAccessToken(env);
  if (!token) return oneDriveNotConfiguredResponse(origin);
  const folder = await ensureOneDriveSessionFolder(env, token, `booking-${uploadSessionId}`);
  if (!folder?.id) {
    return jsonResponse({ success: false, message: 'Could not prepare secure OneDrive storage.' }, 502, origin);
  }

  const contentSha256 = bytesToHex(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
  const contentIdentity = await oneDriveContentIdentity({
    scope: 'booking',
    sessionId: uploadSessionId,
    contentSha256,
  });
  const storedName = await oneDriveContentFileName({
    scope: 'booking',
    sessionId: uploadSessionId,
    contentSha256,
    fileName: file.name,
    mimeType: detectedMimeType,
  });
  if (!contentIdentity || !storedName) {
    return jsonResponse({ success: false, message: 'Invalid booking upload identity.' }, 400, origin);
  }
  const existing = await getOneDriveItemByContentIdentity(token, folder.id, contentIdentity, storedName);
  if (!existing.ok) {
    return jsonResponse({ success: false, message: 'Could not verify secure OneDrive storage.' }, 502, origin);
  }
  if (existing.item) {
    if (!existing.item.file || Number(existing.item.size) !== file.size) {
      return jsonResponse({ success: false, message: 'OneDrive upload conflict.' }, 409, origin);
    }
    const fileUrl = cleanText(existing.item.webUrl, 1000);
    const fileProof = await signOneDriveFileReference(env, {
      fileId: existing.item.id,
      fileUrl,
      sessionId: uploadSessionId,
    });
    if (!fileUrl || !fileProof) return jsonResponse({ success: false, message: 'OneDrive file proof failed.' }, 502, origin);
    return jsonResponse(
      {
        success: true,
        fileUrl,
        fileId: existing.item.id || null,
        fileProof,
        storage: 'onedrive',
        deduplicated: true,
      },
      200,
      origin
    );
  }

  const uploaded = await uploadSmallFileToOneDrive(token, folder.id, storedName, file, detectedMimeType);
  const item = uploaded.item;
  if (!uploaded.ok || !item?.id || !item?.file || Number(item.size) !== file.size) {
    return jsonResponse({ success: false, message: 'OneDrive upload failed.' }, 502, origin);
  }
  const fileUrl = cleanText(item.webUrl, 1000);
  const fileProof = await signOneDriveFileReference(env, {
    fileId: item.id,
    fileUrl,
    sessionId: uploadSessionId,
  });
  if (!fileUrl || !fileProof) return jsonResponse({ success: false, message: 'OneDrive file proof failed.' }, 502, origin);
  return jsonResponse(
    {
      success: true,
      fileUrl,
      fileId: item.id,
      fileProof,
      storage: 'onedrive',
      deduplicated: false,
      metadata: bookingMetadata(formData),
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
  if (!originCheck.ok) {
    return jsonResponse({ success: false, message: 'Forbidden' }, 403);
  }

  const rateLimited = await enforceRateLimit(request, { route: 'upload', limit: 8, windowSec: 60 });
  if (rateLimited) {
    return jsonResponse(
      { success: false, message: 'Too many uploads. Please try again later.' },
      429,
      originCheck.origin
    );
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    return jsonResponse({ success: false, message: 'Multipart upload required' }, 415, originCheck.origin);
  }

  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > PET_PHOTO_MAX_BYTES + MULTIPART_OVERHEAD_BYTES) {
    return jsonResponse({ success: false, message: 'Upload body is too large' }, 413, originCheck.origin);
  }

  return handleMultipartUpload(request, env, originCheck.origin);
}
