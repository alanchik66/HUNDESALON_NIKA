import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { getBookingWorkingHours, isValidBookingWindow } from '../functions/sendmail.js';

function loadSchedule() {
  const context = vm.createContext({ window: { PricePageCatalog: { categories: [] } }, Intl });
  vm.runInContext(readFileSync(new URL('../assets/js/price-booking.js', import.meta.url), 'utf8'), context);
  return context.window.PriceBookingCatalog.build('ru');
}

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

test('classic and server hours match the published four-locale contact policy, including DST weekends', () => {
  const catalog = loadSchedule();
  for (const [lang, closed] of Object.entries({ de: 'So geschlossen', en: 'Sun closed', ru: 'Вс — выходной', uk: 'Нд — вихідний' })) {
    const html = readFileSync(new URL(`../${lang}/kontakty.html`, import.meta.url), 'utf8');
    assert.match(html, /9:00\s*[–-]\s*21:00/);
    assert.match(html, /10:00\s*[–-]\s*16:00/);
    assert.ok(html.includes(closed));
  }
  for (const [date, expected] of [
    ['2026-03-27', { startMinutes: 540, endMinutes: 1260 }],
    ['2026-03-28', { startMinutes: 600, endMinutes: 960 }],
    ['2026-03-29', null],
    ['2026-03-30', { startMinutes: 540, endMinutes: 1260 }],
    ['2026-10-24', { startMinutes: 600, endMinutes: 960 }],
    ['2026-10-25', null],
    ['2026-10-26', { startMinutes: 540, endMinutes: 1260 }],
    ['2026-02-30', null],
    ['', null],
  ]) {
    assert.deepEqual(JSON.parse(JSON.stringify(catalog.getBookingWorkingHours(date))), expected, date);
    assert.deepEqual(getBookingWorkingHours(date), expected, date);
  }
});

test('configured and calendar-fallback slots use weekday hours and fit the entire appointment block', () => {
  const catalog = loadSchedule();
  const now = new Date('2026-11-22T12:00:00Z');
  const timing = { safeBlockMinutes: 60, slotStepMinutes: 30 };
  for (const calendarConfigured of [false, true]) {
    const slots = date => Array.from(catalog.getAvailableStartTimes(date, timing, [], { calendarConfigured, now }));
    assert.equal(slots('2026-11-23')[0], '09:00');
    assert.equal(slots('2026-11-23').at(-1), '20:00');
    assert.ok(slots('2026-11-23').includes('18:00'));
    assert.equal(slots('2026-11-28')[0], '10:00');
    assert.equal(slots('2026-11-28').at(-1), '15:00');
    assert.deepEqual(slots('2026-11-29'), []);
    assert.deepEqual(Array.from(catalog.getAvailableStartTimes('2026-11-28', { ...timing, safeBlockMinutes: 361 }, [], { calendarConfigured, now })), []);
  }
  const fallback = Array.from(catalog.getAvailableStartTimes('2026-11-28', { ...timing, safeBlockMinutes: 75 }, [], { now }));
  assert.deepEqual(fallback, ['10:00', '11:30', '13:00', '14:30']);
});

test('a missing catalog renders unavailable with no guessed choices or stale native bounds', () => {
  const source = readFileSync(new URL('../assets/js/page-modules.js', import.meta.url), 'utf8');
  const start = source.indexOf('    const renderTimeSlots = () => {');
  const end = source.indexOf('    const bindNativeBookingFields = () => {', start);
  assert.ok(start >= 0 && end > start);
  const nodes = [];
  const bounds = new Map([['min', '09:00'], ['max', '19:00']]);
  vm.runInNewContext(source.slice(start, end) + '\nrenderTimeSlots();', {
    getSelectedTiming: () => ({ safeBlockMinutes: 30 }), bookingCatalog: null,
    state: { selectedDate: '2026-11-29', busyIntervals: [], availabilityConfigured: false },
    selectedTimeField: { setAttribute: (key, value) => bounds.set(key, value), removeAttribute: key => bounds.delete(key) },
    availabilityStatusEl: { dataset: {} },
    timeSlotsContainer: { appendChild: node => nodes.push(node) },
    document: { createElement: tag => ({ tag }) },
    bookingRiskCopy: { noSafeSlots: 'Unavailable' }, bookingCopy: {},
    setAvailabilityStatus() {}, updateDatetimeStepState() {}, refreshBookingScrollbars() {},
    window: { requestAnimationFrame: callback => callback() },
  });
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].tag, 'p');
  assert.equal(nodes[0].textContent, 'Unavailable');
  assert.equal(bounds.size, 0);
});

test('busy intervals and past starts remain correct on both sides of the Berlin DST change', () => {
  const catalog = loadSchedule();
  for (const [date, busyStart, busyEnd] of [
    ['2026-03-30', '2026-03-30T07:00:00Z', '2026-03-30T08:30:00Z'],
    ['2026-10-26', '2026-10-26T08:00:00Z', '2026-10-26T09:30:00Z'],
  ]) {
    const slots = Array.from(catalog.getAvailableStartTimes(date, { safeBlockMinutes: 60, slotStepMinutes: 30 }, [{ start: busyStart, end: busyEnd }], {
      calendarConfigured: true, now: new Date('2026-01-01T00:00:00Z'),
    }));
    assert.equal(slots[0], '10:30');
    const past = Array.from(catalog.getAvailableStartTimes(date, { safeBlockMinutes: 30, slotStepMinutes: 30 }, [], {
      calendarConfigured: true, now: new Date(Date.parse(busyStart) + 5 * 60_000),
    }));
    assert.equal(past[0], '09:30');
  }
});

test('new server bookings reject closed days and block overflow while allowing exact closing boundaries', t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-22T12:00:00Z') });
  for (const [date, time, duration, allowed] of [
    ['2026-11-23', '08:30', 30, false],
    ['2026-11-23', '09:00', 30, true],
    ['2026-11-23', '20:30', 30, true],
    ['2026-11-23', '20:30', 31, false],
    ['2026-11-23', '21:00', 30, false],
    ['2026-11-28', '09:30', 30, false],
    ['2026-11-28', '10:00', 30, true],
    ['2026-11-28', '15:30', 30, true],
    ['2026-11-28', '15:30', 31, false],
    ['2026-11-28', '16:00', 30, false],
    ['2026-11-29', '12:00', 30, false],
    ['2026-11-23', '09:15', 30, false],
    ['2026-11-23', '09:00', 0, false],
    ['2026-11-21', '12:00', 30, false],
    ['2027-03-01', '12:00', 30, false],
  ]) assert.equal(isValidBookingWindow(date, time, duration), allowed, `${date} ${time}, ${duration} minutes`);
});
