import { SHOP_COPY, SHOP_PRODUCTS } from './shop-catalog.js';
import { publishedProducts, normalizeBasket, basketSubtotal } from './shop-model.js';

const lang = Object.hasOwn(SHOP_COPY, document.documentElement.lang) ? document.documentElement.lang : 'de';
const copy = SHOP_COPY[lang];
const products = publishedProducts(SHOP_PRODUCTS);
const storageKey = 'nika-shop-basket-v1';
const money = value => new Intl.NumberFormat(lang, { style: 'currency', currency: 'EUR' }).format(value / 100);
const dialog = document.querySelector('[data-cart-dialog]');
const search = document.querySelector('[data-shop-search]');
const basketTrigger = document.querySelector('[data-cart-open]');
const mountHeaderBasket = () => {
  const controls = document.querySelector('.header .header-controls');
  if (!document.body.classList.contains('shop-page') || !controls || !basketTrigger || basketTrigger.closest('.header-controls')) return;
  const themeToggle = controls.querySelector('.theme-btn');
  if (themeToggle) themeToggle.before(basketTrigger);
  else controls.append(basketTrigger);
  basketTrigger.hidden = false;
  window.HundesalonNavPill?.scan(controls);
  const header = controls.closest('.header');
  if (header) {
    const syncHeaderOffset = () => document.body.style.setProperty('--shop-header-height', `${header.offsetHeight}px`);
    syncHeaderOffset();
    new ResizeObserver(syncHeaderOffset).observe(header);
  }
  window.dispatchEvent(new Event('site-shell:header-controls-ready'));
};
mountHeaderBasket();
document.addEventListener('DOMContentLoaded', mountHeaderBasket, { once: true });
const bindSharedButtons = root => window.HundesalonNavPill?.scan(root);
let basket = [];
let filter = 'all';
let collection = '';
try {
  basket = normalizeBasket(JSON.parse(localStorage.getItem(storageKey) || '[]'), products);
} catch {
  /* Storage can be unavailable. The current basket still works. */
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function saveBasket() {
  basket = normalizeBasket(basket, products);
  try {
    localStorage.setItem(storageKey, JSON.stringify(basket));
  } catch {
    /* Keep the in-memory basket usable. */
  }
  renderBasket();
}

function renderBasket() {
  const count = basket.reduce((sum, line) => sum + line.quantity, 0);
  const counter = document.querySelector('[data-cart-count]');
  counter.textContent = count ? String(count) : '';
  counter.hidden = count === 0;
  const container = document.querySelector('[data-cart-items]');
  container.replaceChildren();
  document.querySelector('[data-cart-summary]').hidden = basket.length === 0;
  if (!basket.length) {
    const empty = element('div', 'shop-cart-empty');
    empty.append(element('h3', '', copy.cartEmpty), element('p', '', copy.cartEmptyText));
    const back = element('button', 'btn-neon shop-button', copy.back);
    back.type = 'button';
    back.addEventListener('click', () => {
      dialog.close();
      document.querySelector('#collections').scrollIntoView({ behavior: 'auto' });
    });
    empty.append(back);
    container.append(empty);
    bindSharedButtons(container);
    document.querySelector('[data-cart-order]').setAttribute('href', 'kontakty.html');
    return;
  }
  for (const line of basket) {
    const product = products.find(item => item.id === line.id);
    const row = element('div', 'shop-cart-line');
    row.append(element('h3', '', product.name[lang]));
    const controls = element('div');
    const label = element('label', '', copy.quantity);
    const input = element('input');
    input.type = 'number';
    input.min = '1';
    input.max = '99';
    input.step = '1';
    input.value = String(line.quantity);
    input.setAttribute('aria-label', `${copy.quantity}: ${product.name[lang]}`);
    input.addEventListener('change', () => {
      const quantity = Number(input.value);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        input.value = String(line.quantity);
        return;
      }
      line.quantity = quantity;
      saveBasket();
    });
    label.append(input);
    const remove = element('button', 'btn-neon', copy.remove);
    remove.type = 'button';
    remove.setAttribute('aria-label', `${copy.remove}: ${product.name[lang]}`);
    remove.addEventListener('click', () => {
      basket = basket.filter(item => item.id !== line.id);
      saveBasket();
      dialog.querySelector('[data-cart-close]').focus();
    });
    controls.append(label, element('strong', '', money(product.priceCents * line.quantity)), remove);
    row.append(controls);
    container.append(row);
  }
  const subtotal = basketSubtotal(basket, products);
  document.querySelector('[data-cart-total]').textContent = money(subtotal);
  const lines = basket.map(line => {
    const product = products.find(item => item.id === line.id);
    return `${product.name[lang]} × ${line.quantity} — ${money(product.priceCents * line.quantity)}`;
  });
  const body = [copy.requestIntro, '', ...lines, '', `${copy.total}: ${money(subtotal)}`, '', copy.requestEnd].join(
    '\n'
  );
  document.querySelector('[data-cart-order]').href =
    `mailto:info@hundesalon-nika.com?subject=${encodeURIComponent(copy.requestSubject)}&body=${encodeURIComponent(body)}`;
  bindSharedButtons(container);
}

function renderProducts() {
  const query = search.value.trim().toLocaleLowerCase(lang);
  const shown = products.filter(
    product =>
      (!collection || product.category === collection) &&
      (filter === 'all' || (filter === 'tools' ? product.category === 'tools' : product.pets.includes(filter))) &&
      (!query || `${product.name[lang]} ${product.description?.[lang] || ''}`.toLocaleLowerCase(lang).includes(query))
  );
  const grid = document.querySelector('[data-shop-products]');
  grid.replaceChildren();
  for (const product of shown) {
    const card = element('article', 'service-card shop-product');
    const image = element('img');
    image.src = product.image;
    image.alt = product.name[lang];
    image.loading = 'lazy';
    image.width = 400;
    image.height = 400;
    card.append(
      image,
      element('h3', '', product.name[lang]),
      element('p', '', product.description?.[lang] || ''),
      element('strong', '', money(product.priceCents))
    );
    if (product.available === true) {
      const add = element('button', 'btn-neon shop-button', copy.add);
      add.type = 'button';
      add.addEventListener('click', () => {
        basket.push({ id: product.id, quantity: 1 });
        saveBasket();
        document.querySelector('[data-shop-announcement]').textContent = `${copy.itemAdded}: ${product.name[lang]}`;
      });
      card.append(add);
    } else {
      const enquire = element('a', 'btn-neon shop-button', copy.unavailable);
      enquire.setAttribute('data-nav-pill', '');
      enquire.href = 'kontakty.html';
      card.append(enquire);
    }
    grid.append(card);
  }
  document.querySelector('[data-shop-empty]').hidden = shown.length > 0;
  document.querySelector('[data-empty-text]').textContent = products.length ? copy.noResults : copy.emptyText;
  const category = copy.categories.find(([id]) => id === collection)?.[1] || copy.allCategories;
  document.querySelector('[data-shop-results]').textContent = `${category} · ${copy.count}: ${shown.length}`;
  document.querySelector('[data-shop-reset]').hidden = filter === 'all' && !query && !collection;
  document.querySelectorAll('[data-shop-filter]').forEach(button => {
    const selected = button.dataset.shopFilter === filter;
    button.setAttribute('aria-pressed', String(selected));
    if (selected) window.HundesalonNavPill?.activate(button);
    else window.HundesalonNavPill?.deactivate(button);
  });
  bindSharedButtons(grid);
}

document.querySelectorAll('[data-catalog-controls]').forEach(node => {
  node.hidden = false;
});
document.querySelector('[data-cart-open]').addEventListener('click', () => {
  renderBasket();
  dialog.showModal();
  document.body.classList.add('shop-cart-open');
});
document.querySelector('[data-cart-close]').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => document.body.classList.remove('shop-cart-open'));
dialog.addEventListener('click', event => {
  if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right) dialog.close();
  }
});
document.querySelectorAll('[data-shop-filter]').forEach(button =>
  button.addEventListener('click', () => {
    filter = button.dataset.shopFilter;
    collection = '';
    renderProducts();
  })
);
document.querySelectorAll('[data-collection]').forEach(link =>
  link.addEventListener('click', () => {
    collection = link.dataset.collection;
    filter = 'all';
    search.value = '';
    renderProducts();
  })
);
search.addEventListener('input', renderProducts);
document.querySelector('[data-shop-reset]').addEventListener('click', () => {
  filter = 'all';
  collection = '';
  search.value = '';
  renderProducts();
});
window.addEventListener('storage', event => {
  if (event.key === storageKey) {
    try {
      basket = normalizeBasket(JSON.parse(event.newValue || '[]'), products);
    } catch {
      basket = [];
    }
    renderBasket();
  }
});
renderProducts();
renderBasket();
bindSharedButtons(document);
