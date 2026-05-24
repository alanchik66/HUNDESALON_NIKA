import fs from 'fs';

const ver = process.argv[2] || '20260522-weather-fix-1';
for (const file of [
  '3d-weather-codrops-main/dist-widget/weather-widget.header-panel-preview.es.js',
  '3d-weather-codrops-main/dist-widget/weather-widget.header-panel-dropdown-scene.es.js',
]) {
  let w = fs.readFileSync(file, 'utf8');
  w = w.replace(/Scene3D-Cdhk74W6\.mjs\?v=[^`]+/, `Scene3D-Cdhk74W6.mjs?v=${ver}`);
  fs.writeFileSync(file, w);
  console.log('bumped', file, ver);
}
