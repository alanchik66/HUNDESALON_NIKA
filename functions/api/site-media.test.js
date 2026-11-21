import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { crc32 } from 'node:zlib';
import { onRequest as ownerMedia } from './admin/media.js';
import { onRequest as publicMedia } from './site-media.js';
import { openAdminSession } from '../_lib/site-admin-auth.js';
import { SITE_MEDIA_UPLOAD_CHUNK_SIZE, listPublishedSiteMedia, validSiteMediaBytes } from '../_lib/admin-media.js';

const origin = 'http://127.0.0.1:8796';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==',
  'base64'
);

function crossingPng() {
  const text = Buffer.alloc(256 * 1024, 65);
  text.write('Description\0');
  const comment = Buffer.alloc(8 + text.length + 4);
  comment.writeUInt32BE(text.length, 0);
  comment.write('tEXt', 4);
  text.copy(comment, 8);
  comment.writeUInt32BE(crc32(comment.subarray(4, -4)), comment.length - 4);
  return Buffer.concat([png.subarray(0, 33), comment, png.subarray(33)]);
}

function sqliteD1(raw) {
  const prepare = sql => {
    const statement = raw.prepare(sql);
    return {
      bind(...values) {
        return {
          first: () => statement.get(...values) ?? null,
          all: () => ({ results: statement.all(...values) }),
          run() {
            const total = raw.prepare('SELECT total_changes() AS changes');
            const before = total.get().changes;
            statement.run(...values);
            return { meta: { changes: total.get().changes - before } };
          },
        };
      },
    };
  };
  return {
    prepare,
    batch(statements) {
      raw.exec('BEGIN');
      try {
        const results = statements.map(statement => statement.run());
        raw.exec('COMMIT');
        return results;
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

async function fixture(t, migrateMedia = true) {
  const raw = new DatabaseSync(':memory:');
  t.after(() => raw.close());
  raw.exec('PRAGMA foreign_keys = ON');
  const migrate = name => raw.exec(readFileSync(new URL('../../migrations/' + name, import.meta.url), 'utf8'));
  migrate('0013_site_settings.sql');
  if (migrateMedia) {
    migrate('0015_site_media.sql');
    migrate('0016_site_comparisons.sql');
    migrate('0017_site_media_video_uploads.sql');
  }
  const env = { CHAT_DB: sqliteD1(raw), SITE_ADMIN_KEY: crypto.randomUUID() };
  const session = await openAdminSession(new Request(origin + '/admin/'), env);
  const cookie = session.headers.get('Set-Cookie').split(';')[0];
  const request = (path, init) => new Request(origin + path, init);
  const owner = (query = '', init, authenticated = true) => {
    const headers = new Headers(init?.headers);
    if (!headers.has('Origin')) headers.set('Origin', origin);
    if (authenticated) headers.set('Cookie', cookie);
    return ownerMedia({ env, request: request('/api/admin/media' + query, { ...init, headers }) });
  };
  const publish = (query, init) => publicMedia({ env, request: request('/api/site-media' + query, init) });
  const upload = (body = png, slug = 'galereya', alt = '', locale = 'ru', mime = 'image/png') =>
    owner('?' + new URLSearchParams({ locale, slug, alt, title: 'Фото салона' }), {
      method: 'POST',
      headers: { 'Content-Type': mime },
      body,
    });
  const change = (id, values) =>
    owner('', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...values }),
    });
  function setVisibility(sections) {
    raw
      .prepare('UPDATE site_settings SET payload = ?, revision = revision + 1 WHERE id = 1')
      .run(JSON.stringify({ sections, offers: {} }));
  }
  return { raw, env, owner, publish, upload, change, setVisibility };
}

test('owner media upload, edit and publication require session, origin and accessible captions', async t => {
  const { owner, upload, publish, change, setVisibility, env } = await fixture(t);
  assert.equal((await owner('', undefined, false)).status, 401);
  assert.equal((await owner('', { method: 'POST', headers: { Origin: 'https://other.example' } })).status, 403);
  const response = await upload();
  assert.equal(response.status, 201);
  const { item } = await response.json();
  assert.equal(item.published, false);
  assert.equal(item.revision, 1);
  const query = '?id=' + item.id;
  assert.equal((await owner(query, undefined, false)).status, 401);
  assert.equal((await owner(query)).status, 200);
  assert.equal((await publish(query)).status, 404);
  assert.equal((await (await publish('?locale=ru&slug=galereya')).json()).items.length, 0);
  const altMissing = await change(item.id, { revision: 1, published: true });
  assert.equal(altMissing.status, 400);
  assert.equal((await altMissing.json()).error, 'alt_required');
  const published = await change(item.id, { revision: 1, alt: 'Салон перед открытием', published: true });
  assert.equal(published.status, 200);
  assert.equal((await published.json()).item.revision, 2);
  const stale = await change(item.id, { revision: 1, title: 'Не перезаписать' });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error, 'revision_conflict');
  assert.equal((await owner(query, { method: 'DELETE' })).status, 409);
  const listing = await listPublishedSiteMedia(env.CHAT_DB, 'ru', 'galereya');
  assert.equal(listing[0].alt, 'Салон перед открытием');
  assert.equal(Object.hasOwn(listing[0], 'previewUrl'), false);
  assert.equal((await publish(query)).status, 200);
  setVisibility({ gallery: false });
  assert.equal((await publish(query)).status, 404);
  assert.equal((await publish('?locale=ru&slug=galereya')).status, 404);
  assert.equal((await owner(query)).status, 200);
  setVisibility({ gallery: true });
  assert.equal((await change(item.id, { revision: 2, published: false })).status, 200);
  assert.equal((await publish(query)).status, 404);
  assert.equal((await owner(query, { method: 'DELETE' })).status, 200);
  assert.equal((await owner(query)).status, 404);
});

test('binary preview and public byte ranges preserve original bytes across storage chunks', async t => {
  const { raw, owner, upload, change, publish } = await fixture(t);
  const image = crossingPng();
  const response = await upload(image, 'galereya', 'Вход в салон');
  assert.equal(response.status, 201);
  const { item } = await response.json();
  assert.equal(item.size, image.length);
  assert.equal(raw.prepare('SELECT count(*) n FROM site_media_chunks').get().n, 2);
  assert.equal((await change(item.id, { published: true })).status, 200);
  const query = '?id=' + item.id;
  for (const load of [owner, publish]) {
    const full = await load(query);
    assert.equal(full.status, 200);
    assert.equal(full.headers.get('Content-Type'), 'image/png');
    assert.equal(full.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(full.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.deepEqual(Buffer.from(await full.arrayBuffer()), image);
    const start = 262140,
      end = 262148;
    const partial = await load(query, { headers: { Range: 'bytes=' + start + '-' + end } });
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get('Content-Range'), 'bytes ' + start + '-' + end + '/' + image.length);
    assert.deepEqual(Buffer.from(await partial.arrayBuffer()), image.subarray(start, end + 1));
    const tail = await load(query, { headers: { Range: 'bytes=-7' } });
    assert.equal(tail.status, 206);
    assert.deepEqual(Buffer.from(await tail.arrayBuffer()), image.subarray(-7));
    const head = await load(query, { method: 'HEAD', headers: { Range: 'bytes=0-1' } });
    assert.equal(head.status, 206);
    assert.equal(head.headers.get('Content-Length'), '2');
    assert.equal((await head.arrayBuffer()).byteLength, 0);
    const invalid = await load(query, { headers: { Range: 'bytes=99999999-' } });
    assert.equal(invalid.status, 416);
    assert.equal(invalid.headers.get('Content-Range'), 'bytes */' + image.length);
  }
  await change(item.id, { published: false });
  await owner(query, { method: 'DELETE' });
  assert.equal(raw.prepare('SELECT count(*) n FROM site_media_chunks').get().n, 0);
});

test('uploads enforce type, file sizes and per-page caps without orphaned chunks', async t => {
  const { raw, owner, upload } = await fixture(t);
  const xml = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  assert.equal((await upload(xml, 'galereya', '', 'ru', 'image/svg+xml')).status, 415);
  assert.equal((await upload(xml)).status, 400);
  assert.equal(
    (
      await owner('?locale=ru&slug=galereya&title=Photo', {
        method: 'POST',
        headers: { 'Content-Type': 'image/png', 'Content-Length': String(4 * 1024 * 1024 + 1) },
        body: png,
      })
    ).status,
    413
  );
  const oversizedDimensions = Buffer.from(png);
  oversizedDimensions.writeUInt32BE(8193, 16);
  assert.equal(validSiteMediaBytes(oversizedDimensions, 'image/png'), false);
  assert.equal(validSiteMediaBytes(png.subarray(0, -4), 'image/png'), false);
  const results = await Promise.all(Array.from({ length: 25 }, () => upload()));
  assert.equal(results.filter(result => result.status === 201).length, 24);
  assert.equal(results.filter(result => result.status === 409).length, 1);
  assert.equal(raw.prepare('SELECT count(*) n FROM site_media_chunks').get().n, 24);
  assert.equal((await upload(png, 'galereya', '', 'uk')).status, 201);
});

test('old database can serve a page with no media until local migration runs', async t => {
  const { owner, publish, env } = await fixture(t, false);
  assert.deepEqual(await listPublishedSiteMedia(env.CHAT_DB, 'ru', 'galereya'), []);
  assert.equal((await publish('?id=' + crypto.randomUUID())).status, 404);
  assert.equal((await owner()).status, 503);
});

function uploadActions(owner) {
  const post = (action, params, init) =>
    owner('?' + new URLSearchParams({ action, ...params }), { method: 'POST', ...init });
  return {
    begin: (size, mime = 'video/mp4', options = {}) =>
      post('begin', { size, mime, locale: 'ru', slug: 'galereya', title: 'Материал', ...options }),
    chunk: (upload_id, part, body) =>
      post('chunk', { upload_id, part }, { headers: { 'Content-Type': 'application/octet-stream' }, body }),
    finish: upload_id => post('finish', { upload_id }),
    abort: upload_id => post('abort', { upload_id }),
  };
}

test('all file types enforce the 150 MB boundary, reserve capacity and clean expired parts', async t => {
  const { raw, owner } = await fixture(t);
  const { begin, chunk, abort } = uploadActions(owner);
  for (const mime of ['video/mp4', 'image/png', 'application/pdf']) {
    assert.equal((await begin(150_000_001, mime)).status, 413);
  }
  const start = await begin(150_000_000);
  assert.equal(start.status, 201);
  const { upload_id, chunk_size } = await start.json();
  assert.equal(chunk_size, SITE_MEDIA_UPLOAD_CHUNK_SIZE);
  const second = await begin(150_000_000, 'image/png');
  assert.equal(second.status, 201);
  assert.equal((await begin(150_000_000, 'application/pdf')).status, 409);
  assert.equal((await chunk(upload_id, 0, Buffer.alloc(chunk_size))).status, 200);
  raw.prepare('UPDATE site_media SET upload_until = ? WHERE id = ?').run(Date.now() - 1, upload_id);
  assert.equal((await chunk(upload_id, 0, Buffer.alloc(chunk_size))).status, 404);
  const next = await begin(150_000_000, 'application/pdf');
  assert.equal(next.status, 201);
  assert.equal(raw.prepare('SELECT count(*) n FROM site_media_chunks').get().n, 0);
  assert.equal((await abort((await next.json()).upload_id)).status, 200);
  assert.equal((await abort((await second.json()).upload_id)).status, 200);
  assert.equal(raw.prepare('SELECT count(*) n FROM site_media').get().n, 0);
});

test('video parts are immutable, incomplete uploads are private, and the completed video streams with ranges', async t => {
  const { owner, publish, change } = await fixture(t);
  const { begin, chunk, finish, abort } = uploadActions(owner);
  const video = Buffer.alloc(5 * SITE_MEDIA_UPLOAD_CHUNK_SIZE + 5, 7);
  const firstBoxSize = 16;
  const moovOffset = video.length - 9;
  video.writeUInt32BE(firstBoxSize, 0);
  video.write('ftypisom', 4);
  video.writeUInt32BE(moovOffset - firstBoxSize, firstBoxSize);
  video.write('mdat', firstBoxSize + 4);
  video.writeUInt32BE(9, moovOffset);
  video.write('moov', moovOffset + 4);
  const { upload_id: id, chunk_size: size } = await (await begin(video.length)).json();
  const query = '?id=' + id;
  assert.equal((await owner(query)).status, 404);
  assert.equal((await change(id, { published: true })).status, 404);
  assert.equal((await finish(id)).status, 409);
  assert.equal((await chunk(id, 0, video.subarray(0, 17))).status, 400);
  assert.equal((await chunk(id, '', video.subarray(0, size))).status, 400);
  for (let part = 0; part * size < video.length; part++) {
    assert.equal((await chunk(id, part, video.subarray(part * size, (part + 1) * size))).status, 200);
  }
  assert.equal((await chunk(id, 0, video.subarray(0, size))).status, 200);
  assert.equal((await chunk(id, 0, Buffer.alloc(size))).status, 409);
  const final = await finish(id);
  assert.equal(final.status, 201);
  assert.equal((await final.json()).item.id, id);
  assert.equal((await finish(id)).status, 201);
  assert.equal((await abort(id)).status, 200);
  assert.equal((await publish(query)).status, 404);
  assert.equal((await change(id, { published: true })).status, 200);
  const publicVideo = await publish(query, { headers: { Range: 'bytes=2-' } });
  assert.equal(publicVideo.status, 206);
  assert.equal(publicVideo.headers.get('Content-Length'), String(video.length - 2));
  assert.deepEqual(Buffer.from(await publicVideo.arrayBuffer()), video.subarray(2));
});

test('owner uploads an image and a document, documents download as attachments, staging stays private', async t => {
  const { owner, publish, change } = await fixture(t);
  const { begin, chunk, finish, abort } = uploadActions(owner);
  const { upload_id: imageId } = await (await begin(png.length, 'image/png')).json();
  assert.equal((await chunk(imageId, 0, png)).status, 200);
  assert.equal((await finish(imageId)).status, 201);
  assert.equal((await owner('?id=' + imageId)).headers.get('Content-Disposition'), 'inline');

  const { upload_id: beforeId } = await (await begin(png.length, 'image/png', { slug: 'do-i-posle', comparison: 1 })).json();
  assert.equal((await chunk(beforeId, 0, png)).status, 200);
  assert.equal((await finish(beforeId)).status, 201);
  assert.equal((await owner('?id=' + beforeId)).status, 404);
  assert.equal((await abort(beforeId)).status, 200);

  const content = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n');
  const { upload_id: pdfId } = await (await begin(content.length, 'application/pdf', { title: 'Правила салона' })).json();
  assert.equal((await chunk(pdfId, 0, content)).status, 200);
  assert.equal((await finish(pdfId)).status, 201);
  assert.equal((await publish('?id=' + pdfId)).status, 404);
  assert.equal((await change(pdfId, { published: true })).status, 200);
  const pdf = await publish('?id=' + pdfId);
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('Content-Type'), 'application/pdf');
  assert.match(pdf.headers.get('Content-Disposition'), /^attachment; filename="document\.pdf"; filename\*=UTF-8''%D0/);
  assert.deepEqual(Buffer.from(await pdf.arrayBuffer()), content);
  const { upload_id: bad } = await (await begin(png.length, 'application/pdf')).json();
  assert.equal((await chunk(bad, 0, png)).status, 200);
  assert.equal((await finish(bad)).status, 400);
});
