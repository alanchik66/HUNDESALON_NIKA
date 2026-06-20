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

class BeforeAfterSlider {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      beforeImage: options.beforeImage || '',
      afterImage: options.afterImage || '',
      beforeLabel: options.beforeLabel || 'BEFORE',
      afterLabel: options.afterLabel || 'AFTER',
      badge: options.badge || '',
      ...options
    };

    this.isDragging = false;
    this.sliderPosition = 50;
    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="before-after-wrapper">
        <img
          src="${this.options.beforeImage}"
          alt="Before"
          class="before-after-image before-after-before"
          loading="lazy"
        >
        <img
          src="${this.options.afterImage}"
          alt="After"
          class="before-after-image before-after-after"
          loading="lazy"
        >
        <div class="before-after-slider"></div>
        <div class="before-after-label before-after-label-before">${this.options.beforeLabel}</div>
        <div class="before-after-label before-after-label-after">${this.options.afterLabel}</div>
        ${this.options.badge ? `<div class="before-after-badge">${this.options.badge}</div>` : ''}
      </div>
    `;

    this.slider = this.container.querySelector('.before-after-slider');
    this.afterImage = this.container.querySelector('.before-after-after');
    this.setupEvents();
  }

  setupEvents() {
    // Mouse events
    this.slider.addEventListener('mousedown', (e) => this.startDrag(e));
    document.addEventListener('mousemove', (e) => this.drag(e));
    document.addEventListener('mouseup', () => this.stopDrag());

    // Touch events
    this.slider.addEventListener('touchstart', (e) => this.startDrag(e), { passive: false });
    document.addEventListener('touchmove', (e) => this.drag(e), { passive: false });
    document.addEventListener('touchend', () => this.stopDrag());

    // Click to jump
    this.container.addEventListener('click', (e) => {
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
      ...options
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
        cats: 'Katzen'
      },
      en: {
        all: 'All',
        haircut: 'Haircuts',
        creative: 'Creative',
        cats: 'Cats'
      },
      ru: {
        all: 'Все',
        haircut: 'Стрижки',
        creative: 'Креатив',
        cats: 'Кошки'
      },
      uk: {
        all: 'Всі',
        haircut: 'Стрижки',
        creative: 'Креатив',
        cats: 'Коти'
      }
    };
  }

  init() {
    this.renderFilters();
    this.renderGallery();
    this.initSliders();
  }

  renderFilters() {
    const filterHTML = `
      <div class="before-after-filters">
        <button class="filter-btn active" data-filter="all">${this.options.filterLabels[this.options.lang].all}</button>
        <button class="filter-btn" data-filter="haircut">${this.options.filterLabels[this.options.lang].haircut}</button>
        <button class="filter-btn" data-filter="creative">${this.options.filterLabels[this.options.lang].creative}</button>
        <button class="filter-btn" data-filter="cats">${this.options.filterLabels[this.options.lang].cats}</button>
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
    const filteredItems = this.currentFilter === 'all'
      ? this.items
      : this.items.filter(item => item.category === this.currentFilter);

    this.container.innerHTML = filteredItems.map(item => `
      <div class="before-after-card" data-category="${item.category}">
        <div class="before-after-container" data-before="${item.beforeImage}" data-after="${item.afterImage}"
             data-before-label="${item.beforeLabel}" data-after-label="${item.afterLabel}"
             data-badge="${item.badge || ''}">
        </div>
        <div class="before-after-card-info">
          <h4 class="before-after-card-title">${item.title}</h4>
          <p class="before-after-card-description">${item.description}</p>
        </div>
      </div>
    `).join('');
  }

  initSliders() {
    const sliderContainers = this.container.querySelectorAll('.before-after-container');
    sliderContainers.forEach(container => {
      new BeforeAfterSlider(container, {
        beforeImage: container.dataset.before,
        afterImage: container.dataset.after,
        beforeLabel: container.dataset.beforeLabel,
        afterLabel: container.dataset.afterLabel,
        badge: container.dataset.badge
      });
    });
  }
}

// Sample before/after data (placeholder images - replace with real work samples)
const beforeAfterItems = {
  de: [
    {
      beforeImage: '../assets/images/gallery1.jpg',
      afterImage: '../assets/images/gallery2.jpg',
      beforeLabel: 'VORHER',
      afterLabel: 'NACHHER',
      badge: 'Schnitt',
      category: 'haircut',
      title: 'Pudel-Lady elegante Transformation',
      description: 'Komplette Pflege mit Modell-Schnitt'
    },
    {
      beforeImage: '../assets/images/gallery3.jpg',
      afterImage: '../assets/images/gallery4.jpg',
      beforeLabel: 'VORHER',
      afterLabel: 'NACHHER',
      badge: 'Kreativ',
      category: 'creative',
      title: 'Kreative Fellfärbung',
      description: 'Sichere Farben, kreatives Design'
    },
    {
      beforeImage: '../assets/images/gallery5.jpg',
      afterImage: '../assets/images/gallery6.jpg',
      beforeLabel: 'VORHER',
      afterLabel: 'NACHHER',
      badge: 'Katze',
      category: 'cats',
      title: 'Sanfte Katzenpflege',
      description: 'Stressfreie Umgebung, liebevolle Behandlung'
    },
    {
      beforeImage: '../assets/images/gallery1.jpg',
      afterImage: '../assets/images/gallery3.jpg',
      beforeLabel: 'VORHER',
      afterLabel: 'NACHHER',
      badge: 'Schnitt',
      category: 'haircut',
      title: 'Golden Retriever Pflege',
      description: 'Baden, Bürsten, Trimmen'
    }
  ],
  en: [
    {
      beforeImage: '../assets/images/gallery1.jpg',
      afterImage: '../assets/images/gallery2.jpg',
      beforeLabel: 'BEFORE',
      afterLabel: 'AFTER',
      badge: 'Haircut',
      category: 'haircut',
      title: 'Poodle Lady Elegant Transformation',
      description: 'Complete grooming with model cut'
    },
    {
      beforeImage: '../assets/images/gallery3.jpg',
      afterImage: '../assets/images/gallery4.jpg',
      beforeLabel: 'BEFORE',
      afterLabel: 'AFTER',
      badge: 'Creative',
      category: 'creative',
      title: 'Creative Fur Coloring',
      description: 'Safe colors, creative design'
    },
    {
      beforeImage: '../assets/images/gallery5.jpg',
      afterImage: '../assets/images/gallery6.jpg',
      beforeLabel: 'BEFORE',
      afterLabel: 'AFTER',
      badge: 'Cat',
      category: 'cats',
      title: 'Gentle Cat Grooming',
      description: 'Stress-free environment, loving care'
    },
    {
      beforeImage: '../assets/images/gallery1.jpg',
      afterImage: '../assets/images/gallery3.jpg',
      beforeLabel: 'BEFORE',
      afterLabel: 'AFTER',
      badge: 'Haircut',
      category: 'haircut',
      title: 'Golden Retriever Grooming',
      description: 'Bathing, brushing, trimming'
    }
  ],
  ru: [
    {
      beforeImage: '../assets/images/gallery1.jpg',
      afterImage: '../assets/images/gallery2.jpg',
      beforeLabel: 'ДО',
      afterLabel: 'ПОСЛЕ',
      badge: 'Стрижка',
      category: 'haircut',
      title: 'Элегантная трансформация пуделя',
      description: 'Полный уход с модельной стрижкой'
    },
    {
      beforeImage: '../assets/images/gallery3.jpg',
      afterImage: '../assets/images/gallery4.jpg',
      beforeLabel: 'ДО',
      afterLabel: 'ПОСЛЕ',
      badge: 'Креатив',
      category: 'creative',
      title: 'Креативное окрашивание шерсти',
      description: 'Безопасные красители, креативный дизайн'
    },
    {
      beforeImage: '../assets/images/gallery5.jpg',
      afterImage: '../assets/images/gallery6.jpg',
      beforeLabel: 'ДО',
      afterLabel: 'ПОСЛЕ',
      badge: 'Кошка',
      category: 'cats',
      title: 'Бережный груминг кошек',
      description: 'Безstressовая обстановка, заботливый уход'
    },
    {
      beforeImage: '../assets/images/gallery1.jpg',
      afterImage: '../assets/images/gallery3.jpg',
      beforeLabel: 'ДО',
      afterLabel: 'ПОСЛЕ',
      badge: 'Стрижка',
      category: 'haircut',
      title: 'Груминг золотистого ретривера',
      description: 'Купание, расчесывание, тримминг'
    }
  ],
  uk: [
    {
      beforeImage: '../assets/images/gallery1.jpg',
      afterImage: '../assets/images/gallery2.jpg',
      beforeLabel: 'ДО',
      afterLabel: 'ПІСЛЯ',
      badge: 'Стрижка',
      category: 'haircut',
      title: 'Елегантна трансформація пуделя',
      description: 'Повний догляд з модельною стрижкою'
    },
    {
      beforeImage: '../assets/images/gallery3.jpg',
      afterImage: '../assets/images/gallery4.jpg',
      beforeLabel: 'ДО',
      afterLabel: 'ПІСЛЯ',
      badge: 'Креатив',
      category: 'creative',
      title: 'Креативне фарбування шерсті',
      description: 'Безпечні барвники, креативний дизайн'
    },
    {
      beforeImage: '../assets/images/gallery5.jpg',
      afterImage: '../assets/images/gallery6.jpg',
      beforeLabel: 'ДО',
      afterLabel: 'ПІСЛЯ',
      badge: 'Кіт',
      category: 'cats',
      title: 'Дбайливий грумінг котів',
      description: 'Безстресова обстановка, турботливий догляд'
    },
    {
      beforeImage: '../assets/images/gallery1.jpg',
      afterImage: '../assets/images/gallery3.jpg',
      beforeLabel: 'ДО',
      afterLabel: 'ПІСЛЯ',
      badge: 'Стрижка',
      category: 'haircut',
      title: 'Грумінг золотистого ретривера',
      description: 'Купання, розчісування, трімінг'
    }
  ]
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
        uk: { all: 'Всі', haircut: 'Стрижки', creative: 'Креатив', cats: 'Коти' }
      }
    });
  }
});