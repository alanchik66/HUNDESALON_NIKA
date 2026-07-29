import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDistrictLabel,
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

test('public location labels mask a precise address with its district', () => {
  assert.equal(
    buildDistrictLabel({
      city: 'Leipzig',
      suburb: 'Stotteritz',
      road: 'Holzhauser Strasse',
      house_number: '95',
    }),
    'Leipzig - Stotteritz'
  );
  assert.equal(
    buildDistrictLabel({ city: 'Leipzig', suburb: 'Stotteritz' }),
    'Leipzig - Stotteritz'
  );
  assert.equal(
    buildDistrictLabel({
      city: 'Leipzig',
      city_district: 'Sudost',
      hamlet: 'Zuckelhausen',
      road: 'Walter-Markov-Ring',
      house_number: '1',
    }),
    'Leipzig - Zuckelhausen'
  );
});

test('Nominatim payloads preserve coordinate precision without exposing street fields', () => {
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

  assert.equal(normalized.label, 'Leipzig - Stotteritz');
  assert.equal(normalized.precision, 'building');
  assert.equal(normalized.display_precision, 'district');
  assert.equal(normalized.provider, 'nominatim');
  assert.equal(normalized.address.state, 'Sachsen');
  assert.equal(normalized.address.road, undefined);
  assert.equal(normalized.address.house_number, undefined);
  assert.doesNotMatch(normalized.display_name, /Holzhauser|95/);
});

test('Photon fallback exposes the same district-safe response shape', () => {
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

  assert.equal(normalized.label, 'Leipzig - Stotteritz');
  assert.equal(normalized.display_precision, 'district');
  assert.equal(normalized.address.road, undefined);
  assert.equal(normalized.address.house_number, undefined);
  assert.equal(normalized.address.country_code, 'de');
  assert.equal(normalized.provider, 'photon');
});
