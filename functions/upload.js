import { assertAllowedOrigin, enforceRateLimit, jsonResponse } from './_lib/http-security.js';
import {
  PET_PHOTO_MAX_BYTES,
  PET_PHOTO_MAX_MB,
  hasValidPetPhotoSignature,
  isAllowedPetPhotoType,
  petPhotoTooLarge,
} from './_lib/pet-photo-upload.js';
import { cleanText, uploadFileToDrive } from './_lib/platform-integrations.js';

const MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

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

  if (!(await hasValidPetPhotoSignature(file))) {
    return jsonResponse({ success: false, message: 'The uploaded file is not a valid JPG or PNG image.' }, 400, origin);
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
