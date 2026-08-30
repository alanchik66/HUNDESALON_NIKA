(function () {
  const COPY = {
    de: { empty: 'Dokumente werden vorbereitet.', open: 'Öffnen' },
    ru: { empty: 'Документы готовятся.', open: 'Открыть' },
    en: { empty: 'Documents are being prepared.', open: 'Open' },
    uk: { empty: 'Документи готуються.', open: 'Відкрити' },
  };

  const getLang = () => {
    const lang = (document.documentElement.lang || 'de').toLowerCase().slice(0, 2);
    return COPY[lang] ? lang : 'de';
  };

  const escapeHtml = value =>
    String(value ?? '').replace(/[&<>"']/g, char => {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return map[char];
    });

  const resolveDocumentUrl = value => {
    const raw = String(value || '').trim();
    if (!raw || /(?:ВАШ_|YOUR_|GOOGLE_DRIVE_FOLDER_ID)/i.test(raw)) return '';

    try {
      const url = new URL(raw, window.location.origin);
      const isSameOrigin = url.origin === window.location.origin;
      return url.protocol === 'https:' || isSameOrigin ? url.href : '';
    } catch {
      return '';
    }
  };

  const init = async () => {
    const container = document.querySelector('[data-documents-list]');
    if (!container) {
      return;
    }

    const lang = getLang();
    const copy = COPY[lang];
    try {
      const response = await fetch('/data/documents.json', { headers: { Accept: 'application/json' } });
      const items = response.ok ? await response.json() : [];
      const localized = Array.isArray(items)
        ? items
            .filter(item => item?.language === lang)
            .map(item => ({ ...item, url: resolveDocumentUrl(item.url) }))
            .filter(item => item.url)
        : [];
      container.innerHTML = localized.length
        ? localized
            .map(
              item => `
                <article class="document-card">
                  <h3>${escapeHtml(item.title)}</h3>
                  <p>${escapeHtml(item.description)}</p>
                  <a href="${escapeHtml(item.url)}" class="btn-neon" target="_blank" rel="noopener noreferrer">${copy.open}</a>
                </article>
              `
            )
            .join('')
        : `<p class="document-card">${copy.empty}</p>`;
    } catch {
      container.innerHTML = `<p class="document-card">${copy.empty}</p>`;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    void init();
  }
})();
