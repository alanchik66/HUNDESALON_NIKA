import { assertAllowedOrigin, enforceRateLimit, jsonResponse } from './_lib/http-security.js';
import { cleanText, uploadFileToDrive } from './_lib/platform-integrations.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png']);

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

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ success: false, message: 'Invalid upload body' }, 400, originCheck.origin);
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return jsonResponse({ success: false, message: 'Missing file' }, 400, originCheck.origin);
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return jsonResponse({ success: false, message: 'Only JPG and PNG files are accepted.' }, 400, originCheck.origin);
  }

  if (file.size > MAX_FILE_SIZE) {
    return jsonResponse({ success: false, message: 'File is larger than 5 MB.' }, 400, originCheck.origin);
  }

  const safeName = file.name.replace(/[^\w.-]+/g, '-').slice(-90);
  const uniqueName = `${Date.now()}-${crypto.randomUUID()}-${safeName}`;
  const uploadResult = await uploadFileToDrive(env, {
    file,
    fileName: uniqueName,
    metadata: {
      lang: cleanText(formData.get('lang'), 8),
      service: cleanText(formData.get('service'), 160),
      date: cleanText(formData.get('date'), 32),
      time: cleanText(formData.get('time'), 32),
    },
  });

  if (uploadResult.ok && uploadResult.body?.webViewLink) {
    return jsonResponse(
      { success: true, fileUrl: uploadResult.body.webViewLink, fileId: uploadResult.body.id || null },
      200,
      originCheck.origin
    );
  }

  if (uploadResult.skipped) {
    return jsonResponse(
      {
        success: true,
        configured: false,
        fileUrl: '',
        message: 'Drive upload is not configured yet. Booking can continue without a file link.',
      },
      200,
      originCheck.origin
    );
  }

  return jsonResponse({ success: false, message: 'Drive upload failed.' }, 502, originCheck.origin);
}
