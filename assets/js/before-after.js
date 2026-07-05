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
      ...options,
    };

    this.isDragging = false;
    this.sliderPosition = 50;
    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="before-after-wrapper">
        <img
          src="${escapeHtml(this.options.beforeImage)}"
          alt="Before"
          class="before-after-image before-after-before"
          loading="lazy"
        >
        <img
          src="${escapeHtml(this.options.afterImage)}"
          alt="After"
          class="before-after-image before-after-after"
          loading="lazy"
        >
        <div class="before-after-slider"></div>
        <div class="before-after-label before-after-label-before">${escapeHtml(this.options.beforeLabel)}</div>
        <div class="before-after-label before-after-label-after">${escapeHtml(this.options.afterLabel)}</div>
        ${this.options.badge ? `<div class="before-after-badge">${escapeHtml(this.options.badge)}</div>` : ''}
      </div>
    `;

    this.slider = this.container.querySelector('.before-after-slider');
    this.afterImage = this.container.querySelector('.before-after-after');
    this.setupEvents();
  }

  setupEvents() {
    // Mouse events
    this.slider.addEventListener('mousedown', e => this.startDrag(e));
    document.addEventListener('mousemove', e => this.drag(e));
    document.addEventListener('mouseup', () => this.stopDrag());

    // Touch events
    this.slider.addEventListener('touchstart', e => this.startDrag(e), { passive: false });
    document.addEventListener('touchmove', e => this.drag(e), { passive: false });
    document.addEventListener('touchend', () => this.stopDrag());

    // Click to jump
    this.container.addEventListener('click', e => {
      if (!this.isDragging) {
        const rect = this.container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        this.updateSliderPosition((x / rect.width) * 100);
      }
    });
  }

  startDrag(e) {
    e.preventDefault();
    this.isDragging = true;
    this.container.style.cursor = 'grabbing';
  }

  drag(e) {
    if (!this.isDragging) return;

    e.preventDefault();
    const rect = this.container.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = clientX - rect.left;
    const percentage = (x / rect.width) * 100;

    this.updateSliderPosition(Math.max(0, Math.min(100, percentage)));
  }

  stopDrag() {
    this.isDragging = false;
    this.container.style.cursor = '';
  }

  updateSliderPosition(percentage) {
    this.sliderPosition = percentage;
    this.slider.style.left = `${percentage}%`;
    this.afterImage.style.clipPath = `inset(0 ${100 - percentage}% 0 0)`;
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
    const filterHTML = `
      <div class="before-after-filters">
        <button class="filter-btn active" data-filter="all">${escapeHtml(labels.all)}</button>
        <button class="filter-btn" data-filter="haircut">${escapeHtml(labels.haircut)}</button>
        <button class="filter-btn" data-filter="creative">${escapeHtml(labels.creative)}</button>
        <button class="filter-btn" data-filter="cats">${escapeHtml(labels.cats)}</button>
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

  initSliders() {
    const sliderContainers = this.container.querySelectorAll('.before-after-container');
    sliderContainers.forEach(container => {
      new BeforeAfterSlider(container, {
        beforeImage: container.dataset.before,
        afterImage: container.dataset.after,
        beforeLabel: container.dataset.beforeLabel,
        afterLabel: container.dataset.afterLabel,
        badge: container.dataset.badge,
      });
    });
  }
}

const BEFORE_AFTER_IMAGE_BASE = '../assets/images/before-after/';
const beforeAfterImage = fileName => `${BEFORE_AFTER_IMAGE_BASE}${fileName}`;

// Before/after data built from real local TikTok work samples.
const beforeAfterItems = {
  de: [
    {
      beforeImage: beforeAfterImage('tiktok-new-mikemozg-slide-prev1.jpeg'),
      afterImage: beforeAfterImage('tiktok-new-mikemozg-slide-afterright1.jpeg'),
      beforeLabel: 'VORHER',
      afterLabel: 'NACHHER',
      badge: 'Schnitt',
      category: 'haircut',
      title: 'Saubere Salon-Transformation',
      description: 'Fellpflege, Kontur und gepflegtes Finish',
    },
    {
      beforeImage: beforeAfterImage('tiktok-new-mikemozg-slide-prev2.jpeg'),
      afterImage: beforeAfterImage('tiktok-new-mikemozg-slide-afterright2.jpeg'),
      beforeLabel: 'VORHER',
      afterLabel: 'NACHHER',
      badge: 'Kreativ',
      category: 'creative',
      title: 'Ausdrucksstarker Pflege-Look',
      description: 'Weiche Linien, klare Silhouette, goldener Salon-Glow',
    },
    {
      beforeImage: beforeAfterImage('tiktok-new-mikemozg-slide-prev3.jpeg'),
      afterImage: beforeAfterImage('tiktok-new-mikemozg-slide-prev3b.jpeg'),
      beforeLabel: 'VORHER',
      afterLabel: 'NACHHER',
      badge: 'Katze',
      category: 'cats',
      title: 'Sanfte Pflege fuer sensible Tiere',
      description: 'Ruhige Atmosphaere, geduldige Handgriffe, liebevolle Behandlung',
    },
    {
      beforeImage: beforeAfterImage('tiktok-new-mikemozg-slide-prev4.jpeg'),
      afterImage: beforeAfterImage('tiktok-new-mikemozg-slide1.jpeg'),
      beforeLabel: 'VORHER',
      afterLabel: 'NACHHER',
      badge: 'Schnitt',
      category: 'haircut',
      title: 'Frischer Pflegeabschluss',
      description: 'Baden, Buersten, Trimmen und ein weicher Salon-Look',
    },
    {
      beforeImage: beforeAfterImage('tiktok-home-check.jpeg'),
      afterImage: beforeAfterImage('tiktok-new-ksafaraliev-slide1.jpeg'),
      beforeLabel: 'VORHER',
      afterLabel: 'NACHHER',
      badge: 'Kreativ',
      category: 'creative',
      title: 'Social-ready Salonmoment',
      description: 'Ein gepflegter Look mit warmer Praesenz fuer Foto und Video',
    },
  ],
  en: [
    {
      beforeImage: beforeAfterImage('tiktok-new-mikemozg-slide-prev1.jpeg'),
      afterImage: beforeAfterImage('tiktok-new-mikemozg-slide-afterright1.jpeg'),
      beforeLabel: 'BEFORE',
      afterLabel: 'AFTER',
      badge: 'Haircut',
      category: 'haircut',
      title: 'Clean Salon Transformation',
      description: 'Coat care, contour shaping and a polished finish',
    },
    {
      beforeImage: beforeAfterImage('tiktok-new-mikemozg-slide-prev2.jpeg'),
      afterImage: beforeAfterImage('tiktok-new-mikemozg-slide-afterright2.jpeg'),
      beforeLabel: 'BEFORE',
      afterLabel: 'AFTER',
      badge: 'Creative',
      category: 'creative',
      title: 'Expressive Grooming Look',
      description: 'Soft lines, clear silhouette and a warm salon glow',
    },
    {
      beforeImage: beforeAfterImage('tiktok-new-mikemozg-slide-prev3.jpeg'),
      afterImage: beforeAfterImage('tiktok-new-mikemozg-slide-prev3b.jpeg'),
      beforeLabel: 'BEFORE',
      afterLabel: 'AFTER',
      badge: 'Cat',
      category: 'cats',
      title: 'Gentle Care for Sensitive Pets',
      description: 'Calm atmosphere, patient handling and loving care',
    },
    {
      beforeImage: beforeAfterImage('tiktok-new-mikemozg-slide-prev4.jpeg'),
      afterImage: beforeAfterImage('tiktok-new-mikemozg-slide1.jpeg'),
      beforeLabel: 'BEFORE',
      afterLabel: 'AFTER',
      badge: 'Haircut',
      category: 'haircut',
      title: 'Fresh Grooming Finish',
      description: 'Bathing, brushing, trimming and a soft salon look',
    },
    {
      beforeImage: beforeAfterImage('tiktok-home-check.jpeg'),
      afterImage: beforeAfterImage('tiktok-new-ksafaraliev-slide1.jpeg'),
      beforeLabel: 'BEFORE',
      afterLabel: 'AFTER',
      badge: 'Creative',
      category: 'creative',
      title: 'Social-ready Salon Moment',
      description: 'A polished look with warm presence for photo and video',
    },
  ],
  ru: [
    {
      beforeImage: beforeAfterImage('tiktok-new-mikemozg-slide-prev1.jpeg'),
      afterImage: beforeAfterImage('tiktok-new-mikemozg-slide-afterright1.jpeg'),
      beforeLabel: 'ДО',
      afterLabel: 'ПОСЛЕ',
      badge: 'Стрижка',
      category: 'haircut',
      title: 'Аккуратная салонная трансформация',
      description: 'Уход за шерстью, чистый контур и ухоженный финиш',
    },
    {
      beforeImage: beforeAfterImage('tiktok-new-mikemozg-slide-prev2.jpeg'),
      afterImage: beforeAfterImage('tiktok-new-mikemozg-slide-afterright2.jpeg'),
      beforeLabel: 'ДО',
      afterLabel: 'ПОСЛЕ',
      badge: 'Креатив',
      category: 'creative',
      title: 'Выразительный образ после груминга',
      description: 'Мягкие линии, чистый силуэт и теплое салонное сияние',
    },
    {
      beforeImage: beforeAfterImage('tiktok-new-mikemozg-slide-prev3.jpeg'),
      afterImage: beforeAfterImage('tiktok-new-mikemozg-slide-prev3b.jpeg'),
      beforeLabel: 'ДО',
      afterLabel: 'ПОСЛЕ',
      badge: 'Кошка',
      category: 'cats',
      title: 'Бережный груминг кошек',
      description: 'Спокойная обстановка, терпеливые руки и заботливый уход',
    },
    {
      beforeImage: beforeAfterImage('tiktok-new-mikemozg-slide-prev4.jpeg'),
      afterImage: beforeAfterImage('tiktok-new-mikemozg-slide1.jpeg'),
      beforeLabel: 'ДО',
      afterLabel: 'ПОСЛЕ',
      badge: 'Стрижка',
      category: 'haircut',
      title: 'Свежий результат после ухода',
      description: 'Купание, вычесывание, тримминг и мягкий салонный вид',
    },
    {
      beforeImage: beforeAfterImage('tiktok-home-check.jpeg'),
      afterImage: beforeAfterImage('tiktok-new-ksafaraliev-slide1.jpeg'),
      beforeLabel: 'ДО',
      afterLabel: 'ПОСЛЕ',
      badge: 'Креатив',
      category: 'creative',
      title: 'Салонный момент для соцсетей',
      description: 'Ухоженный образ с теплым светом для фото и видео',
    },
  ],
  uk: [
    {
      beforeImage: beforeAfterImage('tiktok-new-mikemozg-slide-prev1.jpeg'),
      afterImage: beforeAfterImage('tiktok-new-mikemozg-slide-afterright1.jpeg'),
      beforeLabel: 'ДО',
      afterLabel: 'ПІСЛЯ',
      badge: 'Стрижка',
      category: 'haircut',
      title: 'Охайна салонна трансформація',
      description: 'Догляд за шерстю, чистий контур і доглянутий фініш',
    },
    {
      beforeImage: beforeAfterImage('tiktok-new-mikemozg-slide-prev2.jpeg'),
      afterImage: beforeAfterImage('tiktok-new-mikemozg-slide-afterright2.jpeg'),
      beforeLabel: 'ДО',
      afterLabel: 'ПІСЛЯ',
      badge: 'Креатив',
      category: 'creative',
      title: 'Виразний образ після грумінгу',
      description: "М'які лінії, чистий силует і тепле салонне сяйво",
    },
    {
      beforeImage: beforeAfterImage('tiktok-new-mikemozg-slide-prev3.jpeg'),
      afterImage: beforeAfterImage('tiktok-new-mikemozg-slide-prev3b.jpeg'),
      beforeLabel: 'ДО',
      afterLabel: 'ПІСЛЯ',
      badge: 'Кіт',
      category: 'cats',
      title: 'Дбайливий грумінг котів',
      description: 'Спокійна атмосфера, терплячі руки й турботливий догляд',
    },
    {
      beforeImage: beforeAfterImage('tiktok-new-mikemozg-slide-prev4.jpeg'),
      afterImage: beforeAfterImage('tiktok-new-mikemozg-slide1.jpeg'),
      beforeLabel: 'ДО',
      afterLabel: 'ПІСЛЯ',
      badge: 'Стрижка',
      category: 'haircut',
      title: 'Свіжий результат після догляду',
      description: "Купання, вичісування, тримінг і м'який салонний вигляд",
    },
    {
      beforeImage: beforeAfterImage('tiktok-home-check.jpeg'),
      afterImage: beforeAfterImage('tiktok-new-ksafaraliev-slide1.jpeg'),
      beforeLabel: 'ДО',
      afterLabel: 'ПІСЛЯ',
      badge: 'Креатив',
      category: 'creative',
      title: 'Салонний момент для соцмереж',
      description: 'Доглянутий образ із теплим світлом для фото й відео',
    },
  ],
};

// Initialize gallery when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const galleryContainer = document.getElementById('before-after-gallery');
  if (galleryContainer) {
    // Detect current language from URL
    const lang = window.location.pathname.split('/')[1] || 'de';
    const items = beforeAfterItems[lang] || beforeAfterItems.de;

    new BeforeAfterGallery(galleryContainer, items, {
      lang: lang,
      filterLabels: {
        de: { all: 'Alle', haircut: 'Schnitte', creative: 'Kreativ', cats: 'Katzen' },
        en: { all: 'All', haircut: 'Haircuts', creative: 'Creative', cats: 'Cats' },
        ru: { all: 'Все', haircut: 'Стрижки', creative: 'Креатив', cats: 'Кошки' },
        uk: { all: 'Всі', haircut: 'Стрижки', creative: 'Креатив', cats: 'Коти' },
      },
    });
  }
});
