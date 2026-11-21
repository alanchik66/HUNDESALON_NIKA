const comparisonCategories = '<option value="dogs">Собаки</option><option value="cats">Кошки</option><option value="smallAnimals">Мелкие питомцы</option><option value="salon">Салон</option>';
const imageInputFormats = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';

export function renderAdminPage() {
  return `<!doctype html>
<html lang="ru" class="admin-document">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <meta name="color-scheme" content="dark">
  <meta name="theme-color" content="#010301">
  <title>Управление сайтом · HUNDESALON NIKA</title>
  <link rel="icon" href="/assets/images/brand/logo-ui.webp">
  <link rel="stylesheet" href="/assets/css/style.css">
  <link rel="stylesheet" href="/assets/css/service-card-glass.css?v=7">
  <link rel="stylesheet" href="/assets/css/site-admin.css?v=8">
  <script defer src="/assets/js/service-card-glass.js?v=6" data-admin-glass="true"></script>
  <script defer src="/assets/js/site-admin.js?v=10"></script>
</head>
<body class="admin-page">
  <header class="header mast">
    <div class="wrap mast-inner">
      <div class="brand"><img src="/assets/images/brand/logo-ui.webp" width="44" height="44" alt=""><span>HUNDESALON <b>NIKA</b></span></div>
      <div class="mast-actions nav-main">
        <a href="/ru/" target="_blank" rel="noopener">Открыть сайт <img class="mast-globe" src="/assets/images/icons/globe-language.webp" width="32" height="32" alt=""></a>
        <button class="filter-btn" id="logout" type="button" hidden>Выйти</button>
      </div>
    </div>
  </header>
  <main class="wrap" id="main">
    <noscript><p>Включите JavaScript, чтобы войти в консоль.</p></noscript>
    <p class="notice" id="status" role="status" aria-live="polite">Проверяем доступ…</p>
    <button type="button" class="secondary" id="retry" hidden>Повторить</button>
    <section class="login card" id="login" aria-labelledby="login-title" hidden>
      <h1 id="login-title">Вход в консоль</h1>
      <p>Введите ключ администратора салона.</p>
      <form id="login-form" method="post" action="/api/admin/session">
        <label for="key">Ключ доступа</label>
        <input id="key" name="key" type="password" autocomplete="current-password" required spellcheck="false">
        <button class="primary" type="submit">Войти</button>
      </form>
    </section>
    <div id="console" class="admin-glass-area" data-service-glass hidden>
      <div class="title-band"><h1 tabindex="-1" id="console-title">Управление сайтом</h1></div>
      <nav class="navigation nav-main" aria-label="Управление сайтом">
        <button class="filter-btn" type="button" data-view="settings" aria-current="page">Разделы</button>
        <button class="filter-btn" type="button" data-view="pages">Страницы</button>
        <button class="filter-btn" type="button" data-view="offers">Акции</button>
        <button class="filter-btn" type="button" data-view="media">Медиа</button>
      </nav>
      <section class="card workspace" data-panel="settings" aria-labelledby="settings-title">
        <div class="panel-head"><h2 id="settings-title">Разделы и функции</h2><p>Переключатель меняет доступность на сайте сразу для всех языков.</p></div>
        <div id="priority-setting" class="priority-setting" hidden></div>
        <div class="filters"><label>Поиск<input id="search" type="search" placeholder="Название или описание"></label><label>Состояние<select id="filter"><option value="all">Все</option><option value="on">Включены</option><option value="off">Выключены</option></select></label></div>
        <table class="feature-table"><caption class="sr-only">Доступность разделов и функций</caption><thead><tr><th scope="col">Название</th><th scope="col" class="group-col">Группа</th><th scope="col" class="state-col">Доступность</th></tr></thead><tbody id="settings-rows"></tbody></table>
        <p id="empty" class="empty" hidden>По вашему запросу ничего не найдено.</p>
      </section>
      <section class="card workspace" data-panel="pages" aria-labelledby="pages-title" hidden>
        <div class="panel-head"><h2 id="pages-title">Редактор страниц</h2></div>
        <div class="page-workspace">
          <aside class="page-navigator" aria-label="Выбор страницы">
            <label>Поиск по страницам<input id="page-search" type="search" placeholder="Название или адрес"></label>
            <label class="page-mobile-select">Страница<select id="page-select"></select></label>
            <nav class="page-directory" id="page-list" aria-label="Страницы сайта"></nav>
            <p class="detail" id="page-no-results" role="status" hidden>По этому запросу страниц нет.</p>
          </aside>
          <div class="page-editor">
            <div class="page-editor-head">
              <div>
                <h3 id="page-name" tabindex="-1">Выберите страницу</h3>
                <p id="page-state" class="detail"></p>
              </div>
              <label>Язык<select id="page-language"></select></label>
            </div>
            <div class="page-links" id="page-links" hidden>
              <a href="/ru/" id="page-public-link" target="_blank" rel="noopener">Страница на сайте</a>
              <a href="/ru/" id="page-preview-link" target="_blank" rel="noopener">Предпросмотр</a>
              <button class="secondary" type="button" id="page-history">История версий</button>
            </div>
            <p id="page-status" class="form-status" role="status"></p>
            <button type="button" class="secondary" id="page-reload" hidden>Загрузить актуальную версию</button>
            <form id="page-form" hidden>
              <div class="form-actions page-actions">
                <button type="submit" class="secondary" id="page-save">Сохранить черновик</button>
                <button type="button" class="primary" id="page-publish">Опубликовать</button>
                <button type="button" class="secondary" id="page-preview">Сравнить тексты</button>
                <button type="button" class="secondary" id="page-reset" hidden>Отменить ввод</button>
                <button type="button" class="secondary" id="page-discard" hidden>Удалить черновик</button>
              </div>
              <p class="detail page-preview-note" id="page-preview-note" hidden>Предпросмотр открывает сохранённую версию. Сохраните черновик, чтобы увидеть в нём текущие правки.</p>
              <div id="page-field-search-row" class="page-field-search">
                <label>Поиск по полям<input id="page-field-search" type="search" placeholder="Название поля или текст"></label>
                <p id="page-field-count" class="detail" role="status"></p>
              </div>
              <p class="detail page-field-note">Пустое поле возвращает исходное значение при сохранении.</p>
              <div class="fields" id="page-fields"></div>
            </form>
          </div>
        </div>
      </section>
      <section class="card workspace" data-panel="offers" aria-labelledby="offers-title" hidden>
        <div class="panel-head"><h2 id="offers-title">Предложения салона</h2><p>Управляйте карточками на странице «Акции» и редактируйте их переводы.</p></div>
        <div id="offer-section"></div>
        <ul id="offers-list" class="offer-list"></ul>
      </section>
      <section class="card workspace" data-panel="media" aria-labelledby="media-title" hidden>
        <div class="panel-head"><h2 id="media-title">Медиатека</h2><p>Добавляйте материалы для выбранного языка. Включайте показ, когда черновик готов.</p></div>
        <div class="filters media-filters" id="media-filters" hidden>
          <label>Раздел<select id="media-mode">
            <option value="photos">Фото галереи</option>
            <option value="videos">Видео галереи</option>
            <option value="comparisons">До и после</option>
            <option value="pages">Медиа страниц</option>
          </select></label>
          <label>Язык<select id="media-language"></select></label>
          <label id="media-page-choice" hidden>Страница<select id="media-page"></select></label>
        </div>
        <p id="media-file-sources" class="detail">На iPhone в системном окне «Файлы» откройте «Обзор» и выберите подключённый iCloud Drive, OneDrive или Google Drive. На компьютере выберите файл в синхронизированной папке облака.</p>
        <form id="media-form" class="media-form" hidden>
          <h3 id="media-form-title">Добавить файл</h3>
          <label><span id="media-file-label">Файл с устройства или из облака</span><input id="media-file" type="file" aria-describedby="media-limits media-file-sources" data-mutate required></label>
          <p id="media-limits" class="detail">JPEG, PNG, WebP, MP4, WebM, PDF, DOCX, XLSX, PPTX и TXT. До 150 МБ на файл.</p>
          <div class="media-meta">
            <label>Название<input id="media-name" maxlength="120" data-mutate required></label>
            <label>Описание для доступности<input id="media-alt" maxlength="250" aria-describedby="media-alt-hint" data-mutate></label>
          </div>
          <p id="media-alt-hint" class="detail">Кратко опишите, что на фото. Описание обязательно для показа изображения.</p>
          <div><button type="submit" class="primary" data-mutate>Загрузить черновик</button></div>
        </form>
        <form id="comparison-form" class="media-form" hidden>
          <h3>Добавить сравнение</h3>
          <div class="media-meta">
            <label>Название<input id="comparison-name" maxlength="120" data-mutate required></label>
            <label>Категория<select id="comparison-category" data-mutate>${comparisonCategories}</select></label>
          </div>
          <p id="comparison-limits" class="detail">Выберите две фотографии JPEG, PNG или WebP с устройства или из облака. До 150 МБ на каждое фото.</p>
          <div class="media-meta comparison-inputs">
            <fieldset><legend>До</legend>
              <label>Фото до<input id="comparison-before" type="file" accept="${imageInputFormats}" aria-describedby="comparison-limits media-file-sources" data-mutate required></label>
              <label>Описание фото до<input id="comparison-before-alt" maxlength="250" data-mutate required></label>
            </fieldset>
            <fieldset><legend>После</legend>
              <label>Фото после<input id="comparison-after" type="file" accept="${imageInputFormats}" aria-describedby="comparison-limits media-file-sources" data-mutate required></label>
              <label>Описание фото после<input id="comparison-after-alt" maxlength="250" data-mutate required></label>
            </fieldset>
          </div>
          <div><button type="submit" class="primary" data-mutate>Загрузить черновик пары</button></div>
        </form>
        <div id="media-upload" class="form-actions" hidden>
          <progress id="media-upload-progress" value="0" max="100" aria-label="Ход загрузки"></progress>
          <button id="media-upload-cancel" class="secondary" type="button" disabled>Отменить загрузку</button>
        </div>
        <p id="media-status" class="form-status" role="status"></p>
        <button id="media-reload" class="secondary" type="button" data-mutate hidden>Обновить список</button>
        <ul id="media-list" class="media-list" aria-label="Медиа в выбранном разделе"></ul>
        <ul id="comparison-list" class="media-list comparison-list" aria-label="Сравнения до и после" hidden></ul>
      </section>
    </div>
  </main>
  <dialog id="offer-dialog" aria-labelledby="offer-title">
    <form id="offer-form">
      <h2 id="offer-title">Редактирование акции</h2>
      <label>Язык перевода<select id="offer-language"></select></label>
      <div class="fields">
        <label>Метка<input id="offer-badge" name="badge" required maxlength="80"></label>
        <label>Заголовок<input id="offer-name" name="title" required maxlength="160"></label>
        <label>Описание<textarea id="offer-description" name="description" rows="4" required maxlength="600"></textarea></label>
      </div>
      <p class="form-status" id="offer-status" role="status"></p>
      <div class="form-actions"><button type="submit" class="primary" id="offer-save">Сохранить изменения</button><button type="button" class="secondary" id="offer-close">Закрыть</button><button type="button" class="secondary" id="offer-reload" hidden>Загрузить актуальный текст</button></div>
    </form>
  </dialog>
  <dialog id="page-preview-dialog" class="copy-preview" aria-labelledby="page-preview-title">
    <form method="dialog">
      <h2 id="page-preview-title">Сравнение текстов</h2>
      <p id="page-preview-context" class="detail"></p>
      <div id="page-preview-fields" class="fields"></div>
      <div class="form-actions"><button type="submit" class="primary" autofocus>Вернуться к правкам</button></div>
    </form>
  </dialog>
  <dialog id="page-history-dialog" aria-labelledby="page-history-title">
    <form method="dialog">
      <h2 id="page-history-title">История версий</h2>
      <p class="detail" id="page-history-context"></p>
      <ul id="page-versions" class="page-versions"></ul>
      <div class="form-actions"><button type="submit" class="secondary" autofocus>Закрыть</button></div>
    </form>
  </dialog>
  <dialog id="media-dialog" aria-labelledby="media-edit-title">
    <form id="media-edit-form">
      <h2 id="media-edit-title">Описание файла</h2>
      <label>Название<input id="media-edit-name" maxlength="120" data-mutate required></label>
      <label>Описание для доступности<input id="media-edit-alt" maxlength="250" data-mutate></label>
      <p id="media-edit-status" class="form-status" role="status"></p>
      <div class="form-actions"><button type="submit" class="primary" data-mutate>Сохранить</button><button type="button" id="media-edit-close" class="secondary" data-mutate>Закрыть</button></div>
    </form>
  </dialog>
  <dialog id="comparison-dialog" aria-labelledby="comparison-edit-title">
    <form id="comparison-edit-form">
      <h2 id="comparison-edit-title">Редактирование сравнения</h2>
      <div class="fields comparison-edit-fields">
        <label>Название<input id="comparison-edit-name" maxlength="120" data-mutate required></label>
        <label>Категория<select id="comparison-edit-category" data-mutate>${comparisonCategories}</select></label>
        <label>Описание фото до<input id="comparison-edit-before-alt" maxlength="250" data-mutate required></label>
        <label>Описание фото после<input id="comparison-edit-after-alt" maxlength="250" data-mutate required></label>
      </div>
      <p id="comparison-edit-status" class="form-status" role="status"></p>
      <div class="form-actions"><button type="submit" class="primary" data-mutate>Сохранить</button><button type="button" id="comparison-edit-close" class="secondary" data-mutate>Закрыть</button></div>
    </form>
  </dialog>
  <dialog id="discard-dialog" aria-labelledby="discard-title">
    <form method="dialog">
      <h2 id="discard-title">Несохранённые правки</h2>
      <p id="discard-question"></p>
      <div class="form-actions"><button type="submit" class="primary" id="discard-stay" value="stay" autofocus>Продолжить редактирование</button><button type="submit" id="discard-action" class="secondary" value="discard">Отклонить правки</button></div>
    </form>
  </dialog>
</body>
</html>`;
}
