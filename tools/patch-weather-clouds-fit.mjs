/**
 * Subtle header-panel cloud fit: pull scene back slightly so clouds fit the main menu.
 * Does NOT change cloud density (opacity, volume, intensity, layer count).
 */
import fs from 'fs';

const scenePath = '3d-weather-codrops-main/dist-widget/Scene3D-Cdhk74W6.mjs';
let s = fs.readFileSync(scenePath, 'utf8');

const replacements = [
  // header-panel camera: pull back in small steps (density unchanged)
  ['c?[0,1.15,10.4]', 'c?[0,1.14,10.72]'],
  ['c?[0,1.14,10.72]', 'c?[0,1.13,11.02]'],
  // header-panel scene scale: slight zoom-out (density unchanged)
  ['d?.88:1', 'd?.855:1'],
  ['d?.855:1', 'd?.83:1'],
  // nudge scene down a touch inside menu band
  ['d?[-.45,.1,0]', 'd?[-.45,.04,0]'],
];

for (const [from, to] of replacements) {
  if (!s.includes(from)) {
    console.error('Pattern not found:', from);
    process.exit(1);
  }
  s = s.replace(from, to);
}

fs.writeFileSync(scenePath, s);
console.log('patched Scene3D header-panel cloud fit');

const sceneVer = '20260521-weather-clouds-fit-2';
const widgetFiles = [
  '3d-weather-codrops-main/dist-widget/weather-widget.header-panel-preview.es.js',
  '3d-weather-codrops-main/dist-widget/weather-widget.header-panel-dropdown-scene.es.js',
];

for (const file of widgetFiles) {
  let w = fs.readFileSync(file, 'utf8');
  w = w.replace(/Scene3D-Cdhk74W6\.mjs\?v=[^`]+/, `Scene3D-Cdhk74W6.mjs?v=${sceneVer}`);
  fs.writeFileSync(file, w);
  console.log('bumped', file);
}
