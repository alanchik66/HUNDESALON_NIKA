import { assertAllowedOrigin, enforceRateLimit, jsonResponse } from './_lib/http-security.js';
import {
  PET_PHOTO_MAX_BYTES,
  PET_PHOTO_MAX_MB,
  PET_PHOTO_PROXY_MAX_BYTES,
  isAllowedPetPhotoType,
  petPhotoTooLarge,
} from './_lib/pet-photo-upload.js';
import { cleanText, createDriveResumableUploadSession, uploadFileToDrive } from './_lib/platform-integrations.js';

/** Read a field from JSON payloads or multipart FormData (FormData has no property access). */
function readUploadField(fields, key) {
  if (fields == null) return '';
  if (typeof fields.get === 'function') return fields.get(key);
  return fields[key];
}

export function bookingMetadata(fields) {
  return {
    lang: cleanText(readUploadField(fields, 'lang'), 8),
    service: cleanText(readUploadField(fields, 'service'), 160),
    date: cleanText(readUploadField(fields, 'date'), 32),
    time: cleanText(readUploadField(fields, 'time'), 32),
  };
}

function driveNotConfiguredResponse(origin) {
  return jsonResponse(
    {
      success: true,
      configured: false,
      fileUrl: '',
      message: 'Drive upload is not configured yet. Booking can continue without a file link.',
    },
    200,
    origin
  );
}

async function handleUploadSession(request, env, origin) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ success: false, message: 'Invalid JSON body' }, 400, origin);
  }

  if (payload?.intent !== 'session') {
    return jsonResponse({ success: false, message: 'Unsupported upload intent' }, 400, origin);
  }

  const mimeType = String(payload.mimeType || '').toLowerCase();
  const fileSize = Number(payload.size);
  if (!isAllowedPetPhotoType(mimeType)) {
    return jsonResponse({ success: false, message: 'Only JPG and PNG files are accepted.' }, 400, origin);
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return jsonResponse({ success: false, message: 'Invalid file size' }, 400, origin);
  }
  if (petPhotoTooLarge(fileSize)) {
    return jsonResponse({ success: false, message: `File is larger than ${PET_PHOTO_MAX_MB} MB.` }, 400, origin);
  }

  const metadata = bookingMetadata(payload);
  const safeName = String(payload.fileName || 'pet-photo').replace(/[^\w.-]+/g, '-').slice(-90);
  const sessionResult = await createDriveResumableUploadSession(env, {
    fileName: safeName,
    mimeType,
    fileSize,
    metadata,
  });

  if (sessionResult.skipped) {
    return driveNotConfiguredResponse(origin);
  }

  if (!sessionResult.ok || !sessionResult.uploadUrl) {
    return jsonResponse({ success: false, message: 'Could not start upload session.' }, 502, origin);
  }

  return jsonResponse(
    {
      success: true,
      configured: true,
      uploadUrl: sessionResult.uploadUrl,
      fileName: sessionResult.fileName || safeName,
    },
    200,
    origin
  );
}

async function handleMultipartUpload(request, env, origin) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ success: false, message: 'Invalid upload body' }, 400, origin);
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

  if (file.size > PET_PHOTO_PROXY_MAX_BYTES) {
    return jsonResponse(
      {
        success: false,
        message: `Files above ${Math.floor(PET_PHOTO_PROXY_MAX_BYTES / (1024 * 1024))} MB must use direct upload.`,
      },
      400,
      origin
    );
  }

  const safeName = file.name.replace(/[^\w.-]+/g, '-').slice(-90);
  const uniqueName = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const uploadResult = await uploadFileToDrive(env, {
    file,
    fileName: uniqueName,
    metadata: bookingMetadata(formData),
  });

  if (uploadResult.ok && uploadResult.body?.webViewLink) {
    return jsonResponse(
      { success: true, fileUrl: uploadResult.body.webViewLink, fileId: uploadResult.body.id || null },
      200,
      origin
    );
  }

  if (uploadResult.skipped) {
    return driveNotConfiguredResponse(origin);
  }

  return jsonResponse({ success: false, message: 'Drive upload failed.' }, 502, origin);
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
    return jsonResponse({ success: false, message: 'Too many uploads. Please try again later.' }, 429, originCheck.origin);
  }

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return handleUploadSession(request, env, originCheck.origin);
  }

  return handleMultipartUpload(request, env, originCheck.origin);
}
