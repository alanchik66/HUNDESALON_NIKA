import { loadAnimalPhotoCatalog, normalizeAnimalPhotoKey as normalize } from './lib/animal-photo-catalog.mjs';

const { records, uniqueRecords } = loadAnimalPhotoCatalog();

const byKind = Object.groupBy(uniqueRecords, record => record.kind);
const duplicatePhotoTitles = Object.entries(Object.groupBy(
  uniqueRecords,
  record => `${record.kind}:${normalize(record.photoTitle)}`
))
  .filter(([, matches]) => matches.length > 1)
  .map(([photoTitle, matches]) => ({ photoTitle, breeds: matches.map(record => record.name) }));

const report = {
  renderedRecords: records.length,
  uniqueRecords: uniqueRecords.length,
  counts: Object.fromEntries(Object.entries(byKind).map(([kind, items]) => [kind, items.length])),
  dogsWithoutFciNumber: (byKind.dog || []).filter(record => !record.fciNumber),
  recordsWithoutPhotoTitle: uniqueRecords.filter(record => !record.photoTitle),
  duplicatePhotoTitles,
};

console.log(JSON.stringify(report, null, 2));
