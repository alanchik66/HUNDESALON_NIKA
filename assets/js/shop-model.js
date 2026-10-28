// Basket storage contains IDs and quantities only, never customer or payment data.
export function publishedProducts(products) {
  if (!Array.isArray(products)) return [];
  const ids = new Set();
  return products.filter(product => {
    if (
      !product ||
      product.published !== true ||
      typeof product.id !== 'string' ||
      !/^[a-z0-9-]{1,64}$/.test(product.id) ||
      ids.has(product.id) ||
      !['wash', 'coat', 'tools', 'paws', 'cats', 'sets'].includes(product.category) ||
      !Array.isArray(product.pets) ||
      !product.pets.length ||
      product.pets.some(pet => !['dog', 'cat'].includes(pet)) ||
      !Number.isSafeInteger(product.priceCents) ||
      product.priceCents < 1 ||
      product.priceCents > 10000000 ||
      !['de', 'en', 'ru', 'uk'].every(lang => typeof product.name?.[lang] === 'string' && product.name[lang].trim()) ||
      typeof product.image !== 'string' ||
      !/^\/assets\/images\/[a-zA-Z0-9/_-]+\.(webp|png|jpg|jpeg)$/.test(product.image)
    )
      return false;
    ids.add(product.id);
    return true;
  });
}

export function normalizeBasket(value, products) {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(products.filter(product => product.available === true).map(product => product.id));
  const quantities = new Map();
  for (const line of value.slice(0, 100)) {
    if (!line || !allowed.has(line.id) || !Number.isInteger(line.quantity) || line.quantity < 1) continue;
    quantities.set(line.id, Math.min(99, (quantities.get(line.id) || 0) + line.quantity));
  }
  return [...quantities].map(([id, quantity]) => ({ id, quantity }));
}

export function basketSubtotal(basket, products) {
  return normalizeBasket(basket, products).reduce(
    (sum, line) => sum + products.find(product => product.id === line.id).priceCents * line.quantity,
    0
  );
}
