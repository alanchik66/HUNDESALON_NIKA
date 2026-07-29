import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPreciseAddressLabel,
  normalizeNominatimReverse,
  normalizePhotonReverse,
  parseReverseCoordinates,
} from './reverse-geocode.js';

const COORDINATES = { latitude: 51.313317, longitude: 12.45543 };

test('reverse geocoding validates coordinate ranges', () => {
  assert.deepEqual(parseReverseCoordinates('51.313317', '12.45543'), COORDINATES);
  assert.equal(parseReverseCoordinates('', '12.45543'), null);
  assert.equal(parseReverseCoordinates('51.313317', '181'), null);
});

test('precise address labels prefer city, road, and house number', () => {
  assert.equal(
    buildPreciseAddressLabel({
      city: 'Leipzig',
      suburb: 'Stotteritz',
      road: 'Holzhauser Strasse',
      house_number: '95',
    }),
    'Leipzig - Holzhauser Strasse 95'
  );
  assert.equal(
    buildPreciseAddressLabel({ city: 'Leipzig', suburb: 'Stotteritz' }),
    'Leipzig - Stotteritz'
  );
});

test('Nominatim payloads keep the detailed OSM address and attribution', () => {
  const normalized = normalizeNominatimReverse(
    {
      lat: '51.31331',
      lon: '12.45544',
      name: '95',
      display_name: 'Holzhauser Strasse 95, Leipzig, Deutschland',
      address: {
        house_number: '95',
        road: 'Holzhauser Strasse',
        suburb: 'Stotteritz',
        city: 'Leipzig',
        state: 'Sachsen',
        country: 'Deutschland',
        country_code: 'de',
      },
    },
    COORDINATES
  );

  assert.equal(normalized.label, 'Leipzig - Holzhauser Strasse 95');
  assert.equal(normalized.precision, 'building');
  assert.equal(normalized.provider, 'nominatim');
  assert.equal(normalized.address.state, 'Sachsen');
});

test('Photon fallback maps street fields to the same response shape', () => {
  const normalized = normalizePhotonReverse(
    {
      features: [
        {
          geometry: { coordinates: [12.45544, 51.31331] },
          properties: {
            name: 'Hundesalon',
            street: 'Holzhauser Strasse',
            housenumber: '95',
            district: 'Stotteritz',
            city: 'Leipzig',
            state: 'Sachsen',
            country: 'Deutschland',
            countrycode: 'DE',
          },
        },
      ],
    },
    COORDINATES
  );

  assert.equal(normalized.label, 'Leipzig - Holzhauser Strasse 95');
  assert.equal(normalized.address.country_code, 'de');
  assert.equal(normalized.provider, 'photon');
});
