import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import { applyPageCopy } from '../../_lib/page-copy.js';
import { openAdminSession } from '../../_lib/site-admin-auth.js';
import { onRequest } from './page.js';

const origin = 'http://127.0.0.1:8796';
const api = '/api/admin/page';
const slug = 'index';
const legacyValues = { title: 'Ранее сохранено', 'hero-heading': 'Старый заголовок' };

function sourcePage(locale) {
  return `<!doctype html><html lang="${locale}"><head><title>Default ${locale}</title>
    <meta name="description" data-nika-copy-description="meta-description" content="Default summary">
    <meta property="og:description" data-nika-copy-description-mirror="meta-description" content="Default summary">
    <script src="/assets/js/page.js"></script></head><body>
    <h1><!--nika-copy:heading:hero-heading-->Default heading<!--/nika-copy--></h1>
    <p><!--nika-copy:paragraph:intro-->Original page introduction.<!--/nika-copy--></p>
    <a data-nika-copy-link="booking-link" href="/${locale}/onlayn-bronirovanie">
      <!--nika-copy:label:booking-label-->Book now<!--/nika-copy--></a>
    <form action="/${locale}/contacts"></form>
    </body></html>`;
}

function sqliteD1(raw) {
  return {
    prepare(sql) {
      const statement = raw.prepare(sql);
      return {
        bind(...args) {
          return {
            first: () => statement.get(...args) ?? null,
            all: () => ({ results: statement.all(...args) }),
            run: () => ({ meta: { changes: statement.run(...args).changes } }),
          };
        },
      };
    },
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

async function fixture(t, { legacy = false } = {}) {
  const raw = new DatabaseSync(':memory:');
  t.after(() => raw.close());
  const migrate = name => raw.exec(readFileSync(new URL('../../../migrations/' + name, import.meta.url), 'utf8'));
  migrate('0013_site_settings.sql');
  migrate('0014_site_page_copy.sql');
  if (legacy) {
    raw
      .prepare('INSERT INTO site_page_copy (locale, slug, revision, values_json) VALUES (?, ?, ?, ?)')
      .run('ru', slug, 3, JSON.stringify(legacyValues));
  }
  migrate('0018_site_page_editor.sql');
  let assetGate;
  const env = {
    CHAT_DB: sqliteD1(raw),
    SITE_ADMIN_KEY: crypto.randomUUID(),
    ASSETS: {
      async fetch(input) {
        const url = new URL(input);
        const match = /^\/(de|en|ru|uk)\/(?:index(?:\.html)?)?$/.exec(url.pathname);
        if (!match) return new Response(null, { status: 404 });
        if (assetGate) {
          const gate = assetGate;
          if (--gate.remaining === 0) {
            assetGate = undefined;
            gate.resolve();
          }
          await gate.promise;
        }
        return htmlResponse(match[1]);
      },
    },
  };
  const login = await openAdminSession(new Request(origin + '/admin/'), env);
  const cookie = login.headers.get('Set-Cookie').split(';', 1)[0];
  function admin(options = {}) {
    const {
      locale = 'ru',
      page = slug,
      view,
      values,
      method = values === undefined ? 'GET' : 'PATCH',
      authenticated = true,
      requestOrigin = origin,
      contentType = 'application/json',
    } = options;
    const headers = new Headers({ Origin: requestOrigin, 'Content-Type': contentType });
    if (authenticated) headers.set('Cookie', cookie);
    const query = new URLSearchParams({ locale, slug: page, ...(view ? { view } : {}) });
    const body = values === undefined ? undefined : JSON.stringify({ locale, slug: page, ...values });
    const request = new Request(origin + api + '?' + query, { method, headers, body });
    return onRequest({ request, env });
  }
  return {
    raw,
    admin,
    change: (locale, revision, action, values, version) =>
      admin({ locale, values: { revision, action, values, version } }),
    publicPage: async (locale, path = `/${locale}/`) => applyPageCopy(htmlResponse(locale), env, new URL(path, origin)),
    async race(first, second) {
      assert.equal(assetGate, undefined);
      assetGate = { ...Promise.withResolvers(), remaining: 2 };
      return Promise.all([first(), second()]);
    },
  };
}

function htmlResponse(locale) {
  return new Response(sourcePage(locale), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ETag: '"stable"',
      'Cache-Control': 'public, max-age=600',
    },
  });
}

async function expectJson(result, status = 200) {
  const response = await result;
  const data = await response.json();
  assert.equal(response.status, status, JSON.stringify(data));
  return data;
}

const field = (snapshot, id) => snapshot.fields.find(entry => entry.id === id);
const revisions = snapshot => snapshot.versions.map(entry => entry.revision);

test('owner auth and origin protect the editor, including migrated history and preview', async t => {
  const { admin, raw } = await fixture(t, { legacy: true });
  assert.deepEqual(await expectJson(admin({ authenticated: false }), 401), { error: 'unauthorized' });
  assert.deepEqual(await expectJson(admin({ view: 'preview', authenticated: false }), 401), { error: 'unauthorized' });
  assert.deepEqual(await expectJson(admin({ requestOrigin: 'https://other.example', values: { revision: 3 } }), 403), {
    error: 'invalid_origin',
  });
  assert.deepEqual(await expectJson(admin({ method: 'POST' }), 405), { error: 'method_not_allowed' });
  const snapshot = await expectJson(admin());
  assert.equal(snapshot.locale, 'ru');
  assert.equal(snapshot.slug, 'index');
  assert.equal(snapshot.revision, 3);
  assert.equal(snapshot.publishedRevision, 3);
  assert.equal(snapshot.hasDraft, false);
  assert.equal(field(snapshot, 'title').value, legacyValues.title);
  assert.deepEqual(snapshot.versions, [
    { revision: 3, createdAt: null },
    { revision: 0, createdAt: null },
  ]);
  assert.equal(raw.prepare('SELECT count(*) AS n FROM site_page_versions').get().n, 1);
});

test('draft preview, publishing, restoring and discarding keep the public copy and other locales isolated', async t => {
  const { admin, change, publicPage } = await fixture(t, { legacy: true });
  const changed = {
    title: '<Проверка>',
    'hero-heading': 'Уход & забота',
    'meta-description': 'Рядом "с домом"',
    'booking-link': '/ru/kontakty?from=home&lang=ru',
  };
  const draft = await expectJson(change('ru', 3, 'save_draft', changed));
  assert.equal(draft.revision, 4);
  assert.equal(draft.publishedRevision, 3);
  assert.equal(draft.hasDraft, true);
  assert.equal(field(draft, 'title').value, changed.title);
  assert.equal(field(draft, 'title').published, legacyValues.title);
  assert.deepEqual(revisions(draft), [3, 0]);

  const preview = await admin({ view: 'preview' });
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get('cache-control'), 'private, no-store');
  assert.equal(preview.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(preview.headers.get('x-robots-tag'), 'noindex, nofollow');
  const csp = preview.headers.get('content-security-policy');
  assert.match(csp, /(?:^|;\s*)sandbox;/);
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /form-action 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  const previewHtml = await preview.text();
  assert.match(previewHtml, /<head><base href="\/ru\/">/);
  assert.match(previewHtml, /<title>&lt;Проверка&gt;<\/title>/);
  assert.match(previewHtml, /Уход &amp; забота/);
  assert.match(previewHtml, /href="\/ru\/kontakty\?from=home&amp;lang=ru"/);
  assert.match(previewHtml, /property="og:description" content="Рядом &quot;с домом&quot;"/);

  const oldPublic = await publicPage('ru');
  assert.equal(oldPublic.headers.get('etag'), null);
  assert.match(await oldPublic.text(), /Старый заголовок/);
  const ukrainianDraft = await expectJson(change('uk', 0, 'save_draft', { title: 'Українська чернетка' }));
  assert.equal(ukrainianDraft.publishedRevision, 0);
  assert.match(await (await publicPage('uk')).text(), /Default uk/);
  assert.equal(field(await expectJson(admin()), 'title').value, changed.title);

  const published = await expectJson(change('ru', 4, 'publish'));
  assert.equal(published.revision, 5);
  assert.equal(published.publishedRevision, 4);
  assert.equal(published.hasDraft, false);
  assert.deepEqual(revisions(published), [4, 3, 0]);
  assert.match(await (await publicPage('ru', '/ru/index.html')).text(), /<title>&lt;Проверка&gt;<\/title>/);

  const restored = await expectJson(change('ru', 5, 'restore', undefined, 3));
  assert.equal(restored.revision, 6);
  assert.equal(restored.publishedRevision, 4);
  assert.equal(restored.hasDraft, true);
  assert.equal(field(restored, 'title').value, legacyValues.title);
  assert.match(await (await publicPage('ru')).text(), /<title>&lt;Проверка&gt;<\/title>/);
  const restoredPublication = await expectJson(change('ru', 6, 'publish'));
  assert.equal(restoredPublication.publishedRevision, 5);
  assert.deepEqual(revisions(restoredPublication), [5, 4, 3, 0]);
  assert.match(await (await publicPage('ru')).text(), /Ранее сохранено/);

  await expectJson(change('ru', 7, 'save_draft', { title: 'Черновик для удаления' }));
  const discarded = await expectJson(change('ru', 8, 'discard_draft'));
  assert.equal(discarded.revision, 9);
  assert.equal(discarded.hasDraft, false);
  assert.equal(field(discarded, 'title').value, legacyValues.title);
  assert.deepEqual(revisions(discarded), [5, 4, 3, 0]);
  assert.equal(field(await expectJson(admin({ locale: 'uk' })), 'title').value, 'Українська чернетка');
});

test(
  'optimistic locks allow one first draft and one publication per competing revision',
  { timeout: 10000 },
  async t => {
    const { admin, change, publicPage, race, raw } = await fixture(t);
    async function oneWinner(locale, revision, action) {
      const responses = await race(
        () => change(locale, revision, action, { title: 'Winner candidate A' }),
        () => change(locale, revision, action, { title: 'Winner candidate B' })
      );
      assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
      assert.deepEqual(await responses.find(response => response.status === 409).json(), {
        error: 'revision_conflict',
      });
      const state = await responses.find(response => response.status === 200).json();
      assert.equal(state.revision, revision + 1);
      const saved = await expectJson(admin({ locale }));
      assert.equal(field(saved, 'title').value, field(state, 'title').value);
      return saved;
    }
    const firstDraft = await oneWinner('de', 0, 'save_draft');
    assert.equal(firstDraft.hasDraft, true);
    assert.deepEqual(revisions(firstDraft), [0]);
    assert.match(await (await publicPage('de')).text(), /<title>Default de<\/title>/);

    const fromDraft = await oneWinner('de', 1, 'publish');
    assert.equal(fromDraft.hasDraft, false);
    assert.equal(fromDraft.publishedRevision, 1);
    assert.deepEqual(revisions(fromDraft), [1, 0]);
    assert.match(await (await publicPage('de')).text(), /<title>Winner candidate [AB]<\/title>/);

    const firstPublish = await oneWinner('en', 0, 'publish');
    assert.equal(firstPublish.publishedRevision, 1);
    assert.deepEqual(revisions(firstPublish), [1, 0]);
    assert.equal(raw.prepare('SELECT count(*) AS n FROM site_page_versions').get().n, 2);
  }
);

test('editor rejects invalid targets, fields and links before writing any state', async t => {
  const { admin, change, raw } = await fixture(t);
  assert.deepEqual(await expectJson(admin({ locale: 'es' }), 400), { error: 'invalid_page' });
  assert.deepEqual(await expectJson(admin({ page: '../admin' }), 400), { error: 'invalid_page' });
  assert.deepEqual(await expectJson(admin({ values: { revision: 0 }, contentType: 'text/plain' }), 415), {
    error: 'json_required',
  });
  assert.deepEqual(await expectJson(change('ru', 0, 'restore', undefined, 9), 404), { error: 'version_not_found' });
  assert.deepEqual(await expectJson(change('ru', 0, 'save_draft', { 'unknown-field': 'value' }), 400), {
    error: 'invalid_field',
    field: 'unknown-field',
  });
  assert.deepEqual(await expectJson(change('ru', 0, 'save_draft', { title: 'x'.repeat(221) }), 400), {
    error: 'invalid_field',
    field: 'title',
  });
  for (const link of [
    'javascript:alert(1)',
    '//other.example/test',
    '/api/admin/settings',
    '/admin/',
    'https://user:pass@example.com/path',
  ]) {
    assert.deepEqual(await expectJson(change('ru', 0, 'publish', { 'booking-link': link }), 400), {
      error: 'invalid_field',
      field: 'booking-link',
    });
  }
  assert.equal(raw.prepare('SELECT count(*) AS n FROM site_page_editor').get().n, 0);
  assert.equal(raw.prepare('SELECT count(*) AS n FROM site_page_versions').get().n, 0);
});
