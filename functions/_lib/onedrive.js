import { cleanText, getEnvValue } from './platform-integrations.js';

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';
const TOKEN_SCOPE = 'offline_access Files.ReadWrite';

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

export async function createOneDriveUploadSession(env, token, folderId, fileName) {
  const path = `${GRAPH_ROOT}/me/drive/items/${encodeURIComponent(folderId)}:/${encodeURIComponent(fileName)}:/createUploadSession`;
  const response = await fetch(path, {
    method: 'POST',
    headers: graphHeaders(token, 'application/json'),
    body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'rename', name: fileName } }),
  });
  if (!response.ok) {
    console.error('[onedrive] Upload session failed', JSON.stringify({ status: response.status }));
    return null;
  }
  const result = await response.json().catch(() => ({}));
  return typeof result?.uploadUrl === 'string' ? result : null;
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

export async function getOneDriveItem(token, itemId) {
  const response = await fetch(
    `${GRAPH_ROOT}/me/drive/items/${encodeURIComponent(itemId)}?$select=id,name,size,file,webUrl,parentReference`,
    { headers: graphHeaders(token) }
  );
  return response.ok ? response.json() : null;
}

export async function saveOneDriveTranscript(token, folderId, sessionId, transcript) {
  const name = `transcript-${safeSessionId(sessionId)}.json`;
  const response = await fetch(
    `${GRAPH_ROOT}/me/drive/items/${encodeURIComponent(folderId)}:/${encodeURIComponent(name)}:/content`,
    {
      method: 'PUT',
      headers: graphHeaders(token, 'application/json; charset=utf-8'),
      body: JSON.stringify(transcript, null, 2),
    }
  );
  return response.ok ? response.json() : null;
}
