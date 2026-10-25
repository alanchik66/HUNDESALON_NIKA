(function () {
  const COPY = {
    de: {
      kicker: 'Vertrauen',
      title: 'Stimmen unserer Kundinnen und Kunden',
      empty: 'Bewertungen werden gerade vorbereitet.',
    },
    ru: {
      kicker: 'Доверие',
      title: 'Отзывы наших клиентов',
      empty: 'Отзывы скоро появятся.',
    },
    en: {
      kicker: 'Trust',
      title: 'What clients say',
      empty: 'Testimonials are being prepared.',
    },
    uk: {
      kicker: 'Довіра',
      title: 'Відгуки наших клієнтів',
      empty: 'Відгуки скоро зʼявляться.',
    },
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

  const renderTestimonials = (container, items, lang) => {
    const copy = COPY[lang];
    const localizedItems = items.filter(item => item.language === lang);

    container.innerHTML = `
      <div class="container">
        <p class="section-kicker">${copy.kicker}</p>
        <h2 class="section-title">${copy.title}</h2>
        <div class="testimonials-grid">
          ${
            localizedItems.length
              ? localizedItems
                  .map(item => {
                    const name = String(item.name ?? '').trim();
                    const petName = String(item.petName ?? '').trim();
                    const photoUrl = String(item.photoUrl ?? '').trim();
                    const author = petName ? `${name} · ${petName}` : name;
                    const avatar = photoUrl
                      ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(name)}" width="96" height="96" loading="lazy" decoding="async">`
                      : `<span class="testimonial-card__avatar" aria-hidden="true">${escapeHtml(name.charAt(0).toUpperCase() || 'N')}</span>`;

                    return `
              <article class="testimonial-card">
                ${avatar}
                <div>
                  <p class="testimonial-card__text">“${escapeHtml(item.text)}”</p>
                  <p class="testimonial-card__author">${escapeHtml(author)}</p>
                </div>
              </article>
            `;
                  })
                  .join('')
              : `<p class="testimonial-card testimonial-card--empty">${copy.empty}</p>`
          }
        </div>
      </div>
    `;
  };

  const init = async () => {
    const container = document.getElementById('testimonials');
    if (!container) {
      return;
    }

    const lang = getLang();
    try {
      const response = await fetch('/data/testimonials.json?v=20260919-reviews-dedup', {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Testimonials request failed with ${response.status}`);
      }
      const items = await response.json();
      renderTestimonials(container, Array.isArray(items) ? items : [], lang);
    } catch {
      renderTestimonials(container, [], lang);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    void init();
  }
})();
