import fs from 'fs';
import path from 'path';

const distDir = '3d-weather-codrops-main/dist-widget';
const files = [
  'weather-widget.header-panel-preview.es.js',
  'weather-widget.header-panel-dropdown-scene.es.js',
  'weather-widget.es.js',
];

const reps = [
  [
    'locationUnavailable:`Не удалось определить вашу геопозицию. Введите город вручную.`',
    'locationUnavailable:`Не удалось определить геопозицию. Введите место вручную.`',
  ],
  [
    'locationUnavailable:`Не вдалося визначити вашу геолокацію. Введіть місто вручну.`',
    'locationUnavailable:`Не вдалося визначити геолокацію. Введіть місце вручну.`',
  ],
  [
    'locationUnavailable:`Dein Standort konnte nicht ermittelt werden. Bitte gib eine Stadt manuell ein.`',
    'locationUnavailable:`Standort konnte nicht ermittelt werden. Bitte Ort manuell eingeben.`',
  ],
  [
    'locationUnavailable:`Unable to get your current location. Please enter a city name manually.`',
    'locationUnavailable:`Unable to get your current location. Please enter a place manually.`',
  ],
  ['searchResultsLabel:`Choose city`', 'searchResultsLabel:`Choose a place`'],
  [
    'searchNoResults:`No cities found`',
    'searchNoResults:`No place found. Try a more specific name or Latin spelling.`',
  ],
];

for (const file of files) {
  const filePath = path.join(distDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let count = 0;
  for (const [from, to] of reps) {
    if (content.includes(from)) {
      content = content.replaceAll(from, to);
      count += 1;
    }
  }
  fs.writeFileSync(filePath, content);
  console.log(file, count);
}
