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
      beforeAlt: options.beforeAlt || options.beforeLabel || 'Before grooming',
      afterAlt: options.afterAlt || options.afterLabel || 'After grooming',
      sliderLabel: options.sliderLabel || 'Before and after comparison',
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
          alt="${escapeHtml(this.options.beforeAlt)}"
          class="before-after-image before-after-before"
          loading="${imageLoading}"
          decoding="async"
        >
        <img
          src="${escapeHtml(this.options.afterImage)}"
          alt="${escapeHtml(this.options.afterAlt)}"
          class="before-after-image before-after-after"
          loading="${imageLoading}"
          decoding="async"
        >
        <div class="before-after-slider" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="50" aria-label="${escapeHtml(this.options.sliderLabel)}"></div>
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

    this.slider.addEventListener(
      'keydown',
      event => {
        const positions = {
          ArrowLeft: this.sliderPosition - 5,
          ArrowDown: this.sliderPosition - 5,
          ArrowRight: this.sliderPosition + 5,
          ArrowUp: this.sliderPosition + 5,
          Home: 0,
          End: 100,
        };
        if (!Object.hasOwn(positions, event.key)) return;
        event.preventDefault();
        this.updateSliderPosition(positions[event.key]);
      },
      { signal }
    );

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
    const nextPosition = Math.max(0, Math.min(100, Number(percentage) || 0));
    this.sliderPosition = nextPosition;
    this.slider.style.left = `${nextPosition}%`;
    this.slider.setAttribute('aria-valuenow', String(Math.round(nextPosition)));
    this.afterImage.style.clipPath = `inset(0 ${100 - nextPosition}% 0 0)`;
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
        all: 'Gesamte Mediathek',
        dogs: 'Hunde',
        cats: 'Katzen',
        salon: 'Salon',
      },
      en: {
        all: 'Full Media Library',
        dogs: 'Dogs',
        cats: 'Cats',
        salon: 'Salon',
      },
      ru: {
        all: 'ВСЯ МЕДИАТЕКА',
        dogs: 'СОБАКИ',
        cats: 'КОШКИ',
        salon: 'САЛОН',
      },
      uk: {
        all: 'ВСЯ МЕДІАТЕКА',
        dogs: 'СОБАКИ',
        cats: 'КОТИ',
        salon: 'САЛОН',
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
      { key: 'dogs', label: labels.dogs },
      { key: 'cats', label: labels.cats },
      { key: 'salon', label: labels.salon },
      { key: 'all', label: labels.all },
    ];
    const filterHTML = `
      <div class="before-after-filters nav-main" role="tablist" aria-label="Media filters">
        ${filterOrder
          .map(({ key, label }) => {
            const isActive = key === 'all';
            return `<button type="button" class="filter-btn${isActive ? ' active' : ''}" role="tab" data-filter="${key}" aria-selected="${isActive}"${isActive ? ' aria-current="true"' : ''}>${escapeHtml(label)}</button>`;
          })
          .join('\n        ')}
      </div>
    `;

    this.container.insertAdjacentHTML('beforebegin', filterHTML);

    const filtersRoot = this.container.previousElementSibling;
    const filterButtons = filtersRoot.querySelectorAll('.filter-btn');
    window.HundesalonNavPill?.scan?.(filtersRoot);

    filterButtons.forEach(btn => {
      if (btn.classList.contains('active')) {
        window.HundesalonNavPill?.activate?.(btn);
      }

      btn.addEventListener('click', () => {
        if (btn.classList.contains('active')) return;

        filterButtons.forEach(button => {
          button.classList.remove('active');
          button.setAttribute('aria-selected', 'false');
          button.removeAttribute('aria-current');
          window.HundesalonNavPill?.deactivate?.(button);
        });

        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
        btn.setAttribute('aria-current', 'true');
        window.HundesalonNavPill?.activate?.(btn);
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
             data-before-alt="${escapeHtml(item.beforeAlt)}" data-after-alt="${escapeHtml(item.afterAlt)}"
             data-slider-label="${escapeHtml(item.sliderLabel)}"
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
        beforeAlt: container.dataset.beforeAlt,
        afterAlt: container.dataset.afterAlt,
        sliderLabel: container.dataset.sliderLabel,
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
const galleryBeforeImage = index => `${GALLERY_IMAGE_BASE}${beforeAfterCardFolder(index)}/before.jpg`;
const galleryAfterImage = index => `${GALLERY_IMAGE_BASE}${beforeAfterCardFolder(index)}/after.jpg`;

const beforeAfterLabelsByLang = {
  de: { before: 'VORHER', after: 'NACHHER', comparison: 'Vorher-Nachher-Vergleich' },
  en: { before: 'BEFORE', after: 'AFTER', comparison: 'Before and after comparison' },
  ru: { before: 'ДО', after: 'ПОСЛЕ', comparison: 'Сравнение до и после' },
  uk: { before: 'ДО', after: 'ПІСЛЯ', comparison: 'Порівняння до і після' },
};

const categoryBadgeByLang = {
  de: { dogs: 'Hunde', cats: 'Katzen', salon: 'Salon' },
  en: { dogs: 'Dogs', cats: 'Cats', salon: 'Salon' },
  ru: { dogs: 'СОБАКИ', cats: 'КОШКИ', salon: 'САЛОН' },
  uk: { dogs: 'СОБАКИ', cats: 'КОТИ', salon: 'САЛОН' },
};

const cardCategories = ['dogs', 'dogs', 'dogs', 'salon', 'salon', 'salon', 'cats', 'cats', 'cats'];

const galleryCardTitle = (lang, index) => {
  const copy = {
    de: `Transformation ${index}`,
    en: `Transformation ${index}`,
    ru: `Преображение ${index}`,
    uk: `Перетворення ${index}`,
  };
  return copy[lang] || copy.de;
};

const galleryCardDescription = lang => {
  const copy = {
    de: 'Sichtbarer Vergleich vor und nach der Pflege.',
    en: 'A visible comparison before and after grooming.',
    ru: 'Наглядное сравнение до и после ухода.',
    uk: 'Наочне порівняння до і після догляду.',
  };
  return copy[lang] || copy.de;
};

const beforeAfterCardBlueprints = Array.from({ length: GALLERY_CARD_COUNT }, (_, offset) => {
  const gallery = offset + 1;
  const category = cardCategories[offset] || 'dogs';

  return { gallery, category };
});

const buildBeforeAfterItems = lang => {
  const labels = beforeAfterLabelsByLang[lang] || beforeAfterLabelsByLang.de;

  return beforeAfterCardBlueprints.map(card => {
    const title = galleryCardTitle(lang, card.gallery);
    return {
      beforeImage: galleryBeforeImage(card.gallery),
      afterImage: galleryAfterImage(card.gallery),
      beforeLabel: labels.before,
      afterLabel: labels.after,
      beforeAlt: `${title} — ${labels.before}`,
      afterAlt: `${title} — ${labels.after}`,
      sliderLabel: labels.comparison,
      badge: categoryBadgeByLang[lang]?.[card.category] || categoryBadgeByLang.de[card.category],
      category: card.category,
      title,
      description: galleryCardDescription(lang),
    };
  });
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
      de: { all: 'Gesamte Mediathek', dogs: 'Hunde', cats: 'Katzen', salon: 'Salon' },
      en: { all: 'Full Media Library', dogs: 'Dogs', cats: 'Cats', salon: 'Salon' },
      ru: { all: 'ВСЯ МЕДИАТЕКА', dogs: 'СОБАКИ', cats: 'КОШКИ', salon: 'САЛОН' },
      uk: { all: 'ВСЯ МЕДІАТЕКА', dogs: 'СОБАКИ', cats: 'КОТИ', salon: 'САЛОН' },
    },
  });

  galleryContainer.closest('.reveal')?.classList.add('active');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBeforeAfterGallery);
} else {
  initBeforeAfterGallery();
}
