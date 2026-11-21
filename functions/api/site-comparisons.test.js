import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { crc32 } from 'node:zlib';
import { GALLERY_COMPARISON_UPLOAD_LIMIT, onRequest as ownerComparisons } from './admin/comparisons.js';
import { onRequest as publicComparisons } from './site-comparisons.js';
import { openAdminSession } from '../_lib/site-admin-auth.js';

const origin = 'http://127.0.0.1:8796';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==',
  'base64'
);
const metadata = { category: 'dogs', title: 'Чарли', beforeAlt: 'До ухода', afterAlt: 'После ухода' };

function comparisonPhoto() {
  const text = Buffer.alloc(256 * 1024, 65);
  text.write('Description\0');
  const chunk = Buffer.alloc(8 + text.length + 4);
  chunk.writeUInt32BE(text.length, 0);
  chunk.write('tEXt', 4);
  text.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4);
  return Buffer.concat([png.subarray(0, 33), chunk, png.subarray(33)]);
}

async function fixture(t, migrateComparisons = true, beforeMediaExpansion) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec('PRAGMA foreign_keys = ON');
  const migrate = name => sqlite.exec(readFileSync(new URL('../../migrations/' + name, import.meta.url), 'utf8'));
  migrate('0013_site_settings.sql');
  if (migrateComparisons) {
    migrate('0015_site_media.sql');
    migrate('0016_site_comparisons.sql');
    beforeMediaExpansion?.(sqlite);
    migrate('0017_site_media_video_uploads.sql');
  }
  const db = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      return {
        bind(...values) {
          return {
            first: () => statement.get(...values) ?? null,
            all: () => ({ results: statement.all(...values) }),
            run() {
              const count = sqlite.prepare('SELECT total_changes() AS changes');
              const before = count.get().changes;
              statement.run(...values);
              return { meta: { changes: count.get().changes - before } };
            },
          };
        },
      };
    },
    batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const result = statements.map(statement => statement.run());
        sqlite.exec('COMMIT');
        return result;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  const env = { CHAT_DB: db, SITE_ADMIN_KEY: crypto.randomUUID() };
  const login = await openAdminSession(new Request(origin + '/admin/'), env);
  const cookie = login.headers.get('Set-Cookie').split(';')[0];
  function owner(query = '', init, authenticated = true) {
    const headers = new Headers(init?.headers);
    if (!headers.has('Origin')) headers.set('Origin', origin);
    if (authenticated) headers.set('Cookie', cookie);
    return ownerComparisons({
      env,
      request: new Request(origin + '/api/admin/comparisons' + query, { ...init, headers }),
    });
  }
  const read = (query, init) =>
    publicComparisons({ env, request: new Request(origin + '/api/site-comparisons' + query, init) });
  function body(override = {}, before = new File([png], 'before.png', { type: 'image/png' }), after = before) {
    const form = new FormData();
    for (const [key, value] of Object.entries({ locale: 'ru', ...metadata, ...override })) form.set(key, value);
    if (before) form.set('before', before);
    if (after) form.set('after', after);
    return form;
  }
  const upload = (...args) => owner('', { method: 'POST', body: body(...args) });
  const link = (beforeId, afterId, override) =>
    owner('', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'ru', ...metadata, beforeId, afterId, ...override }),
    });
  function reservePhoto({ locale = 'ru', bytes = png, size = bytes.length, comparison = true, pending = false } = {}) {
    const id = crypto.randomUUID();
    const now = Date.now();
    sqlite
      .prepare(
        'INSERT INTO site_media (id, locale, slug, title, alt, mime, byte_size, created_at, updated_at, ' +
          'for_comparison, upload_until) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(id, locale, 'do-i-posle', 'Фото', '', 'image/png', size, now, now, Number(comparison), pending ? now + 60000 : null);
    if (pending || bytes.length !== size) return id;
    const chunkSize = 256 * 1024;
    const insert = sqlite.prepare('INSERT INTO site_media_chunks (media_id, ordinal, payload) VALUES (?, ?, ?)');
    for (let offset = 0; offset < size; offset += chunkSize) {
      insert.run(id, offset / chunkSize, bytes.subarray(offset, offset + chunkSize).toString('base64'));
    }
    return id;
  }
  const update = (item, changes) =>
    owner('', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, revision: item.revision, ...changes }),
    });
  const remove = item => owner('?id=' + item.id + '&revision=' + item.revision, { method: 'DELETE' });
  const setVisibility = beforeAfter =>
    sqlite
      .prepare('UPDATE site_settings SET payload = ?, revision = revision + 1 WHERE id = 1')
      .run(JSON.stringify({ sections: { beforeAfter }, offers: {} }));
  return { sqlite, owner, read, upload, update, remove, setVisibility, body, link, reservePhoto };
}

const query = url => new URL(url, origin).search;
const json = async response => (await response).json();

test('pairs are published together on the selected language and hidden with the comparisons switch', async t => {
  const { owner, read, body, upload, update, remove, setVisibility, sqlite } = await fixture(t);
  assert.equal((await owner('?locale=ru', undefined, false)).status, 401);
  assert.equal(
    (await owner('', { method: 'POST', headers: { Origin: 'https://other.example' }, body: body() })).status,
    403
  );
  for (const [locale, category] of [
    ['de', 'dogs'],
    ['en', 'cats'],
    ['ru', 'smallAnimals'],
    ['uk', 'salon'],
  ]) {
    const uploaded = await upload({ locale, category });
    assert.equal(uploaded.status, 201);
    const { item } = await uploaded.json();
    assert.equal(item.locale, locale);
    assert.equal(item.category, category);
    assert.equal(item.published, false);
    assert.equal(item.revision, 1);
    assert.equal((await owner(query(item.beforePreviewUrl), undefined, false)).status, 401);
    assert.equal((await owner(query(item.afterPreviewUrl))).status, 200);
    assert.equal((await read(query(item.beforeUrl))).status, 404);
    assert.equal((await read(query(item.afterUrl))).status, 404);
    const published = await update(item, { published: true });
    assert.equal(published.status, 200);
    const current = (await published.json()).item;
    assert.equal(current.revision, 2);
    assert.equal((await remove(current)).status, 409);
    assert.equal((await update(item, { title: 'Старая форма' })).status, 409);
    const listing = await json(read('?locale=' + locale));
    assert.deepEqual(
      listing.items.map(record => record.locale),
      [locale]
    );
    assert.equal(listing.items[0].beforeUrl, item.beforeUrl);
    assert.equal(Object.hasOwn(listing.items[0], 'beforePreviewUrl'), false);
    assert.equal(await (await read(query(item.beforeUrl))).headers.get('Content-Type'), 'image/png');
    assert.equal((await read(query(item.afterUrl))).status, 200);
  }
  assert.equal((await json(owner('?locale=ru'))).items.length, 1);
  const russian = (await json(owner('?locale=ru'))).items[0];
  setVisibility(false);
  assert.equal((await read('?locale=ru')).status, 404);
  assert.equal((await read(query(russian.beforeUrl))).status, 404);
  assert.equal((await read(query(russian.afterUrl))).status, 404);
  assert.equal((await owner(query(russian.afterPreviewUrl))).status, 200);
  setVisibility(true);
  assert.equal((await read('?locale=ru')).status, 200);
  const unpublished = (await json(update(russian, { published: false }))).item;
  assert.equal((await read(query(russian.beforeUrl))).status, 404);
  assert.equal((await remove(russian)).status, 409);
  assert.equal((await remove(unpublished)).status, 200);
  assert.equal(sqlite.prepare('SELECT count(*) AS count FROM site_comparison_chunks').get().count, 6);
});

test('owner must supply both descriptions before publishing; invalid uploads write no fragments', async t => {
  const { sqlite, upload, update, owner } = await fixture(t);
  const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'payload.svg', { type: 'image/svg+xml' });
  const mislabeled = new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'payload.png', { type: 'image/png' });
  const valid = new File([png], 'valid.png', { type: 'image/png' });
  assert.equal((await upload({ category: 'unknown' })).status, 400);
  assert.equal((await upload({ locale: 'invalid' })).status, 400);
  assert.equal((await upload({}, null, valid)).status, 400);
  assert.equal((await upload({}, valid, svg)).status, 415);
  assert.equal((await upload({}, valid, mislabeled)).status, 400);
  assert.equal(
    (
      await owner('', {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data; boundary=x',
          'Content-Length': String(GALLERY_COMPARISON_UPLOAD_LIMIT + 1),
        },
        body: 'x',
      })
    ).status,
    413
  );
  assert.equal(
    (await upload({}, valid, new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })))
      .status,
    413
  );
  assert.equal(sqlite.prepare('SELECT count(*) n FROM site_comparisons').get().n, 0);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM site_comparison_chunks').get().n, 0);

  const { item } = await json(upload({ beforeAlt: '', afterAlt: '' }));
  const failure = await update(item, { published: true });
  assert.equal(failure.status, 400);
  assert.equal((await failure.json()).error, 'alt_required');
  assert.equal((await update(item, { beforeAlt: 'До', afterAlt: 'После', published: true })).status, 200);
});

test('byte ranges belong to the requested side and honor HEAD without returning a body', async t => {
  const { upload, owner, update, read } = await fixture(t);
  const before = comparisonPhoto();
  const response = await upload(
    {},
    new File([before], 'before.png', { type: 'image/png' }),
    new File([png], 'after.png', { type: 'image/png' })
  );
  assert.equal(response.status, 201);
  const { item } = await response.json();
  const left = await owner(query(item.beforePreviewUrl));
  const right = await owner(query(item.afterPreviewUrl));
  assert.deepEqual(Buffer.from(await left.arrayBuffer()), before);
  assert.deepEqual(Buffer.from(await right.arrayBuffer()), png);
  assert.equal((await update(item, { published: true })).status, 200);
  const partial = await read(query(item.beforeUrl), { headers: { Range: 'bytes=262140-262148' } });
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get('Content-Range'), 'bytes 262140-262148/' + before.length);
  assert.deepEqual(Buffer.from(await partial.arrayBuffer()), before.subarray(262140, 262149));
  const head = await read(query(item.afterUrl), { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('Content-Length'), String(png.length));
  assert.equal(head.headers.get('Cache-Control'), 'private, no-store');
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  assert.equal((await read('?id=' + item.id + '&side=other')).status, 404);
});

test('a quota rejection or failed second-side insert cannot leave a partial comparison', async t => {
  const { sqlite, upload } = await fixture(t);
  sqlite.exec(
    "CREATE TRIGGER abort_second BEFORE INSERT ON site_comparison_chunks WHEN NEW.side = 'after' BEGIN SELECT RAISE(ABORT, 'fixture'); END;"
  );
  assert.equal((await upload()).status, 503);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM site_comparisons').get().n, 0);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM site_comparison_chunks').get().n, 0);
  sqlite.exec('DROP TRIGGER abort_second');
  const attempts = await Promise.all(Array.from({ length: 25 }, () => upload()));
  assert.equal(attempts.filter(result => result.status === 201).length, 24);
  assert.equal(attempts.filter(result => result.status === 409).length, 1);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM site_comparison_chunks').get().n, 48);
});

test('one linked draft claims both completed images without copying or publishing their bytes', async t => {
  const { sqlite, owner, read, update, remove, setVisibility, link, reservePhoto } = await fixture(t);
  const large = comparisonPhoto();
  const before = reservePhoto({ bytes: large });
  const after = reservePhoto();
  const swapped = reservePhoto();
  assert.equal(await json(link(before, before)).then(result => result.error), 'invalid_media_id');
  for (const rejected of [
    crypto.randomUUID(),
    reservePhoto({ locale: 'en' }),
    reservePhoto({ pending: true }),
    reservePhoto({ comparison: false }),
  ]) {
    const response = await link(before, rejected);
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: 'media_unavailable' });
  }
  const response = await link(before, after);
  assert.equal(response.status, 201);
  const { item } = await response.json();
  assert.equal(item.published, false);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM site_comparison_chunks').get().n, 0);
  assert.equal((await link(swapped, before)).status, 409);
  assert.equal((await link(after, swapped)).status, 409);
  assert.equal((await owner(query(item.beforePreviewUrl), undefined, false)).status, 401);
  const preview = await owner(query(item.beforePreviewUrl));
  assert.deepEqual(Buffer.from(await preview.arrayBuffer()), large);
  assert.equal((await read(query(item.beforeUrl))).status, 404);

  const published = (await json(update(item, { published: true }))).item;
  assert.equal(published.published, true);
  const partial = await read(query(item.beforeUrl), { headers: { Range: 'bytes=262140-262148' } });
  assert.equal(partial.status, 206);
  assert.deepEqual(Buffer.from(await partial.arrayBuffer()), large.subarray(262140, 262149));
  assert.deepEqual(Buffer.from(await (await read(query(item.afterUrl))).arrayBuffer()), png);
  setVisibility(false);
  assert.equal((await read(query(item.beforeUrl))).status, 404);
  assert.equal((await owner(query(item.afterPreviewUrl))).status, 200);
  const unpublished = (await json(update(published, { published: false }))).item;
  assert.equal((await remove(unpublished)).status, 200);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM site_media WHERE id IN (?, ?)').get(before, after).n, 0);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM site_media_chunks WHERE media_id IN (?, ?)').get(before, after).n, 0);
  assert.equal((await link(swapped, before)).status, 409);
});

test('two completed 150 MB reservations fit a pair and share the quota with legacy uploads', async t => {
  const { owner, upload, link, remove, reservePhoto } = await fixture(t);
  const before = reservePhoto({ size: 150000000 });
  const after = reservePhoto({ size: 150000000 });
  reservePhoto({ size: 25000000, comparison: false });
  const response = await link(before, after);
  assert.equal(response.status, 201);
  const { item } = await response.json();
  const head = await owner(query(item.beforePreviewUrl), { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('Content-Length'), '150000000');
  const failure = await upload();
  assert.equal(failure.status, 409);
  assert.deepEqual(await failure.json(), { error: 'comparison_limit' });
  assert.equal((await remove(item)).status, 200);
  assert.equal((await upload()).status, 201);
});

test('the media expansion preserves a published comparison and both legacy chunks', async t => {
  const id = crypto.randomUUID();
  const { read } = await fixture(t, true, sqlite => {
    sqlite
      .prepare(
        'INSERT INTO site_comparisons (id, locale, category, title, before_alt, after_alt, before_mime, after_mime, ' +
          'before_size, after_size, published, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1)'
      )
      .run(id, 'ru', 'dogs', 'Чарли', 'До', 'После', 'image/png', 'image/png', png.length, png.length);
    const insert = sqlite.prepare('INSERT INTO site_comparison_chunks VALUES (?, ?, 0, ?)');
    for (const side of ['before', 'after']) insert.run(id, side, png.toString('base64'));
  });
  const { items } = await json(read('?locale=ru'));
  assert.equal(items.length, 1);
  assert.equal(items[0].id, id);
  for (const url of [items[0].beforeUrl, items[0].afterUrl]) {
    assert.deepEqual(Buffer.from(await (await read(query(url))).arrayBuffer()), png);
  }
});

test('public pages work before the comparison migration; owner writes fail closed', async t => {
  const { owner, read } = await fixture(t, false);
  assert.deepEqual(await json(read('?locale=ru')), { items: [] });
  assert.equal((await read('?id=' + crypto.randomUUID() + '&side=before')).status, 404);
  assert.equal((await owner('?locale=ru')).status, 503);
});
