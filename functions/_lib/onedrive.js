import { cleanText, getEnvValue } from './platform-integrations.js';

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';
const TOKEN_SCOPE = 'offline_access Files.ReadWrite';
const CONTENT_HASH_RE = /^[a-f0-9]{64}$/;
const SESSION_ID_RE = /^[a-zA-Z0-9_-]{16,64}$/;
const CONTENT_IDENTITY_RE = /^[a-z0-9-]{1,24}-[a-f0-9]{64}$/;
const MIME_EXTENSIONS = Object.freeze({
  'application/json': '.json',
  'application/pdf': '.pdf',
  'application/zip': '.zip',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'audio/webm': '.webm',
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'text/csv': '.csv',
  'text/plain': '.txt',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
});

function config(env) {
  return {
    tenantId: cleanText(getEnvValue(env, 'MS_TENANT_ID', 'consumers'), 120) || 'consumers',
    clientId: cleanText(getEnvValue(env, 'MS_CLIENT_ID'), 180),
    clientSecret: getEnvValue(env, 'MS_CLIENT_SECRET'),
    refreshToken: getEnvValue(env, 'MS_REFRESH_TOKEN'),
    rootFolderId: cleanText(getEnvValue(env, 'ONEDRIVE_UPLOAD_FOLDER'), 220),
  };
}

export function isOneDriveConfigured(env) {
  const value = config(env);
  return Boolean(value.clientId && value.refreshToken && value.rootFolderId);
}

export async function getOneDriveAccessToken(env) {
  const value = config(env);
  if (!value.clientId || !value.refreshToken) return '';
  const body = new URLSearchParams({
    client_id: value.clientId,
    grant_type: 'refresh_token',
    refresh_token: value.refreshToken,
    scope: TOKEN_SCOPE,
  });
  if (value.clientSecret) body.set('client_secret', value.clientSecret);
  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(value.tenantId)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }
  );
  if (!response.ok) {
    console.error('[onedrive] Token refresh failed', JSON.stringify({ status: response.status }));
    return '';
  }
  const result = await response.json().catch(() => ({}));
  return cleanText(result?.access_token, 8192);
}

function graphHeaders(token, contentType = '') {
  return {
    Authorization: `Bearer ${token}`,
    ...(contentType ? { 'Content-Type': contentType } : {}),
  };
}

function safeSessionId(value) {
  return cleanText(value, 80).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'unknown';
}

function contentExtension(fileName, mimeType) {
  const canonical = MIME_EXTENSIONS[cleanText(mimeType, 120).toLowerCase()];
  if (canonical) return canonical;
  const match = cleanText(fileName, 180).toLowerCase().match(/\.[a-z0-9]{1,10}$/);
  return match?.[0] || '.bin';
}

function hex(bytes) {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function oneDriveContentIdentity({ scope, sessionId, contentSha256 }) {
  const safeScope = cleanText(scope, 24).toLowerCase().replace(/[^a-z0-9-]/g, '');
  const safeId = cleanText(sessionId, 80);
  const safeHash = cleanText(contentSha256, 64).toLowerCase();
  if (!safeScope || !SESSION_ID_RE.test(safeId) || !CONTENT_HASH_RE.test(safeHash)) return '';
  const scopedHash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`hundesalon-upload-v1\0${safeScope}\0${safeId}\0${safeHash}`)
  );
  return `${safeScope}-${hex(scopedHash)}`;
}

export async function oneDriveContentFileName(input) {
  const identity = await oneDriveContentIdentity(input);
  return identity ? `${identity}${contentExtension(input?.fileName, input?.mimeType)}` : '';
}

export async function ensureOneDriveSessionFolder(env, token, sessionId) {
  const { rootFolderId } = config(env);
  if (!rootFolderId || !token) return null;
  const folderName = `session-${safeSessionId(sessionId)}`;
  const pathUrl = `${GRAPH_ROOT}/me/drive/items/${encodeURIComponent(rootFolderId)}:/${encodeURIComponent(folderName)}`;
  const existing = await fetch(`${pathUrl}?$select=id,name,parentReference,folder`, {
    headers: graphHeaders(token),
  });
  if (existing.ok) return existing.json();
  if (existing.status !== 404) return null;

  const created = await fetch(`${GRAPH_ROOT}/me/drive/items/${encodeURIComponent(rootFolderId)}/children`, {
    method: 'POST',
    headers: graphHeaders(token, 'application/json'),
    body: JSON.stringify({
      name: folderName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail',
    }),
  });
  if (created.ok) return created.json();
  if (created.status === 409) {
    const raced = await fetch(`${pathUrl}?$select=id,name,parentReference,folder`, {
      headers: graphHeaders(token),
    });
    if (raced.ok) return raced.json();
  }
  return null;
}

export async function getOneDriveItemByPath(token, folderId, fileName) {
  const response = await fetch(
    `${GRAPH_ROOT}/me/drive/items/${encodeURIComponent(folderId)}:/${encodeURIComponent(fileName)}?$select=id,name,size,file,webUrl,parentReference,createdDateTime,eTag`,
    { headers: graphHeaders(token) }
  );
  if (response.ok) return { ok: true, item: await response.json() };
  if (response.status === 404) return { ok: true, item: null };
  console.error('[onedrive] Item lookup failed', JSON.stringify({ status: response.status }));
  return { ok: false, item: null, status: response.status };
}

export async function listOneDriveItemsByContentIdentity(token, folderId, identity) {
  if (!CONTENT_IDENTITY_RE.test(identity)) return { ok: false, items: [], status: 400 };
  const items = [];
  let nextUrl = `${GRAPH_ROOT}/me/drive/items/${encodeURIComponent(folderId)}/children?$select=id,name,size,file,webUrl,parentReference,createdDateTime&$top=200`;
  for (let page = 0; page < 5 && nextUrl; page += 1) {
    const response = await fetch(nextUrl, { headers: graphHeaders(token) });
    if (!response.ok) {
      console.error('[onedrive] Folder lookup failed', JSON.stringify({ status: response.status }));
      return { ok: false, items: [], status: response.status };
    }
    const result = await response.json().catch(() => ({}));
    if (Array.isArray(result?.value)) {
      items.push(
        ...result.value.filter(candidate => candidate?.name === identity || candidate?.name?.startsWith(`${identity}.`))
      );
    }
    const candidate = typeof result?.['@odata.nextLink'] === 'string' ? result['@odata.nextLink'] : '';
    nextUrl = candidate.startsWith(`${GRAPH_ROOT}/`) ? candidate : '';
  }
  return { ok: true, items };
}

export async function getOneDriveItemByContentIdentity(token, folderId, identity, preferredFileName = '') {
  if (!CONTENT_IDENTITY_RE.test(identity)) return { ok: false, item: null, status: 400 };
  if (preferredFileName) {
    const exact = await getOneDriveItemByPath(token, folderId, preferredFileName);
    if (!exact.ok || exact.item) return exact;
  }
  const listed = await listOneDriveItemsByContentIdentity(token, folderId, identity);
  return listed.ok
    ? { ok: true, item: listed.items[0] || null }
    : { ok: false, item: null, status: listed.status };
}

export async function deleteOneDriveItem(token, itemId) {
  const response = await fetch(`${GRAPH_ROOT}/me/drive/items/${encodeURIComponent(itemId)}`, {
    method: 'DELETE',
    headers: graphHeaders(token),
  });
  return response.ok || response.status === 404 || response.status === 410;
}

export async function reconcileOneDriveContentCopies(token, folderId, identity, currentItem, expectedSize) {
  if (!CONTENT_IDENTITY_RE.test(identity) || !currentItem?.id) return { ok: false, item: null, deduplicated: false };
  const listed = await listOneDriveItemsByContentIdentity(token, folderId, identity);
  if (!listed.ok) return { ok: false, item: null, deduplicated: false };
  const candidates = listed.items.filter(item => item?.file && Number(item?.size) === expectedSize);
  if (!candidates.some(item => item.id === currentItem.id)) candidates.push(currentItem);
  candidates.sort((left, right) => {
    const byCreated = String(left?.createdDateTime || '9999-12-31T23:59:59.999Z').localeCompare(
      String(right?.createdDateTime || '9999-12-31T23:59:59.999Z')
    );
    return byCreated || String(left?.id || '').localeCompare(String(right?.id || ''));
  });
  const winner = candidates[0];
  const losers = candidates.slice(1);
  for (const item of losers) {
    if (!(await deleteOneDriveItem(token, item.id))) {
      return { ok: false, item: null, deduplicated: false };
    }
  }
  return { ok: true, item: winner, deduplicated: losers.length > 0 };
}

export async function uploadSmallFileToOneDrive(token, folderId, fileName, file, mimeType = '') {
  const response = await fetch(
    `${GRAPH_ROOT}/me/drive/items/${encodeURIComponent(folderId)}:/${encodeURIComponent(fileName)}:/content`,
    {
      method: 'PUT',
      headers: graphHeaders(token, cleanText(mimeType || file?.type, 120) || 'application/octet-stream'),
      body: file,
    }
  );
  if (!response.ok) {
    console.error('[onedrive] Small file upload failed', JSON.stringify({ status: response.status }));
    return { ok: false, item: null, status: response.status };
  }
  return { ok: true, item: await response.json() };
}

export async function createOneDriveUploadSession(env, token, folderId, fileName) {
  const path = `${GRAPH_ROOT}/me/drive/items/${encodeURIComponent(folderId)}:/${encodeURIComponent(fileName)}:/createUploadSession`;
  const response = await fetch(path, {
    method: 'POST',
    headers: graphHeaders(token, 'application/json'),
    body: JSON.stringify({
      item: {
        '@microsoft.graph.conflictBehavior': 'fail',
        name: fileName,
      },
    }),
  });
  if (response.status === 409) return { conflict: true };
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    console.error(
      '[onedrive] Upload session failed',
      JSON.stringify({
        status: response.status,
        code: cleanText(problem?.error?.code, 80),
        message: cleanText(problem?.error?.message, 240),
      })
    );
    return null;
  }
  const result = await response.json().catch(() => ({}));
  return typeof result?.uploadUrl === 'string' ? result : null;
}

export async function claimOneDriveCompletion(env, token, folderId, identity, receipt = {}) {
  if (!CONTENT_IDENTITY_RE.test(identity)) return { ok: false, claimed: false };
  const fileName = `receipt-${identity}.json`;
  const bytes = new TextEncoder().encode(JSON.stringify(receipt));
  const upload = await createOneDriveUploadSession(env, token, folderId, fileName);
  if (upload?.conflict) return { ok: true, claimed: false };
  if (!upload?.uploadUrl) return { ok: false, claimed: false };
  const response = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Range': `bytes 0-${bytes.byteLength - 1}/${bytes.byteLength}`,
    },
    body: bytes,
  });
  if (response.status === 409) return { ok: true, claimed: false };
  if (response.status !== 200 && response.status !== 201) {
    console.error('[onedrive] Completion receipt failed', JSON.stringify({ status: response.status }));
    return { ok: false, claimed: false };
  }
  return { ok: true, claimed: true };
}

export async function releaseOneDriveCompletionClaim(token, folderId, identity) {
  if (!CONTENT_IDENTITY_RE.test(identity)) return false;
  const receipt = await getOneDriveItemByPath(token, folderId, `receipt-${identity}.json`);
  if (!receipt.ok) return false;
  return !receipt.item || deleteOneDriveItem(token, receipt.item.id);
}

export function isOneDriveUploadUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === 'https:' &&
      (host.endsWith('.up.1drv.com') ||
        host.endsWith('.up.1drvusercontent.com') ||
        host.endsWith('.sharepoint.com') ||
        host === 'my.microsoftpersonalcontent.com' ||
        host.endsWith('.microsoftpersonalcontent.com'))
    );
  } catch {
    return false;
  }
}

async function signatureKey(env) {
  const value = config(env);
  const secret = value.clientSecret || value.refreshToken;
  if (!secret) return null;
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
}

export async function signOneDriveUploadUrl(env, uploadUrl) {
  const key = await signatureKey(env);
  if (!key) return '';
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(uploadUrl)));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function verifyOneDriveUploadUrl(env, uploadUrl, signature) {
  if (!isOneDriveUploadUrl(uploadUrl)) return false;
  const expected = await signOneDriveUploadUrl(env, uploadUrl);
  const actual = cleanText(signature, 128);
  if (!expected || expected.length !== actual.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= expected.charCodeAt(index) ^ actual.charCodeAt(index);
  return difference === 0;
}

export async function signOneDriveFileReference(env, { fileId, fileUrl, sessionId }) {
  const safeFileId = cleanText(fileId, 220);
  const safeFileUrl = cleanText(fileUrl, 1000);
  const safeSessionIdValue = cleanText(sessionId, 80);
  if (!safeFileId || !safeFileUrl || !SESSION_ID_RE.test(safeSessionIdValue)) return '';
  const key = await signatureKey(env);
  if (!key) return '';
  const payload = `hundesalon-booking-file-v1\0${safeSessionIdValue}\0${safeFileId}\0${safeFileUrl}`;
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function verifyOneDriveFileReference(env, reference, signature) {
  const expected = await signOneDriveFileReference(env, reference);
  const actual = cleanText(signature, 128);
  if (!expected || expected.length !== actual.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= expected.charCodeAt(index) ^ actual.charCodeAt(index);
  return difference === 0;
}

export async function getOneDriveItem(token, itemId) {
  const response = await fetch(
    `${GRAPH_ROOT}/me/drive/items/${encodeURIComponent(itemId)}?$select=id,name,size,file,webUrl,parentReference,createdDateTime,@microsoft.graph.downloadUrl`,
    { headers: graphHeaders(token) }
  );
  return response.ok ? response.json() : null;
}

export async function getOneDriveDownloadUrl(token, itemId) {
  if (!token || !itemId) return '';
  const response = await fetch(`${GRAPH_ROOT}/me/drive/items/${encodeURIComponent(itemId)}/content`, {
    headers: graphHeaders(token),
    redirect: 'manual',
  });
  const location = response.headers.get('Location') || '';
  if (response.body) await response.body.cancel().catch(() => {});
  try {
    const parsed = new URL(location);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.toString() : '';
  } catch {
    return '';
  }
}

export async function saveOneDriveTranscript(token, folderId, sessionId, transcript) {
  const name = `transcript-${safeSessionId(sessionId)}.json`;
  const path = `${GRAPH_ROOT}/me/drive/items/${encodeURIComponent(folderId)}:/${encodeURIComponent(name)}`;
  const body = JSON.stringify(transcript, null, 2);
  const revision = Number(transcript?.revision);
  if (!Number.isSafeInteger(revision) || revision < 1) return null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const existing = await getOneDriveItemByPath(token, folderId, name);
    if (!existing.ok) return null;

    if (!existing.item) {
      const created = await fetch(`${path}:/content`, {
        method: 'PUT',
        headers: { ...graphHeaders(token, 'application/json; charset=utf-8'), 'If-None-Match': '*' },
        body,
      });
      if (created.ok) return created.json();
      if (created.status === 409 || created.status === 412) continue;
      return null;
    }

    const current = await fetch(`${GRAPH_ROOT}/me/drive/items/${encodeURIComponent(existing.item.id)}/content`, {
      headers: graphHeaders(token),
    });
    if (!current.ok) {
      if (current.status === 404 || current.status === 412) continue;
      return null;
    }
    const currentTranscript = await current.json().catch(() => ({}));
    if (Number(currentTranscript?.revision) >= revision) return existing.item;
    if (!existing.item.eTag) return null;

    const updated = await fetch(`${GRAPH_ROOT}/me/drive/items/${encodeURIComponent(existing.item.id)}/content`, {
      method: 'PUT',
      headers: {
        ...graphHeaders(token, 'application/json; charset=utf-8'),
        'If-Match': existing.item.eTag,
      },
      body,
    });
    if (updated.ok) return updated.json();
    if (updated.status !== 409 && updated.status !== 412) return null;
  }
  return null;
}
