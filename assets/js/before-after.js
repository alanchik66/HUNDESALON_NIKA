/*
 * ================================================================
 * BEFORE/AFTER SLIDER COMPONENT
 * ================================================================
 * Interactive before/after image comparison slider with touch support
 * Premium glassmorphism design for HUNDESALON_NIKA
 *
 * Features:
 * - Touch/mouse drag support
 * - Responsive design
 * - Filter functionality
 * - Multi-language support
 * - Smooth animations
 * ================================================================
 */

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

class BeforeAfterSlider {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      beforeImage: options.beforeImage || '',
      afterImage: options.afterImage || '',
      beforeLabel: options.beforeLabel || 'BEFORE',
      afterLabel: options.afterLabel || 'AFTER',
      badge: options.badge || '',
      eagerImages: Boolean(options.eagerImages),
      ...options,
    };

    this.isDragging = false;
    this.dragDidOccur = false;
    this.sliderPosition = 50;
    this.abortController = new window.AbortController();
    this.init();
  }

  init() {
    const imageLoading = this.options.eagerImages ? 'eager' : 'lazy';

    this.container.innerHTML = `
      <div class="before-after-wrapper">
        <img
          src="${escapeHtml(this.options.beforeImage)}"
          alt="Before"
          class="before-after-image before-after-before"
          loading="${imageLoading}"
          decoding="async"
        >
        <img
          src="${escapeHtml(this.options.afterImage)}"
          alt="After"
          class="before-after-image before-after-after"
          loading="${imageLoading}"
          decoding="async"
        >
        <div class="before-after-slider" role="slider" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" aria-label="Before and after comparison"></div>
        <div class="before-after-label before-after-label-before">${escapeHtml(this.options.beforeLabel)}</div>
        <div class="before-after-label before-after-label-after">${escapeHtml(this.options.afterLabel)}</div>
        ${this.options.badge ? `<div class="before-after-badge">${escapeHtml(this.options.badge)}</div>` : ''}
      </div>
    `;

    this.wrapper = this.container.querySelector('.before-after-wrapper');
    this.slider = this.container.querySelector('.before-after-slider');
    this.afterImage = this.container.querySelector('.before-after-after');
    this.setupEvents();
    this.updateSliderPosition(this.sliderPosition);
  }

  setupEvents() {
    const { signal } = this.abortController;
    const dragTargets = [this.wrapper, this.slider];

    dragTargets.forEach(target => {
      target.addEventListener('pointerdown', e => this.startDrag(e), { signal });
    });

    window.addEventListener('pointermove', e => this.drag(e), { signal });
    window.addEventListener('pointerup', e => this.stopDrag(e), { signal });
    window.addEventListener('pointercancel', e => this.stopDrag(e), { signal });

    this.wrapper.addEventListener(
      'click',
      e => {
        if (this.dragDidOccur) {
          this.dragDidOccur = false;
          return;
        }

        const rect = this.container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        this.updateSliderPosition((x / rect.width) * 100);
      },
      { signal }
    );
  }

  startDrag(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    e.preventDefault();
    this.isDragging = true;
    this.dragDidOccur = false;
    this.wrapper.setPointerCapture?.(e.pointerId);
    this.wrapper.classList.add('is-dragging');
  }

  drag(e) {
    if (!this.isDragging) return;

    e.preventDefault();
    this.dragDidOccur = true;

    const rect = this.container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;

    this.updateSliderPosition(Math.max(0, Math.min(100, percentage)));
  }

  stopDrag(e) {
    if (!this.isDragging) return;

    this.isDragging = false;
    this.wrapper.classList.remove('is-dragging');

    if (e?.pointerId != null) {
      try {
        this.wrapper.releasePointerCapture?.(e.pointerId);
      } catch {
        // Pointer may already be released when the card re-renders.
      }
    }
  }

  updateSliderPosition(percentage) {
    this.sliderPosition = percentage;
    this.slider.style.left = `${percentage}%`;
    this.slider.setAttribute('aria-valuenow', String(Math.round(percentage)));
    this.afterImage.style.clipPath = `inset(0 ${100 - percentage}% 0 0)`;
  }

  destroy() {
    this.abortController.abort();
    this.container.innerHTML = '';
  }
}

// Gallery with before/after items
class BeforeAfterGallery {
  constructor(container, items, options = {}) {
    this.container = container;
    this.items = items;
    this.options = {
      lang: options.lang || 'de',
      filterLabels: options.filterLabels || this.getDefaultFilterLabels(),
      ...options,
    };

    this.currentFilter = 'all';
    this.sliders = [];
    this.init();
  }

  getDefaultFilterLabels() {
    return {
      de: {
        all: 'Alle',
        haircut: 'Schnitte',
        creative: 'Kreativ',
        cats: 'Katzen',
      },
      en: {
        all: 'All',
        haircut: 'Haircuts',
        creative: 'Creative',
        cats: 'Cats',
      },
      ru: {
        all: 'Все',
        haircut: 'Стрижки',
        creative: 'Креатив',
        cats: 'Кошки',
      },
      uk: {
        all: 'Всі',
        haircut: 'Стрижки',
        creative: 'Креатив',
        cats: 'Коти',
      },
    };
  }

  init() {
    this.renderFilters();
    this.renderGallery();
    this.initSliders();
  }

  renderFilters() {
    const labels = this.options.filterLabels[this.options.lang] || this.options.filterLabels.de;
    const filterOrder = [
      { key: 'haircut', label: labels.haircut },
      { key: 'creative', label: labels.creative },
      { key: 'cats', label: labels.cats },
      { key: 'all', label: labels.all },
    ];
    const filterHTML = `
      <div class="before-after-filters">
        ${filterOrder
          .map(
            ({ key, label }) =>
              `<button class="filter-btn${key === 'all' ? ' active' : ''}" data-filter="${key}">${escapeHtml(label)}</button>`
          )
          .join('\n        ')}
      </div>
    `;

    this.container.insertAdjacentHTML('beforebegin', filterHTML);

    // Add filter functionality
    const filterButtons = this.container.previousElementSibling.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.renderGallery();
        this.initSliders();
      });
    });
  }

  renderGallery() {
    const filteredItems =
      this.currentFilter === 'all' ? this.items : this.items.filter(item => item.category === this.currentFilter);

    this.container.innerHTML = filteredItems
      .map(
        item => `
      <div class="before-after-card" data-category="${escapeHtml(item.category)}">
        <div class="before-after-container" data-before="${escapeHtml(item.beforeImage)}" data-after="${escapeHtml(item.afterImage)}"
             data-before-label="${escapeHtml(item.beforeLabel)}" data-after-label="${escapeHtml(item.afterLabel)}"
             data-badge="${escapeHtml(item.badge || '')}">
        </div>
        <div class="before-after-card-info">
          <h4 class="before-after-card-title">${escapeHtml(item.title)}</h4>
          <p class="before-after-card-description">${escapeHtml(item.description)}</p>
        </div>
      </div>
    `
      )
      .join('');
  }

  destroySliders() {
    this.sliders.forEach(slider => slider.destroy());
    this.sliders = [];
  }

  initSliders() {
    this.destroySliders();

    const sliderContainers = this.container.querySelectorAll('.before-after-container');
    sliderContainers.forEach((container, index) => {
      const slider = new BeforeAfterSlider(container, {
        beforeImage: container.dataset.before,
        afterImage: container.dataset.after,
        beforeLabel: container.dataset.beforeLabel,
        afterLabel: container.dataset.afterLabel,
        badge: container.dataset.badge,
        eagerImages: index < 3,
      });
      this.sliders.push(slider);
    });
  }
}

const GALLERY_IMAGE_BASE = '../assets/images/before-after/';
const GALLERY_CARD_COUNT = 9;
const beforeAfterCardFolder = index => `card-${String(index).padStart(2, '0')}`;
const galleryBeforeImage = index => `${GALLERY_IMAGE_BASE}${beforeAfterCardFolder(index)}/gallery-before-${index}.jpg`;
const galleryAfterImage = index => `${GALLERY_IMAGE_BASE}${beforeAfterCardFolder(index)}/gallery-after-${index}.jpg`;

const beforeAfterLabelsByLang = {
  de: { before: 'VORHER', after: 'NACHHER' },
  en: { before: 'BEFORE', after: 'AFTER' },
  ru: { before: 'ДО', after: 'ПОСЛЕ' },
  uk: { before: 'ДО', after: 'ПІСЛЯ' },
};

const badgeByCategory = {
  haircut: { de: 'Schnitt', en: 'Haircut', ru: 'Стрижка', uk: 'Стрижка' },
  creative: { de: 'Kreativ', en: 'Creative', ru: 'Креатив', uk: 'Креатив' },
  cats: { de: 'Katze', en: 'Cat', ru: 'Кошки', uk: 'Коти' },
};

const cardCategories = [
  'haircut',
  'haircut',
  'haircut',
  'creative',
  'creative',
  'creative',
  'cats',
  'cats',
  'cats',
];

const galleryCardTitle = (lang, index) => {
  const copy = {
    de: `Transformation ${index}`,
    en: `Transformation ${index}`,
    ru: `Преображение ${index}`,
    uk: `Перетворення ${index}`,
  };
  return copy[lang] || copy.de;
};

const galleryCardDescription = (lang, index) => {
  const folder = beforeAfterCardFolder(index);
  const copy = {
    de: `Vorher/Nachher — ${folder}/gallery-before-${index}.jpg`,
    en: `Before/after — ${folder}/gallery-before-${index}.jpg`,
    ru: `До и после — ${folder}/gallery-before-${index}.jpg`,
    uk: `До і після — ${folder}/gallery-before-${index}.jpg`,
  };
  return copy[lang] || copy.de;
};

const beforeAfterCardBlueprints = Array.from({ length: GALLERY_CARD_COUNT }, (_, offset) => {
  const gallery = offset + 1;
  const category = cardCategories[offset] || 'haircut';

  return { gallery, category };
});

const buildBeforeAfterItems = lang => {
  const labels = beforeAfterLabelsByLang[lang] || beforeAfterLabelsByLang.de;

  return beforeAfterCardBlueprints.map(card => ({
    beforeImage: galleryBeforeImage(card.gallery),
    afterImage: galleryAfterImage(card.gallery),
    beforeLabel: labels.before,
    afterLabel: labels.after,
    badge: badgeByCategory[card.category]?.[lang] || badgeByCategory.haircut.de,
    category: card.category,
    title: galleryCardTitle(lang, card.gallery),
    description: galleryCardDescription(lang, card.gallery),
  }));
};

const beforeAfterItems = {
  de: buildBeforeAfterItems('de'),
  en: buildBeforeAfterItems('en'),
  ru: buildBeforeAfterItems('ru'),
  uk: buildBeforeAfterItems('uk'),
};

function isBeforeAfterPage() {
  if (document.getElementById('before-after-gallery')) {
    return true;
  }

  const normalizedPath = window.location.pathname.replace(/\/$/, '').toLowerCase();
  return /\/do-i-posle(?:\.html)?$/i.test(normalizedPath);
}

function initBeforeAfterGallery() {
  if (!isBeforeAfterPage()) {
    return;
  }

  const galleryContainer = document.getElementById('before-after-gallery');
  if (!galleryContainer || galleryContainer.dataset.beforeAfterReady === '1') {
    return;
  }

  galleryContainer.dataset.beforeAfterReady = '1';

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const lang = pathParts.find(part => Object.prototype.hasOwnProperty.call(beforeAfterItems, part)) || 'de';
  const items = beforeAfterItems[lang] || beforeAfterItems.de;

  new BeforeAfterGallery(galleryContainer, items, {
    lang,
    filterLabels: {
      de: { all: 'Alle', haircut: 'Schnitte', creative: 'Kreativ', cats: 'Katzen' },
      en: { all: 'All', haircut: 'Haircuts', creative: 'Creative', cats: 'Cats' },
      ru: { all: 'Все', haircut: 'Стрижки', creative: 'Креатив', cats: 'Кошки' },
      uk: { all: 'Всі', haircut: 'Стрижки', creative: 'Креатив', cats: 'Коти' },
    },
  });

  galleryContainer.closest('.reveal')?.classList.add('active');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBeforeAfterGallery);
} else {
  initBeforeAfterGallery();
}
