import test from 'node:test';
import assert from 'node:assert/strict';

import { bookingMetadata } from './upload.js';

test('bookingMetadata reads plain JSON session payloads', () => {
  assert.deepEqual(
    bookingMetadata({
      lang: 'de',
      service: 'Trimmen',
      date: '2026-08-01',
      time: '10:00',
    }),
    {
      lang: 'de',
      service: 'Trimmen',
      date: '2026-08-01',
      time: '10:00',
    }
  );
});

test('bookingMetadata reads multipart FormData via .get (not property access)', () => {
  const formData = new FormData();
  formData.append('lang', 'de');
  formData.append('service', 'Trimmen');
  formData.append('date', '2026-08-01');
  formData.append('time', '10:00');
  formData.append('file', new Blob(['x'], { type: 'image/jpeg' }), 'pet.jpg');

  // Property access is undefined on FormData — the old helper silently emptied metadata.
  assert.equal(formData.lang, undefined);

  assert.deepEqual(bookingMetadata(formData), {
    lang: 'de',
    service: 'Trimmen',
    date: '2026-08-01',
    time: '10:00',
  });
});
