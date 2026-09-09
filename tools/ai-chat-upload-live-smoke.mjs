const confirmation = '--confirm-live';
if (!process.argv.includes(confirmation)) {
  throw new Error(`This check creates a real Drive file and Telegram notification. Pass ${confirmation} to continue.`);
}

const baseUrl = new URL(
  process.argv.find(argument => /^https:\/\//.test(argument)) || 'https://hundesalon-nika.com'
);
const endpoint = new URL('/api/ai-chat-upload', baseUrl);
const timestamp = new Date().toISOString();
const content = new TextEncoder().encode(
  `HUNDESALON_NIKA AI chat upload QA\nCreated: ${timestamp}\nPurpose: Drive and Telegram delivery verification.\n`
);

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
  sessionId: 'production-live-smoke',
  pagePath: '/ru/',
});

const uploaded = await fetch(started.uploadUrl, {
  method: 'PUT',
  headers: {
    'Content-Length': String(content.byteLength),
    'Content-Type': 'text/plain',
  },
  body: content,
});
const driveFile = await uploaded.json().catch(() => ({}));
if (!uploaded.ok || !driveFile.id) {
  throw new Error(`Google Drive upload failed with HTTP ${uploaded.status}.`);
}

const completed = await post({
  action: 'complete',
  fileId: driveFile.id,
  kind: 'file',
  locale: 'ru',
});

if (!completed.notified || completed.notificationSkipped) {
  throw new Error('Drive accepted the file, but Telegram delivery was not confirmed by the server.');
}

console.log(
  JSON.stringify(
    {
      ok: true,
      endpoint: endpoint.origin,
      fileName,
      bytes: content.byteLength,
      driveVerified: true,
      telegramNotified: true,
    },
    null,
    2
  )
);
