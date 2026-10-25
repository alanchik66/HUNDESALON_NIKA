import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

for (const lang of ['ru', 'uk', 'de', 'en']) {
  test(`${lang}: online booking and price list use identical breed services`, () => {
    const load = page => {
      const html = readFileSync(new URL(`../${lang}/${page}.html`, import.meta.url), 'utf8');
      const context = vm.createContext({ window: {}, Intl });
      for (const [, file] of html.matchAll(/<script src="\.\.\/assets\/js\/([^?"]+)(?:\?[^"]*)?"/g)) {
        if (!['price-page-data.js', 'price-page-ru-data.js', 'price-page-locales.js', 'fci-dog-breeds-data.js', 'price-page-fci-breeds.js', 'price-page-coat-groups.js', 'cat-breeds-data.js', 'price-page-cat-breeds.js', 'animal-breed-photo-data.js', 'price-page-animal-groups.js', 'price-booking.js'].includes(file)) continue;
        vm.runInContext(readFileSync(new URL(`../assets/js/${file}`, import.meta.url), 'utf8'), context);
      }
      return context.window.PriceBookingCatalog.build(lang);
    };
    const booking = load('onlayn-bronirovanie');
    const price = load('prays-list');
    const snapshot = catalog => catalog.breeds.map(breed => ({ breed, services: catalog.getServices(breed.categoryId, breed.id) }));
    assert.equal(JSON.stringify(snapshot(booking)), JSON.stringify(snapshot(price)));
    const dogs = booking.breeds.filter(breed => booking.getCategory(breed.categoryId).source.animalType === 'dog');
    assert.ok(dogs.length >= 400);
    for (const breed of dogs) {
      const services = booking.getServices(breed.categoryId, breed.id);
      assert.ok(services.length > 0, breed.label);
      assert.ok(services.every(service => service.price && service.label));
      const other = booking.breeds.find(item => item.categoryId !== breed.categoryId);
      assert.equal(booking.resolveQuote(breed.categoryId, other.id, services[0].id).service, null);
    }
  });
}
