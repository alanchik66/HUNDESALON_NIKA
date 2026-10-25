import { createHash } from 'node:crypto';

const confirmation = '--confirm-live';
if (!process.argv.includes(confirmation)) {
  throw new Error(`This check creates a real OneDrive file and Telegram notification. Pass ${confirmation} to continue.`);
}

const baseUrl = new URL(
  process.argv.find(argument => /^https?:\/\//.test(argument)) || 'https://hundesalon-nika.com'
);
const endpoint = new URL('/api/ai-chat-upload', baseUrl);
const timestamp = new Date().toISOString();
const content = new TextEncoder().encode(
  `HUNDESALON_NIKA AI chat upload QA\nCreated: ${timestamp}\nPurpose: OneDrive and Telegram delivery verification.\n`
);
const contentSha256 = createHash('sha256').update(content).digest('hex');
const sessionId = 'production-live-smoke';

async function post(payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: baseUrl.origin,
    },
    body: JSON.stringify(payload),
  });
  const responseText = await response.text();
  let body = {};
  try {
    body = JSON.parse(responseText);
  } catch {
    body = {};
  }
  if (!response.ok || body.success !== true) {
    const diagnostic = {
      status: response.status,
      contentType: response.headers.get('content-type'),
      cfRay: response.headers.get('cf-ray'),
      message: body.message || responseText.replace(/\s+/g, ' ').trim().slice(0, 240) || 'unknown error',
    };
    throw new Error(`Upload endpoint failed: ${JSON.stringify(diagnostic)}`);
  }
  return body;
}

const fileName = `ai-chat-delivery-qa-${timestamp.replaceAll(/[:.]/g, '-')}.txt`;
const started = await post({
  action: 'start',
  fileName,
  size: content.byteLength,
  mimeType: 'text/plain',
  kind: 'file',
  locale: 'ru',
  sessionId,
  pagePath: '/ru/',
  contentSha256,
});

if (!started.uploadUrl || !started.uploadSignature) {
  throw new Error('OneDrive upload session was not returned by the server.');
}

const uploaded = await fetch(new URL('/api/ai-chat-upload-chunk', baseUrl), {
  method: 'POST',
  headers: {
    'Content-Length': String(content.byteLength),
    'Content-Type': 'application/octet-stream',
    'Content-Range': `bytes 0-${content.byteLength - 1}/${content.byteLength}`,
    'X-Upload-Url': started.uploadUrl,
    'X-Upload-Signature': started.uploadSignature,
    Origin: baseUrl.origin,
  },
  body: content,
});
const uploadResult = await uploaded.json().catch(() => ({}));
const oneDriveFile = uploadResult.file || {};
if (!uploaded.ok || uploadResult.complete !== true || !oneDriveFile.id) {
  throw new Error(`OneDrive upload failed with HTTP ${uploaded.status}.`);
}

const completionPayload = {
  action: 'complete',
  fileId: oneDriveFile.id,
  fileName,
  size: content.byteLength,
  mimeType: 'text/plain',
  kind: 'file',
  locale: 'ru',
  sessionId,
  contentSha256,
};
const completed = await post(completionPayload);

if (!completed.notified || completed.notificationSkipped || completed.telegramFileAttached !== true) {
  throw new Error('OneDrive accepted the file, but the original Telegram attachment was not confirmed by the server.');
}

const replayed = await post(completionPayload);
if (replayed.completionClaimed !== false || replayed.notificationSkipped !== true || replayed.deduplicated !== true) {
  throw new Error('A repeated completion was not suppressed by the deduplication receipt.');
}

console.log(
  JSON.stringify(
    {
      ok: true,
      endpoint: endpoint.origin,
      fileName,
      bytes: content.byteLength,
      oneDriveVerified: completed.storage === 'onedrive',
      telegramNotified: true,
      telegramOriginalAttached: true,
      duplicateReplaySuppressed: true,
    },
    null,
    2
  )
);
