/** Revert only cloud distance/scale/motion to original Scene3D values. */
import fs from 'fs';

const path = '3d-weather-codrops-main/dist-widget/Scene3D-Cdhk74W6.mjs';
let s = fs.readFileSync(path, 'utf8');

const replacements = [
  ['f=u||d;return', 'f=u;return'],
  ['c?[0,1.08,12.80]', 'c?[0,1.15,10.4]'],
  ['d?.705:1', 'd?.88:1'],
  ['d?[-.45,.04,0]', 'd?[-.45,.1,0]'],
  [
    'segments:26,bounds:[2.35,.72,.96],volume:i?1.28:1.55,color:a.primary,fade:24,speed:t*1.18,opacity:a.intensity*.8,position:[-.82,2.02,-2.02]',
    'segments:26,bounds:[2,.56,.88],volume:i?1.28:1.55,color:a.primary,fade:24,speed:t,opacity:a.intensity*.8,position:[-.82,2.02,-2.02]',
  ],
  [
    'segments:20,bounds:[1.85,.66,.9],volume:i?.95:1.14,color:a.secondary,fade:26,speed:t*1.62,opacity:a.intensity*.64,position:[.78,1.74,-2.48]',
    'segments:20,bounds:[1.5,.5,.78],volume:i?.95:1.14,color:a.secondary,fade:26,speed:t*.84,opacity:a.intensity*.64,position:[.72,1.78,-2.48]',
  ],
  [
    'segments:16,bounds:[1.55,.62,.82],volume:.82,color:a.tertiary,fade:28,speed:t*.42,opacity:a.intensity*.56,position:[-1.42,1.62,-2.88]',
    'segments:16,bounds:[1.12,.46,.7],volume:.82,color:a.tertiary,fade:28,speed:t*.72,opacity:a.intensity*.56,position:[-1.38,1.58,-2.88]',
  ],
];

for (const [from, to] of replacements) {
  if (!s.includes(from)) {
    console.error('miss:', from.slice(0, 70));
    process.exit(1);
  }
  s = s.replace(from, to);
}

fs.writeFileSync(path, s);
console.log('clouds reverted');
