(() => {
  'use strict';

  const byId = id => document.getElementById(id);
  const nav = [...document.querySelectorAll('[data-view]')];
  const panels = [...document.querySelectorAll('[data-panel]')];
  const locales = { ru: 'Русский', de: 'Deutsch', en: 'English', uk: 'Українська' };
  const offerInputs = { badge: byId('offer-badge'), title: byId('offer-name'), description: byId('offer-description') };
  const api = '/api/admin/';
  let snapshot = null;
  let active = 'settings';
  let busy = false;
  let session = 0;
  let pageRequest = 0;
  let pagesLoaded = false;
  let currentPage = null;
  let pageDirty = false;
  let pageConflict = false;
  let pagePreferredLocale = 'ru';
  let offerEditor = null;
  let mediaRequest = 0;
  let mediaMode = 'photos';
  let mediaItems = [];
  let mediaEditor = null;
  let comparisonItems = [];
  let comparisonEditor = null;
  let knownPages = null;
  let uploadController = null;

  const mediaLimit = 150_000_000;
  const documentFormats = new Map([
    ['pdf', 'application/pdf'],
    ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    ['txt', 'text/plain'],
  ]);
  const documentExtensions = new Map([...documentFormats].map(([extension, mime]) => [mime, extension]));
  const mediaExtensions = new Map([
    ['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp'],
    ['mp4', 'video/mp4'], ['webm', 'video/webm'], ...documentFormats,
  ]);
  const mediaTypes = new Set(mediaExtensions.values());
  const mediaAccept = [...[...mediaExtensions.keys()].map(extension => '.' + extension), ...mediaTypes].join(',');

  const comparisonFields = { title: 'name', category: 'category', beforeAlt: 'before-alt', afterAlt: 'after-alt' };
  const comparisonCategories = new Map([...byId('comparison-category').options].map(option => [option.value, option.textContent]));
  const galleryModes = {
    photos: { mimePrefix: 'image/', label: 'Фотография с устройства или из облака', title: 'Добавить фото в галерею',
      accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp', limits: 'JPEG, PNG, WebP до 150 МБ.' },
    videos: { mimePrefix: 'video/', label: 'Видео с устройства или из облака', title: 'Добавить видео в галерею',
      accept: '.mp4,.webm,video/mp4,video/webm', limits: 'MP4, WebM до 150 МБ.' },
    pages: { mimePrefix: '', label: 'Фото, видео или документ с устройства или из облака', title: 'Добавить файл на страницу',
      accept: mediaAccept, limits: byId('media-limits').textContent },
  };

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function message(text, error = false, id = 'status') {
    const node = byId(id);
    node.textContent = text;
    node.dataset.error = String(error);
  }

  async function request(endpoint, method = 'GET', data, signal) {
    const options = { method, signal, credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } };
    if (data instanceof window.ArrayBuffer) {
      options.headers['Content-Type'] = 'application/octet-stream';
      options.body = data;
    } else if (data !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(data);
    }
    const response = await fetch(api + endpoint, options);
    if (!response.ok) {
      const error = new Error('HTTP ' + response.status);
      error.status = response.status;
      const details = await response.json().catch(() => null);
      error.code = details?.error;
      error.field = details?.field;
      throw error;
    }
    if (response.status === 204) return null;
    return response.json();
  }

  function problem(error) {
    if (error.code === 'revision_conflict') return 'Материал изменился в другом сеансе. Скопируйте нужные правки и обновите список.';
    if (error.code === 'alt_required') return 'Для показа фотографии нужно описание для доступности.';
    if (error.code === 'comparison_limit') return 'Достигнут лимит сравнений. Удалите ненужные черновики и попробуйте снова.';
    if (error.code === 'media_unavailable' || error.code === 'invalid_media_id') return 'Не удалось связать фотографии. Повторите загрузку пары.';
    if (error.code === 'media_limit') return 'Достигнут лимит медиатеки. Удалите ненужные черновики и попробуйте снова.';
    if (error.code === 'unpublish_first') return 'Сначала выключите показ файла на сайте.';
    if (error.code === 'invalid_media' || error.status === 415) return 'Файл не распознан. Выберите один из форматов, перечисленных в форме.';
    if (error.status === 413) return 'Файл превышает лимит 150 МБ.';
    if (error.status === 429) return 'Слишком много попыток. Повторите немного позже.';
    if (error.status === 503) return 'Управление временно недоступно. Проверьте настройку доступа и базы данных.';
    if (error.status === 400 || error.status === 422) return 'Проверьте значения и длину полей.';
    if (error.status === 403) return 'Доступ к этому действию запрещён.';
    return 'Не удалось связаться с сервером. Проверьте соединение и повторите попытку.';
  }

  function leaveGuard(event) {
    event.preventDefault();
    event.returnValue = '';
  }

  function mediaFormHasDraft() {
    return byId('media-file').files.length > 0 || Boolean(byId('media-name').value || byId('media-alt').value);
  }

  function comparisonFormHasDraft() {
    return ['before', 'after'].some(side => byId('comparison-' + side).files.length > 0) ||
      ['title', 'beforeAlt', 'afterAlt'].some(key => byId('comparison-' + comparisonFields[key]).value.trim());
  }

  function hasUnsavedChanges() {
    return pageDirty || offerEditor?.dirty || mediaEditor?.dirty || comparisonEditor?.dirty || mediaFormHasDraft() || comparisonFormHasDraft();
  }

  function updateGuard() {
    window.removeEventListener('beforeunload', leaveGuard);
    if (hasUnsavedChanges()) window.addEventListener('beforeunload', leaveGuard);
  }

  function setPageDirty(dirty) {
    pageDirty = dirty;
    const hasDraft = Boolean(currentPage?.hasDraft);
    byId('page-save').disabled = !dirty || busy || pageConflict;
    byId('page-publish').disabled = !(dirty || hasDraft) || busy || pageConflict;
    byId('page-reset').disabled = !dirty || busy;
    byId('page-reset').hidden = !dirty;
    byId('page-discard').disabled = !hasDraft || busy || pageConflict;
    byId('page-discard').hidden = !hasDraft;
    byId('page-preview').disabled = !(dirty || hasDraft) || busy;
    byId('page-preview-note').hidden = !dirty;
    byId('page-history').disabled = busy;
    byId('page-reload').disabled = busy;
    updateGuard();
  }

  function closeOffer() {
    if (byId('offer-dialog').open) byId('offer-dialog').close();
    byId('offer-form').reset();
    offerEditor = null;
    updateGuard();
  }

  function confirmDiscard(question, labels = {}) {
    const dialog = byId('discard-dialog');
    byId('discard-title').textContent = labels.title || 'Несохранённые правки';
    byId('discard-question').textContent = question;
    byId('discard-stay').textContent = labels.stay || 'Продолжить редактирование';
    byId('discard-action').textContent = labels.action || 'Отклонить правки';
    dialog.returnValue = 'stay';
    const decision = new Promise(resolve => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'discard'), { once: true });
    });
    dialog.showModal();
    return decision;
  }

  function signedOut(text = '') {
    session++;
    pageRequest++;
    mediaRequest++;
    mediaItems = [];
    comparisonItems = [];
    mediaMode = byId('media-mode').options[0].value;
    byId('media-mode').value = mediaMode;
    knownPages = null;
    for (const id of ['media-form', 'comparison-form']) {
      byId(id).reset();
      byId(id).hidden = true;
    }
    byId('media-filters').hidden = true;
    byId('media-reload').hidden = true;
    if (byId('page-preview-dialog').open) byId('page-preview-dialog').close();
    if (byId('page-history-dialog').open) byId('page-history-dialog').close();
    closeMediaEditor();
    closeComparisonEditor();
    snapshot = null;
    currentPage = null;
    pagesLoaded = false;
    pageConflict = false;
    pagePreferredLocale = 'ru';
    busy = false;
    closeOffer();
    setPageDirty(false);
    for (const id of ['settings-rows', 'priority-setting', 'offers-list', 'offer-section', 'page-fields', 'page-select', 'page-list', 'page-preview-fields', 'page-versions', 'media-list', 'media-page', 'comparison-list']) byId(id).replaceChildren();
    byId('page-search').value = '';
    byId('page-field-search').value = '';
    byId('page-links').hidden = true;
    byId('page-reload').hidden = true;
    byId('page-no-results').hidden = true;
    byId('page-name').textContent = 'Выберите страницу';
    byId('page-state').textContent = '';
    byId('login-form').reset();
    byId('console').hidden = true;
    byId('logout').hidden = true;
    byId('retry').hidden = true;
    byId('page-form').hidden = true;
    byId('login').hidden = false;
    message(text);
  }

  function handleError(error, id = 'status') {
    if (error.status === 401) signedOut('Сеанс завершён. Войдите снова.');
    else if (error.code === 'media_upload_cancelled') message('Загрузка остановлена.', false, id);
    else message(problem(error), true, id);
  }

  function selectView(view) {
    active = view;
    for (const button of nav) {
      if (button.dataset.view === view) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    for (const panel of panels) panel.hidden = panel.dataset.panel !== view;
  }

  function setBusy(value) {
    busy = value;
    for (const btn of nav) btn.disabled = value;
    byId('logout').disabled = value;
    byId('page-select').disabled = value;
    byId('page-search').disabled = value;
    byId('page-field-search').disabled = value;
    byId('page-language').disabled = value;
    for (const button of byId('page-list').querySelectorAll('button')) button.disabled = value;
    byId('media-mode').disabled = value;
    byId('media-language').disabled = value;
    byId('media-page').disabled = value;
    for (const node of document.querySelectorAll('[data-mutate]')) node.disabled = value;
    for (const input of byId('page-fields').querySelectorAll('input,textarea')) input.disabled = value;
    for (const input of Object.values(offerInputs)) input.disabled = value;
    byId('offer-language').disabled = value;
    byId('offer-close').disabled = value;
    byId('offer-reload').disabled = value;
    byId('offer-save').disabled = value || !offerEditor?.dirty || !byId('offer-reload').hidden;
    setPageDirty(pageDirty);
  }

  function toggleControl(name, enabled, editable, change, focusKey) {
    const label = element('label', undefined, 'switch');
    const input = element('input');
    input.type = 'checkbox';
    input.setAttribute('role', 'switch');
    input.setAttribute('aria-label', name);
    input.checked = enabled;
    input.disabled = !editable || busy;
    input.dataset.focusKey = focusKey;
    if (editable) {
      input.dataset.mutate = '';
      input.addEventListener('change', () => change(input.checked));
    }
    label.append(input, element('span', enabled ? 'Включено' : 'Выключено'));
    return label;
  }

  function renderSettings() {
    const query = byId('search').value.trim().toLocaleLowerCase('ru');
    const filter = byId('filter').value;
    const rows = [];
    const priority = byId('priority-setting');
    priority.hidden = true;
    priority.replaceChildren();
    for (const setting of snapshot.settings) {
      if (filter !== 'all' && setting.enabled !== (filter === 'on')) continue;
      if (![setting.label, setting.group, setting.description].join(' ').toLocaleLowerCase('ru').includes(query)) continue;
      const control = toggleControl(setting.label, setting.enabled, setting.editable, enabled => {
        saveSetting({ key: setting.key, enabled }, setting.label, 'setting:' + setting.key);
      }, 'setting:' + setting.key);
      const pinned = setting.key === 'promotions' && !query && filter === 'all';
      const name = element(pinned ? 'div' : 'td');
      name.append(element('span', setting.label, 'field-title'), element('span', setting.description, 'detail'));
      if (pinned) {
        priority.replaceChildren(name, control);
        priority.hidden = false;
        continue;
      }
      const tr = element('tr');
      const state = element('td');
      state.append(control);
      tr.append(name, element('td', setting.group, 'group-col'), state);
      rows.push(tr);
    }
    byId('settings-rows').replaceChildren(...rows);
    byId('empty').hidden = rows.length > 0;
  }

  function renderOffers() {
    const section = snapshot.settings.find(setting => setting.key === 'promotions');
    if (section) {
      const sectionControl = toggleControl('Страница «Акции»', section.enabled, section.editable, enabled => {
        saveSetting({ key: section.key, enabled }, 'Страница «Акции»', 'offer-section');
      }, 'offer-section');
      byId('offer-section').replaceChildren(element('div', section.enabled ? 'Страница «Акции» открыта. Посетители видят включённые карточки.' : 'Страница «Акции» выключена. Включите страницу и нужные карточки, чтобы предложения появились на сайте.'), sectionControl);
    }
    const items = snapshot.offers.map(offer => {
      const card = element('li', undefined, 'offer-row');
      const text = element('div', undefined, 'offer-copy');
      text.append(element('h3', offer.locales.ru.title), element('p', offer.locales.ru.description));
      const actions = element('div', undefined, 'offer-actions');
      const edit = element('button', 'Изменить', 'secondary');
      edit.type = 'button';
      edit.dataset.mutate = '';
      edit.dataset.focusKey = 'edit:' + offer.id;
      edit.setAttribute('aria-label', 'Изменить акцию «' + offer.locales.ru.title + '»');
      edit.addEventListener('click', () => openOffer(offer));
      actions.append(toggleControl(offer.locales.ru.title, offer.enabled, true, enabled => {
        saveSetting({ offer: { ...offer, enabled } }, offer.locales.ru.title, 'offer:' + offer.id);
      }, 'offer:' + offer.id), edit);
      card.append(text, actions);
      return card;
    });
    byId('offers-list').replaceChildren(...items);
  }

  function applySnapshot(next) {
    snapshot = next;
    renderSettings();
    renderOffers();
  }

  function restoreFocus(key) {
    const target = [...document.querySelectorAll('[data-focus-key]')].find(node => node.dataset.focusKey === key);
    (target || byId('filter')).focus({ preventScroll: true });
  }

  async function saveSetting(change, label, focusKey) {
    if (busy || !snapshot) return;
    setBusy(true);
    message('Сохраняем…');
    try {
      applySnapshot(await request('settings', 'PATCH', { ...change, revision: snapshot.revision }));
      message('Сохранено — ' + label + '.');
    } catch (error) {
      if (error.status === 409) {
        try {
          applySnapshot(await request('settings'));
          message('Настройки изменились в другом сеансе. Показано актуальное состояние. Повторите нужное действие.', true);
        } catch (refreshError) {
          applySnapshot(snapshot);
          handleError(refreshError);
        }
      } else {
        renderSettings();
        renderOffers();
        handleError(error);
      }
    } finally {
      setBusy(false);
      if (snapshot) restoreFocus(focusKey);
    }
  }

  async function start() {
    const token = ++session;
    byId('retry').hidden = true;
    message('Проверяем доступ…');
    try {
      const result = await request('settings');
      if (token !== session) return;
      applySnapshot(result);
      byId('login-form').reset();
      byId('login').hidden = true;
      byId('logout').hidden = false;
      byId('console').hidden = false;
      selectView('settings');
      setBusy(false);
      message('');
    } catch (error) {
      if (token !== session) return;
      signedOut();
      if (error.status !== 401) {
        handleError(error);
        byId('retry').hidden = false;
      }
    }
  }

  byId('login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const submit = event.currentTarget.querySelector('button');
    if (submit.disabled) return;
    submit.disabled = true;
    message('Входим…');
    try {
      await request('session', 'POST', { key: byId('key').value });
      byId('key').value = '';
      await start();
      if (snapshot) byId('console-title').focus();
    } catch (error) {
      message(error.status === 401 ? 'Ключ не подошёл. Проверьте его и попробуйте снова.' : problem(error), true);
    } finally { submit.disabled = false; }
  });

  byId('logout').addEventListener('click', async () => {
    if (busy || (hasUnsavedChanges() && !await confirmDiscard('Выйти без сохранения текущих правок?'))) return;
    setBusy(true);
    try {
      await request('session', 'DELETE');
      signedOut('Вы вышли из консоли.');
      byId('key').focus();
    } catch (error) { handleError(error); }
    finally { setBusy(false); }
  });

  for (const button of nav) button.addEventListener('click', () => {
    const view = button.dataset.view;
    if (busy || active === view) return;
    selectView(view);
    message('');
    if (view === 'pages' && !pagesLoaded) loadPages();
    if (view === 'media') loadMedia();
  });
  byId('retry').addEventListener('click', start);
  byId('search').addEventListener('input', renderSettings);
  byId('filter').addEventListener('change', renderSettings);
  for (const id of ['offer-language', 'page-language', 'media-language']) {
    for (const [code, text] of Object.entries(locales)) {
      const option = element('option', text);
      option.value = code;
      byId(id).append(option);
    }
  }

  function openOffer(offer) {
    offerEditor = { draft: window.structuredClone(offer), revision: snapshot.revision, dirty: false, language: 'ru' };
    byId('offer-language').value = 'ru';
    byId('offer-reload').hidden = true;
    byId('offer-save').disabled = true;
    message('', false, 'offer-status');
    showOfferFields();
    if (!byId('offer-dialog').open) byId('offer-dialog').showModal();
    updateGuard();
  }

  function showOfferFields() {
    const lang = byId('offer-language').value;
    offerEditor.language = lang;
    for (const [name, input] of Object.entries(offerInputs)) input.value = offerEditor.draft.locales[lang][name];
  }

  byId('offer-language').addEventListener('change', showOfferFields);
  for (const [name, input] of Object.entries(offerInputs)) input.addEventListener('input', () => {
    offerEditor.draft.locales[offerEditor.language][name] = input.value;
    offerEditor.dirty = true;
    byId('offer-save').disabled = !byId('offer-reload').hidden;
    message('Есть несохранённые изменения.', false, 'offer-status');
    updateGuard();
  });
  async function cancelOffer() {
    if (!busy && (!offerEditor?.dirty || await confirmDiscard('Закрыть акцию без сохранения изменений?'))) closeOffer();
  }
  byId('offer-dialog').addEventListener('cancel', event => {
    event.preventDefault();
    cancelOffer();
  });
  byId('offer-close').addEventListener('click', cancelOffer);
  byId('offer-reload').addEventListener('click', async () => {
    if (busy || (offerEditor?.dirty && !await confirmDiscard('Загрузить актуальную акцию и заменить текущие правки?'))) return;
    setBusy(true);
    try {
      applySnapshot(await request('settings'));
      openOffer(snapshot.offers.find(offer => offer.id === offerEditor.draft.id));
    } catch (error) { handleError(error, 'offer-status'); }
    finally { setBusy(false); }
  });
  byId('offer-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !offerEditor?.dirty || !byId('offer-reload').hidden) return;
    for (const [lang, fields] of Object.entries(offerEditor.draft.locales)) {
      for (const name of Object.keys(offerInputs)) if (!fields[name].trim()) {
        byId('offer-language').value = lang;
        showOfferFields();
        offerInputs[name].focus();
        message('Заполните поле для языка «' + locales[lang] + '».', true, 'offer-status');
        return;
      }
    }
    const focusKey = 'edit:' + offerEditor.draft.id;
    setBusy(true);
    message('Сохраняем…', false, 'offer-status');
    try {
      applySnapshot(await request('settings', 'PATCH', { revision: offerEditor.revision, offer: offerEditor.draft }));
      closeOffer();
      message('Изменения акции сохранены.');
    } catch (error) {
      if (error.status === 409) {
        byId('offer-reload').hidden = false;
        message('Настройки были изменены. Ваш черновик остаётся в форме. Скопируйте нужный текст перед загрузкой актуальной версии.', true, 'offer-status');
      } else handleError(error, 'offer-status');
    } finally {
      setBusy(false);
      if (snapshot && !offerEditor) restoreFocus(focusKey);
    }
  });

  function setPageOptions(id, pages) {
    byId(id).replaceChildren(...pages.map(page => {
      const option = element('option', page.label);
      option.value = page.slug;
      return option;
    }));
  }

  function renderPageDirectory(selectedSlug = byId('page-select').value) {
    const input = byId('page-search').value.trim().toLocaleLowerCase('ru');
    const query = input.replace(/^https?:\/\/[^/]+/u, '').replace(/^\/(?:(?:de|en|ru|uk)(?:\/|$))?/u, '')
      .replace(/[?#].*$/u, '').replace(/(?:\.html|\/)$/u, '') || (input ? 'index' : '');
    const matches = (knownPages || []).filter(page => `${page.label} ${page.slug} ${page.group || ''}`.toLocaleLowerCase('ru').includes(query));
    const selected = knownPages?.find(page => page.slug === selectedSlug);
    const select = byId('page-select');
    select.replaceChildren();
    const directory = byId('page-list');
    directory.replaceChildren();
    const groups = new Map();
    const choices = selected && !matches.includes(selected) ? [selected, ...matches] : matches;
    for (const page of choices) {
      const name = page.group || 'Страницы';
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(page);
    }
    for (const [name, pages] of groups) {
      const options = element('optgroup');
      options.label = name;
      const group = element('div', undefined, 'page-directory-group');
      group.append(element('h3', name));
      for (const page of pages) {
        const option = element('option', page.label);
        option.value = page.slug;
        options.append(option);
        if (!matches.includes(page)) continue;
        const button = element('button', page.label);
        button.type = 'button';
        button.dataset.slug = page.slug;
        button.disabled = busy;
        if (page.slug === selectedSlug) button.setAttribute('aria-current', 'page');
        group.append(button);
      }
      select.append(options);
      if (group.childElementCount > 1) directory.append(group);
    }
    if (selected) select.value = selectedSlug;
    byId('page-no-results').hidden = matches.length > 0 || !query;
    directory.hidden = !matches.length;
  }

  function selectPagePair(slug, preferredLocale) {
    const page = knownPages?.find(item => item.slug === slug);
    if (!page) return false;
    const available = page.locales || Object.keys(locales);
    if (!available.length) return false;
    for (const option of byId('page-language').options) option.disabled = !available.includes(option.value);
    byId('page-language').value = available.includes(preferredLocale) ? preferredLocale : available[0];
    renderPageDirectory(slug);
    byId('page-name').textContent = page.label;
    return true;
  }

  async function loadPages() {
    const token = ++pageRequest;
    byId('page-reload').hidden = true;
    message('Загружаем страницы…', false, 'page-status');
    try {
      const { pages } = await request('pages');
      if (token !== pageRequest) return;
      knownPages = pages;
      pagesLoaded = true;
      if (pages.length && selectPagePair(pages[0].slug, pagePreferredLocale)) await loadPage();
      else message('Список страниц пуст.', false, 'page-status');
    } catch (error) {
      if (token === pageRequest) {
        handleError(error, 'page-status');
        byId('page-reload').hidden = false;
      }
    }
  }

  const pageKinds = { heading: 'Заголовок', paragraph: 'Текст', title: 'SEO-заголовок', description: 'Метаописание', label: 'Подпись', link: 'Адрес ссылки', 'image-alt': 'Описание изображения' };
  const pageGroupLabels = { seo: 'SEO', text: 'Контент', actions: 'Кнопки и ссылки', accessibility: 'Изображения и доступность' };

  function pageFieldGroup(field) {
    if (['title', 'description'].includes(field.kind)) return 'SEO';
    if (field.group) return pageGroupLabels[field.group] || field.group;
    if (field.kind === 'link') return 'Ссылки';
    if (field.kind === 'image-alt') return 'Изображения';
    return 'Контент';
  }

  function setPageLink(id, value) {
    const link = byId(id);
    let url;
    try { if (value) url = new URL(value, window.location.origin); } catch { /* Omit unavailable links. */ }
    link.hidden = !url || url.origin !== window.location.origin;
    if (link.hidden) link.removeAttribute('href');
    else link.href = url.href;
  }

  function pageStateLabel() {
    const version = currentPage.publishedRevision || 0;
    const text = version > 0 ? `На сайте версия ${version}` : 'На сайте исходная версия';
    return currentPage.hasDraft ? text + ' · Есть черновик' : text;
  }

  function filterPageFields() {
    const query = byId('page-field-search').value.trim().toLocaleLowerCase();
    let count = 0;
    for (const group of byId('page-fields').children) {
      let groupCount = 0;
      for (const label of group.querySelectorAll('label')) {
        const input = label.querySelector('[data-field]');
        label.hidden = Boolean(query) && !`${label.textContent} ${input.value}`.toLocaleLowerCase().includes(query);
        if (!label.hidden) groupCount++;
      }
      if (query && !Object.hasOwn(group.dataset, 'previousOpen')) group.dataset.previousOpen = String(group.open);
      if (!query && Object.hasOwn(group.dataset, 'previousOpen')) {
        group.open = group.dataset.previousOpen === 'true';
        delete group.dataset.previousOpen;
      }
      if (query && groupCount > 0) group.open = true;
      group.hidden = groupCount === 0;
      count += groupCount;
    }
    const total = currentPage?.fields.length || 0;
    byId('page-field-count').textContent = count === 0 ? 'Совпадений нет' : `Полей ${count} из ${total}`;
  }

  function showPage(data) {
    currentPage = data;
    pageConflict = false;
    const groups = new Map();
    const previousGroups = new Map([...byId('page-fields').children].map(group => [group.dataset.name, group.dataset.previousOpen || String(group.open)]));
    const firstContent = data.fields.find(field => pageFieldGroup(field) !== 'SEO');
    const mainGroup = firstContent ? pageFieldGroup(firstContent) : 'SEO';
    for (const field of data.fields) {
      const title = pageFieldGroup(field);
      if (!groups.has(title)) {
        const group = element('details', undefined, 'page-field-group');
        group.dataset.name = title;
        group.open = previousGroups.has(title) ? previousGroups.get(title) === 'true' : data.fields.length <= 24 || title === mainGroup;
        group.append(element('summary', title), element('div', undefined, 'page-field-body'));
        groups.set(title, group);
      }
      const label = element('label', field.label || pageKinds[field.kind] || 'Поле');
      const multiline = ['paragraph', 'description'].includes(field.kind) || Math.max(field.value.length, field.original.length) > 100;
      const input = element(multiline ? 'textarea' : 'input');
      input.dataset.field = field.id;
      input.lang = data.locale;
      input.maxLength = field.maxLength ?? (['title', 'heading'].includes(field.kind) ? 220 : 4000);
      if (multiline) input.rows = field.kind === 'description' ? 2 : 3;
      if (field.kind === 'link') input.inputMode = 'url';
      input.disabled = busy;
      input.value = field.value;
      input.placeholder = field.original;
      label.append(input);
      groups.get(title).lastElementChild.append(label);
    }
    const seo = groups.get('SEO');
    groups.delete('SEO');
    byId('page-fields').replaceChildren(...groups.values(), ...(seo ? [seo] : []));
    byId('page-field-search-row').hidden = !data.fields.length;
    filterPageFields();
    byId('page-state').textContent = pageStateLabel();
    setPageLink('page-public-link', data.url);
    setPageLink('page-preview-link', data.previewUrl);
    byId('page-links').hidden = false;
    byId('page-form').hidden = !data.fields.length && !data.hasDraft;
    byId('page-reload').hidden = true;
    setPageDirty(false);
    message(data.fields.length ? '' : 'На этой странице нет редактируемых полей.', false, 'page-status');
  }

  async function loadPage() {
    const token = ++pageRequest;
    const params = new URLSearchParams({ locale: byId('page-language').value, slug: byId('page-select').value });
    currentPage = null;
    pageConflict = false;
    setPageDirty(false);
    byId('page-fields').replaceChildren();
    byId('page-field-search').value = '';
    byId('page-state').textContent = '';
    byId('page-form').hidden = true;
    byId('page-links').hidden = true;
    byId('page-reload').hidden = true;
    message('Загружаем текст…', false, 'page-status');
    try {
      const data = await request('page?' + params);
      if (token === pageRequest) showPage(data);
    } catch (error) {
      if (token === pageRequest) {
        handleError(error, 'page-status');
        byId('page-reload').hidden = false;
      }
    }
  }

  function changedFields() {
    const values = {};
    const originals = new Map(currentPage.fields.map(field => [field.id, field.value]));
    for (const input of byId('page-fields').querySelectorAll('[data-field]')) {
      if (input.value !== originals.get(input.dataset.field)) values[input.dataset.field] = input.value;
    }
    return values;
  }

  async function changePagePair(slug, locale, focusHeading = false) {
    if (busy || !slug || (currentPage?.slug === slug && currentPage?.locale === locale)) return;
    if (pageDirty && !await confirmDiscard('Перейти к другому тексту без сохранения правок?')) {
      selectPagePair(currentPage.slug, currentPage.locale);
      return;
    }
    if (!selectPagePair(slug, locale)) return;
    await loadPage();
    if (focusHeading && currentPage?.slug === slug && active === 'pages') byId('page-name').focus();
  }

  byId('page-search').addEventListener('input', () => renderPageDirectory());
  byId('page-field-search').addEventListener('input', filterPageFields);
  byId('page-list').addEventListener('click', event => {
    const button = event.target.closest('[data-slug]');
    if (button && button.dataset.slug !== byId('page-select').value) changePagePair(button.dataset.slug, pagePreferredLocale, true);
  });
  byId('page-select').addEventListener('change', event => changePagePair(event.currentTarget.value, pagePreferredLocale));
  byId('page-language').addEventListener('change', async event => {
    const locale = event.currentTarget.value;
    await changePagePair(byId('page-select').value, locale);
    if (byId('page-language').value === locale) pagePreferredLocale = locale;
  });

  byId('page-reload').addEventListener('click', async () => {
    if (busy) return;
    if (!pageConflict || !currentPage) {
      if (pagesLoaded) loadPage();
      else loadPages();
      return;
    }
    const { locale, slug } = currentPage;
    const values = changedFields();
    setBusy(true);
    try {
      const latest = await request('page?' + new URLSearchParams({ locale, slug }));
      const fieldIds = new Set(latest.fields.map(field => field.id));
      if (Object.keys(values).some(id => !fieldIds.has(id))) {
        message('Набор полей изменился. Скопируйте правки, затем отмените ввод и загрузите актуальную версию.', true, 'page-status');
        return;
      }
      showPage(latest);
      for (const input of byId('page-fields').querySelectorAll('[data-field]')) {
        if (Object.hasOwn(values, input.dataset.field)) input.value = values[input.dataset.field];
      }
      filterPageFields();
      setPageDirty(Object.keys(changedFields()).length > 0);
      message(pageDirty ? 'Ваши правки перенесены в свежую версию. Сравните тексты перед сохранением.' : 'Загружена актуальная версия.', false, 'page-status');
    } catch (error) { handleError(error, 'page-status'); }
    finally { setBusy(false); }
  });

  byId('page-fields').addEventListener('input', () => {
    setPageDirty(Object.keys(changedFields()).length > 0);
    if (!pageConflict) message(pageDirty ? 'Есть несохранённые изменения.' : '', false, 'page-status');
  });
  byId('page-reset').addEventListener('click', () => {
    if (pageConflict) loadPage();
    else showPage(currentPage);
  });
  byId('page-preview').addEventListener('click', () => {
    if (!currentPage || busy) return;
    const values = changedFields();
    const items = currentPage.fields.flatMap(field => {
      const proposed = Object.hasOwn(values, field.id) ? values[field.id].trim() || field.original : field.value;
      const published = field.published ?? field.original;
      if (proposed === published) return [];
      const item = element('section', undefined, 'copy-preview-item');
      const columns = element('div', undefined, 'copy-preview-columns');
      for (const [name, content] of [['На сайте', published], ['В редакторе', proposed]]) {
        const column = element('div');
        const text = element('p', content);
        text.lang = currentPage.locale;
        column.append(element('strong', name), text);
        columns.append(column);
      }
      item.append(element('h3', field.label || pageKinds[field.kind] || 'Поле'), columns);
      return [item];
    });
    byId('page-preview-context').textContent = pageContext();
    byId('page-preview-fields').replaceChildren(...(items.length ? items : [element('p', 'Текущие значения совпадают с опубликованными.')]));
    byId('page-preview-dialog').showModal();
  });

  function pageContext() {
    return byId('page-name').textContent + ' · ' + locales[currentPage.locale];
  }

  const pageMutationMessages = {
    save_draft: ['Сохраняем черновик…', 'Черновик сохранён. Откройте предпросмотр или опубликуйте правки.'],
    publish: ['Публикуем…', 'Новая версия страницы опубликована.'],
    discard_draft: ['Удаляем черновик…', 'Черновик удалён. На сайте по-прежнему опубликована сохранённая версия.'],
    restore: ['Восстанавливаем версию…', 'Версия восстановлена в черновик. Проверьте её перед публикацией.'],
  };

  async function mutatePage(action, extra = {}) {
    if (busy || pageConflict || !currentPage) return;
    const { locale, slug, revision } = currentPage;
    let invalidInput;
    setBusy(true);
    message(pageMutationMessages[action][0], false, 'page-status');
    try {
      showPage(await request('page', 'PATCH', { locale, slug, revision, action, ...extra }));
      message(pageMutationMessages[action][1], false, 'page-status');
    } catch (error) {
      if (error.code === 'revision_conflict' || (error.status === 409 && !error.code)) {
        pageConflict = true;
        byId('page-reload').hidden = false;
        message('Страница изменилась в другом сеансе. Загрузите актуальную версию, чтобы перенести свои правки.', true, 'page-status');
      } else if (error.code === 'version_not_found') {
        byId('page-reload').hidden = false;
        pageConflict = true;
        message('Этой версии больше нет в истории. Загрузите актуальную версию страницы.', true, 'page-status');
      } else if (error.code === 'invalid_field') {
        invalidInput = [...byId('page-fields').querySelectorAll('[data-field]')].find(input => input.dataset.field === error.field);
        const label = invalidInput?.closest('label').firstChild.textContent;
        message(label ? `Проверьте поле «${label}».` : 'Проверьте длину текста и адреса ссылок.', true, 'page-status');
      } else if (error.status === 413) {
        message('Изменения превышают общий объём текста для одной страницы.', true, 'page-status');
      } else handleError(error, 'page-status');
    } finally {
      setBusy(false);
      if (invalidInput) {
        if (invalidInput.closest('label').hidden) {
          byId('page-field-search').value = '';
          filterPageFields();
        }
        invalidInput.closest('details').open = true;
        invalidInput.focus();
      }
    }
  }

  byId('page-form').addEventListener('submit', event => {
    event.preventDefault();
    if (pageDirty) mutatePage('save_draft', { values: changedFields() });
  });
  byId('page-publish').addEventListener('click', async () => {
    if (!byId('page-form').reportValidity()) return;
    const confirmed = await confirmDiscard(`Опубликовать текущий текст страницы «${pageContext()}»? Посетители сразу увидят правки.`, {
      title: 'Публикация страницы', stay: 'Вернуться', action: 'Опубликовать',
    });
    if (confirmed) mutatePage('publish', pageDirty ? { values: changedFields() } : {});
  });
  byId('page-discard').addEventListener('click', async () => {
    const confirmed = await confirmDiscard('Удалить сохранённый черновик и текущие правки этой страницы?', {
      title: 'Удаление черновика', stay: 'Вернуться', action: 'Удалить черновик',
    });
    if (confirmed) mutatePage('discard_draft');
  });

  const versionDate = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
  byId('page-history').addEventListener('click', () => {
    if (!currentPage) return;
    const versions = (currentPage.versions || []).map(version => {
      const item = element('li');
      const info = element('div');
      const name = version.revision === 0 ? 'Исходный текст' : `Версия ${version.revision}`;
      info.append(element('strong', name));
      if (version.revision === (currentPage.publishedRevision || 0)) info.append(element('span', 'Сейчас на сайте', 'detail'));
      const date = new Date(version.createdAt);
      if (version.createdAt && Number.isFinite(date.getTime())) info.append(element('span', versionDate.format(date), 'detail'));
      const restore = element('button', 'Восстановить в черновик', 'secondary');
      restore.type = 'button';
      restore.dataset.version = version.revision;
      restore.setAttribute('aria-label', `Восстановить в черновик · ${name}`);
      restore.disabled = pageConflict || (version.revision === (currentPage.publishedRevision || 0) && !currentPage.hasDraft && !pageDirty);
      item.append(info, restore);
      return item;
    });
    byId('page-history-context').textContent = pageContext();
    byId('page-versions').replaceChildren(...(versions.length ? versions : [element('li', 'Опубликованных версий пока нет.')]));
    byId('page-history-dialog').showModal();
  });
  byId('page-versions').addEventListener('click', async event => {
    const button = event.target.closest('[data-version]');
    if (!button || busy || pageConflict) return;
    const version = Number(button.dataset.version);
    byId('page-history-dialog').close();
    if ((pageDirty || currentPage.hasDraft) && !await confirmDiscard('Заменить текущий черновик и несохранённые правки выбранной версией?', {
      title: 'Восстановление версии', stay: 'Вернуться', action: 'Восстановить в черновик',
    })) return;
    mutatePage('restore', { version });
  });
  function mediaTarget() {
    const slug = mediaMode === 'pages' ? byId('media-page').value : 'galereya';
    return { locale: byId('media-language').value, slug };
  }

  async function loadMedia() {
    const requestId = ++mediaRequest;
    const mode = mediaMode;
    const comparisons = mode === 'comparisons';
    const form = byId(comparisons ? 'comparison-form' : 'media-form');
    const list = byId(comparisons ? 'comparison-list' : 'media-list');
    byId('media-filters').hidden = false;
    byId('media-page-choice').hidden = mode !== 'pages';
    byId('media-form').hidden = true;
    byId('comparison-form').hidden = true;
    byId('media-reload').hidden = true;
    for (const id of ['media-list', 'comparison-list']) {
      byId(id).replaceChildren();
      byId(id).hidden = true;
    }
    message(comparisons ? 'Загружаем сравнения…' : 'Загружаем медиа…', false, 'media-status');
    if (!comparisons) {
      const definition = galleryModes[mode];
      byId('media-file').accept = definition.accept;
      byId('media-limits').textContent = definition.limits;
      byId('media-file-label').textContent = definition.label;
      byId('media-form-title').textContent = definition.title;
      byId('media-alt-hint').hidden = mode === 'videos';
    }
    try {
      if (mode === 'pages' && !byId('media-page').options.length) {
        const pages = knownPages || (await request('pages')).pages;
        if (requestId !== mediaRequest) return;
        knownPages = pages;
        const mediaPages = pages.filter(page => !['galereya', 'telegram-menu', 'reviews'].includes(page.slug));
        if (!mediaPages.some(page => page.slug === 'promotions')) mediaPages.push({ slug: 'promotions', label: 'Акции' });
        setPageOptions('media-page', mediaPages);
      }
      const target = comparisons ? { locale: byId('media-language').value } : mediaTarget();
      const { items } = await request((comparisons ? 'comparisons?' : 'media?') + new URLSearchParams(target));
      if (requestId !== mediaRequest) return;
      if (comparisons) {
        comparisonItems = items;
        renderComparisons();
      } else {
        mediaItems = items.filter(item => item.mime.startsWith(galleryModes[mode].mimePrefix));
        renderMedia();
      }
      form.hidden = false;
      list.hidden = false;
      message('', false, 'media-status');
    } catch (error) {
      if (requestId === mediaRequest) handleError(error, 'media-status');
    } finally {
      if (requestId === mediaRequest) byId('media-reload').hidden = false;
    }
  }

  function renderMedia() {
    const rows = mediaItems.map(item => {
      const entry = element('li', undefined, 'media-item');
      const source = api + 'media?' + new URLSearchParams({ id: item.id });
      const previewTag = item.mime.startsWith('image/') ? 'img' : item.mime.startsWith('video/') ? 'video' : null;
      if (previewTag) {
        const preview = element(previewTag);
        if (previewTag === 'video') {
          preview.controls = true;
          preview.preload = 'metadata';
          preview.playsInline = true;
          preview.setAttribute('aria-label', item.title);
        } else {
          preview.alt = item.alt || item.title;
          preview.loading = 'lazy';
          preview.decoding = 'async';
        }
        preview.src = source;
        entry.append(preview);
      }
      const info = element('div', undefined, 'media-info');
      info.append(element('h3', item.title));
      if (item.alt) info.append(element('p', item.alt, 'detail'));
      const controls = element('div', undefined, 'media-actions');
      const focusKey = 'media-state:' + item.id;
      const visibility = toggleControl('Показывать «' + item.title + '»', item.published, true, published => {
        if (published && item.mime.startsWith('image/') && !item.alt) {
          openMediaEditor(item, 'Введите описание изображения перед показом на сайте.');
          visibility.querySelector('input').checked = false;
          return;
        }
        patchMedia(item, { published }, published ? 'Показ файла включён.' : 'Файл скрыт с сайта.', focusKey);
      }, focusKey);
      visibility.querySelector('span').textContent = item.published ? 'На сайте' : 'Черновик';
      const edit = mediaButton('Изменить', 'Изменить описание «' + item.title + '»', () => openMediaEditor(item));
      edit.dataset.focusKey = 'media-edit:' + item.id;
      controls.append(visibility, edit);
      const extension = documentExtensions.get(item.mime);
      if (extension) {
        const download = element('a', 'Скачать ' + extension.toUpperCase(), 'secondary');
        const filename = item.title.replace(/[\\/:*?"<>|]/gu, '-').replace(/[. ]+$/u, '') || 'document';
        download.href = source;
        download.download = filename + '.' + extension;
        download.setAttribute('aria-label', 'Скачать «' + item.title + '»');
        controls.append(download);
      }
      if (!item.published) controls.append(mediaButton('Удалить', 'Удалить черновик «' + item.title + '»', () => deleteMedia(item)));
      info.append(controls);
      entry.append(info);
      return entry;
    });
    if (!rows.length) {
      const text = mediaMode === 'photos' ? 'В этом разделе галереи ещё нет добавленных фотографий.'
        : mediaMode === 'videos' ? 'В этом разделе галереи ещё нет добавленных видеозаписей.'
          : 'На выбранной странице пока нет добавленных файлов.';
      rows.push(element('li', text, 'empty'));
    }
    byId('media-list').replaceChildren(...rows);
  }

  function mediaButton(label, accessibleName, click) {
    const button = element('button', label, 'secondary');
    button.type = 'button';
    button.dataset.mutate = '';
    button.setAttribute('aria-label', accessibleName);
    button.addEventListener('click', click);
    return button;
  }

  function mutateMedia(endpoint, method, data, onSuccess, focusKey, status = 'media-status') {
    return runMediaMutation(() => request(endpoint, method, data), onSuccess, {
      focusKey, status, pending: method === 'POST' ? 'Загружаем…' : 'Сохраняем…',
    });
  }

  async function runMediaMutation(send, onSuccess, { focusKey, status = 'media-status', pending }) {
    if (busy) return;
    setBusy(true);
    message(pending, false, status);
    try {
      onSuccess(await send());
    } catch (error) {
      handleError(error, status);
    } finally {
      setBusy(false);
      if (snapshot) {
        const comparisons = mediaMode === 'comparisons';
        const list = byId(comparisons ? 'comparison-list' : 'media-list');
        if (comparisons) renderComparisons();
        else renderMedia();
        if (!byId('media-dialog').open && !byId('comparison-dialog').open && focusKey) {
          const target = [...list.querySelectorAll('[data-focus-key]')].find(node => node.dataset.focusKey === focusKey);
          (target || byId('media-mode')).focus({ preventScroll: true });
        }
      }
    }
  }

  function patchMedia(item, changes, notice, focusKey, status) {
    return mutateMedia('media', 'PATCH', { id: item.id, revision: item.revision, ...changes }, ({ item: saved }) => {
      mediaItems = mediaItems.map(existing => existing.id === saved.id ? saved : existing);
      if (status === 'media-edit-status') closeMediaEditor();
      message(notice, false, 'media-status');
    }, focusKey, status);
  }

  async function deleteMedia(item) {
    if (busy || !await confirmDiscard('Удалить черновик «' + item.title + '»? Файл исчезнет из медиатеки.', {
      title: 'Удаление черновика', stay: 'Отмена', action: 'Удалить черновик',
    })) return;
    await mutateMedia('media?' + new URLSearchParams({ id: item.id }), 'DELETE', undefined, () => {
      mediaItems = mediaItems.filter(existing => existing.id !== item.id);
      message('Черновик удалён.', false, 'media-status');
    }, 'media-edit:' + item.id);
  }

  function openMediaEditor(item, notice = '') {
    mediaEditor = { item, dirty: false };
    byId('media-edit-name').value = item.title;
    byId('media-edit-alt').value = item.alt;
    message(notice, Boolean(notice), 'media-edit-status');
    byId('media-dialog').showModal();
  }

  function closeMediaEditor() {
    if (byId('media-dialog').open) byId('media-dialog').close();
    byId('media-edit-form').reset();
    mediaEditor = null;
    updateGuard();
  }

  async function finishMediaEditor() {
    if (busy || (mediaEditor?.dirty && !await confirmDiscard('Закрыть описание файла без сохранения?'))) return;
    closeMediaEditor();
  }

  byId('media-edit-close').addEventListener('click', finishMediaEditor);
  byId('media-dialog').addEventListener('cancel', event => {
    event.preventDefault();
    finishMediaEditor();
  });
  byId('media-edit-form').addEventListener('input', () => {
    if (!mediaEditor) return;
    mediaEditor.dirty = byId('media-edit-name').value !== mediaEditor.item.title || byId('media-edit-alt').value !== mediaEditor.item.alt;
    updateGuard();
  });
  byId('media-edit-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!mediaEditor || busy) return;
    const { item } = mediaEditor;
    const title = byId('media-edit-name').value.trim();
    const alt = byId('media-edit-alt').value.trim();
    if (item.published && item.mime.startsWith('image/') && !alt) {
      message('Для фотографии, которая видна на сайте, нужно описание.', true, 'media-edit-status');
      byId('media-edit-alt').focus();
      return;
    }
    if (!title) {
      message('Введите название файла.', true, 'media-edit-status');
      byId('media-edit-name').focus();
      return;
    }
    if (!mediaEditor.dirty) {
      closeMediaEditor();
      return;
    }
    patchMedia(item, { title, alt }, 'Описание файла сохранено.', 'media-edit:' + item.id, 'media-edit-status');
  });

  function comparisonValues(prefix) {
    return Object.fromEntries(Object.entries(comparisonFields).map(([key, name]) => [key, byId(prefix + name).value.trim()]));
  }

  function renderComparisons() {
    const rows = comparisonItems.map(item => {
      const entry = element('li', undefined, 'media-item');
      const preview = element('div', undefined, 'comparison-photos');
      for (const [side, label] of [['before', 'До'], ['after', 'После']]) {
        const figure = element('figure');
        const photo = element('img');
        photo.alt = item[side + 'Alt'] || label + ' · ' + item.title;
        photo.loading = 'lazy';
        photo.decoding = 'async';
        photo.src = api + 'comparisons?' + new URLSearchParams({ id: item.id, side });
        figure.append(element('figcaption', label), photo);
        preview.append(figure);
      }
      const info = element('div', undefined, 'media-info');
      info.append(element('h3', item.title), element('p', comparisonCategories.get(item.category), 'detail'));
      const actions = element('div', undefined, 'media-actions');
      const focusKey = 'comparison-state:' + item.id;
      const visibility = toggleControl('Показывать сравнение «' + item.title + '»', item.published, true, published => {
        if (published && (!item.beforeAlt || !item.afterAlt)) {
          visibility.querySelector('input').checked = false;
          openComparisonEditor(item, 'Введите описания обеих фотографий перед показом на сайте.');
          return;
        }
        patchComparison(item, { published }, published ? 'Показ сравнения включён.' : 'Сравнение скрыто с сайта.', focusKey);
      }, focusKey);
      visibility.querySelector('span').textContent = item.published ? 'На сайте' : 'Черновик';
      const edit = mediaButton('Изменить', 'Изменить сравнение «' + item.title + '»', () => openComparisonEditor(item));
      edit.dataset.focusKey = 'comparison-edit:' + item.id;
      actions.append(visibility, edit);
      if (!item.published) actions.append(mediaButton('Удалить', 'Удалить черновик «' + item.title + '»', () => deleteComparison(item)));
      info.append(actions);
      entry.append(preview, info);
      return entry;
    });
    if (!rows.length) rows.push(element('li', 'Для выбранного языка пока нет сравнений.', 'empty'));
    byId('comparison-list').replaceChildren(...rows);
  }

  function patchComparison(item, changes, notice, focusKey, status) {
    return mutateMedia('comparisons', 'PATCH', { id: item.id, revision: item.revision, ...changes }, ({ item: saved }) => {
      comparisonItems = comparisonItems.map(existing => existing.id === saved.id ? saved : existing);
      if (status === 'comparison-edit-status') closeComparisonEditor();
      message(notice, false, 'media-status');
    }, focusKey, status);
  }

  async function deleteComparison(item) {
    if (busy || !await confirmDiscard('Удалить черновик «' + item.title + '» вместе с обеими фотографиями?', {
      title: 'Удаление черновика', stay: 'Отмена', action: 'Удалить черновик',
    })) return;
    const params = new URLSearchParams({ id: item.id, revision: item.revision });
    await mutateMedia('comparisons?' + params, 'DELETE', undefined, () => {
      comparisonItems = comparisonItems.filter(existing => existing.id !== item.id);
      message('Черновик сравнения удалён.', false, 'media-status');
    }, 'comparison-edit:' + item.id);
  }

  function openComparisonEditor(item, notice = '') {
    comparisonEditor = { item, dirty: false };
    for (const [key, name] of Object.entries(comparisonFields)) byId('comparison-edit-' + name).value = item[key];
    message(notice, Boolean(notice), 'comparison-edit-status');
    byId('comparison-dialog').showModal();
  }

  function closeComparisonEditor() {
    if (byId('comparison-dialog').open) byId('comparison-dialog').close();
    byId('comparison-edit-form').reset();
    comparisonEditor = null;
    updateGuard();
  }

  async function finishComparisonEditor() {
    if (busy || (comparisonEditor?.dirty && !await confirmDiscard('Закрыть сравнение без сохранения правок?'))) return;
    closeComparisonEditor();
  }

  byId('comparison-edit-close').addEventListener('click', finishComparisonEditor);
  byId('comparison-dialog').addEventListener('cancel', event => {
    event.preventDefault();
    finishComparisonEditor();
  });
  byId('comparison-edit-form').addEventListener('input', () => {
    if (!comparisonEditor) return;
    comparisonEditor.dirty = Object.entries(comparisonValues('comparison-edit-'))
      .some(([key, value]) => value !== comparisonEditor.item[key]);
    updateGuard();
  });
  byId('comparison-edit-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!comparisonEditor || busy) return;
    const values = comparisonValues('comparison-edit-');
    if (!values.title || !values.beforeAlt || !values.afterAlt) {
      message('Укажите название и описания обеих фотографий.', true, 'comparison-edit-status');
      return;
    }
    if (!comparisonEditor.dirty) {
      closeComparisonEditor();
      return;
    }
    const { item } = comparisonEditor;
    patchComparison(item, values, 'Описание сравнения сохранено.', 'comparison-edit:' + item.id, 'comparison-edit-status');
  });

  function mediaFilePayload(file, mimePrefix) {
    const extension = /\.([^.]+)$/u.exec(file?.name)?.[1]?.toLowerCase();
    const reportedMime = file?.type;
    const genericMime = ['application/octet-stream', 'application/zip', 'application/x-zip-compressed'];
    const mime = !reportedMime || genericMime.includes(reportedMime) ? mediaExtensions.get(extension) : reportedMime;
    if (!mediaTypes.has(mime) || !file.size || !mime.startsWith(mimePrefix)) {
      const format = mimePrefix === 'image/' ? 'Выберите файл JPEG, PNG или WebP.'
        : mimePrefix === 'video/' ? 'Выберите файл MP4 или WebM.' : 'Выберите один из форматов, перечисленных в форме.';
      message(format, true, 'media-status');
      return null;
    }
    if (file.size > mediaLimit) {
      message('Файл превышает лимит 150 МБ.', true, 'media-status');
      return null;
    }
    return { file, mime };
  }

  function uploadEndpoint(action, values) {
    return 'media?' + new URLSearchParams({ action, ...values });
  }

  async function sendUploadStep(endpoint, data, signal) {
    try {
      return await request(endpoint, 'POST', data, signal);
    } catch (error) {
      // Uploading the same part or finalizing the same session twice is safe.
      if (signal.aborted || ![undefined, 408, 500, 502, 503, 504].includes(error.status)) throw error;
      return request(endpoint, 'POST', data, signal);
    }
  }

  async function abortUpload(id) {
    const cleanup = new window.AbortController();
    const timer = window.setTimeout(() => cleanup.abort(), 5000);
    try {
      await request(uploadEndpoint('abort', { upload_id: id }), 'POST', undefined, cleanup.signal);
    } catch {
      // A transfer abandoned while offline can expire on the server.
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function uploadMedia(files, attach) {
    const controller = new window.AbortController();
    const { signal } = controller;
    uploadController = controller;
    const progress = byId('media-upload-progress');
    const cancel = byId('media-upload-cancel');
    const megabytes = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
    const totalBytes = files.reduce((sum, { file }) => sum + file.size, 0);
    const total = megabytes.format(totalBytes / 1_000_000);
    const uploads = [];
    const items = [];
    let transferred = 0;
    progress.value = 0;
    progress.max = totalBytes;
    cancel.disabled = true;
    byId('media-upload').hidden = false;
    try {
      for (const { file, mime, metadata } of files) {
        const parameters = { ...metadata, mime, size: file.size };
        if (attach) parameters.comparison = 1;
        const { upload_id: id, chunk_size: chunkSize } = await request(uploadEndpoint('begin', parameters), 'POST', undefined, signal);
        if (typeof id !== 'string' || !id) throw new Error('Missing media upload ID');
        uploads.push(id);
        if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0 || chunkSize > mediaLimit) throw new Error('Invalid upload chunk size');
        cancel.disabled = false;
        for (let start = 0, part = 0; start < file.size; start += chunkSize, part++) {
          const end = Math.min(start + chunkSize, file.size);
          const endpoint = uploadEndpoint('chunk', { upload_id: id, part });
          // Pass the bytes from this file window directly to the request.
          const bytes = await file.slice(start, end).arrayBuffer();
          await sendUploadStep(endpoint, bytes, signal);
          progress.value = transferred + end;
          message('Передано ' + megabytes.format((transferred + end) / 1_000_000) + ' из ' + total + ' МБ.', false, 'media-status');
        }
        transferred += file.size;
        cancel.disabled = true;
        message(attach ? 'Сохраняем фотографию…' : 'Сохраняем черновик…', false, 'media-status');
        const { item } = await sendUploadStep(uploadEndpoint('finish', { upload_id: id }), undefined, signal);
        if (!item?.id) throw new Error('Missing uploaded media ID');
        items.push(item);
      }
      if (!attach) return { item: items[0] };
      message('Сохраняем сравнение…', false, 'media-status');
      return await attach(items);
    } catch (error) {
      await Promise.all(uploads.map(abortUpload));
      if (signal.aborted) throw Object.assign(new Error('Media upload cancelled'), { code: 'media_upload_cancelled' });
      throw error;
    } finally {
      uploadController = null;
      cancel.disabled = true;
      byId('media-upload').hidden = true;
    }
  }

  byId('media-upload-cancel').addEventListener('click', event => {
    if (event.currentTarget.disabled || !uploadController) return;
    event.currentTarget.disabled = true;
    message('Останавливаем загрузку…', false, 'media-status');
    uploadController.abort();
  });

  byId('comparison-form').addEventListener('input', updateGuard);
  byId('comparison-form').addEventListener('submit', event => {
    event.preventDefault();
    if (busy || mediaMode !== 'comparisons' || byId('comparison-form').hidden) return;
    const values = comparisonValues('comparison-');
    if (!values.title || !values.beforeAlt || !values.afterAlt) {
      message('Укажите название и описания обеих фотографий.', true, 'media-status');
      return;
    }
    const locale = byId('media-language').value;
    const files = [];
    for (const side of ['before', 'after']) {
      const selected = mediaFilePayload(byId('comparison-' + side).files[0], 'image/');
      if (!selected) return;
      files.push({ ...selected, metadata: { locale, slug: 'do-i-posle', title: values.title, alt: values[side + 'Alt'] } });
    }
    const attach = ([before, after]) => request('comparisons', 'POST', {
      locale, ...values, beforeId: before.id, afterId: after.id,
    });
    runMediaMutation(() => uploadMedia(files, attach), ({ item }) => {
      comparisonItems.unshift(item);
      byId('comparison-form').reset();
      updateGuard();
      message('Черновик сравнения загружен. Проверьте обе фотографии перед показом.', false, 'media-status');
    }, { pending: 'Подготавливаем фотографии…' });
  });

  byId('media-mode').addEventListener('change', async event => {
    const next = event.currentTarget.value;
    if (busy || next === mediaMode) return;
    const comparisons = mediaMode === 'comparisons';
    const hasDraft = comparisons ? comparisonFormHasDraft() : mediaFormHasDraft();
    if (hasDraft && !await confirmDiscard('Сменить раздел медиатеки без загрузки выбранных файлов?')) {
      byId('media-mode').value = mediaMode;
      return;
    }
    byId(comparisons ? 'comparison-form' : 'media-form').reset();
    mediaMode = next;
    updateGuard();
    loadMedia();
  });
  for (const id of ['media-language', 'media-page']) byId(id).addEventListener('change', loadMedia);
  byId('media-reload').addEventListener('click', loadMedia);
  byId('media-form').addEventListener('input', updateGuard);
  byId('media-file').addEventListener('change', event => {
    const file = event.currentTarget.files[0];
    if (file && !byId('media-name').value.trim()) byId('media-name').value = file.name.replace(/\.[^.]+$/, '').slice(0, 120);
    updateGuard();
  });
  byId('media-form').addEventListener('submit', event => {
    event.preventDefault();
    if (busy || byId('media-form').hidden) return;
    const file = byId('media-file').files[0];
    const title = byId('media-name').value.trim();
    const alt = byId('media-alt').value.trim();
    if (!file || !title) {
      message('Выберите файл и укажите его название.', true, 'media-status');
      return;
    }
    const selected = mediaFilePayload(file, galleryModes[mediaMode].mimePrefix);
    if (!selected) return;
    const metadata = { ...mediaTarget(), title, alt };
    const onUploaded = ({ item }) => {
      mediaItems.unshift(item);
      byId('media-form').reset();
      updateGuard();
      message('Черновик загружен. Проверьте файл и включите показ, когда он будет готов.', false, 'media-status');
    };
    runMediaMutation(() => uploadMedia([{ ...selected, metadata }]), onUploaded, { pending: 'Подготавливаем загрузку…' });
  });
  start();
})();
