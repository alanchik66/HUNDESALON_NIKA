import test from 'node:test';
import assert from 'node:assert/strict';

import { bookingMetadata } from './upload.js';
import { hasValidPetPhotoSignature } from './_lib/pet-photo-upload.js';

test('bookingMetadata reads plain JSON upload session payloads', () => {
  assert.deepEqual(
    bookingMetadata({
      lang: 'de',
      service: 'Hundeschur',
      date: '2026-08-01',
      time: '10:00',
    }),
    {
      lang: 'de',
      service: 'Hundeschur',
      date: '2026-08-01',
      time: '10:00',
    }
  );
});

test('bookingMetadata reads multipart FormData via .get (not property access)', () => {
  const formData = new FormData();
  formData.append('lang', 'en');
  formData.append('service', 'Cat grooming');
  formData.append('date', '2026-08-02');
  formData.append('time', '14:30');

  // Property access is undefined on FormData — regression that wiped Drive metadata.
  assert.equal(formData.lang, undefined);

  assert.deepEqual(bookingMetadata(formData), {
    lang: 'en',
    service: 'Cat grooming',
    date: '2026-08-02',
    time: '14:30',
  });
});

test('validates image magic bytes instead of trusting the browser MIME type', async () => {
  const png = new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'pet.png', {
    type: 'image/png',
  });
  const fake = new File([Uint8Array.from([0x25, 0x50, 0x44, 0x46])], 'pet.png', { type: 'image/png' });
  assert.equal(await hasValidPetPhotoSignature(png), true);
  assert.equal(await hasValidPetPhotoSignature(fake), false);
});
