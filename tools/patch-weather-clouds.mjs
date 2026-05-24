/**
 * Tune header weather 3D clouds: farther + less dense.
 * Patches dist-widget/Scene3D-Cdhk74W6.mjs (re-run after widget rebuild if source changes).
 */
import fs from 'fs';

const path = '3d-weather-codrops-main/dist-widget/Scene3D-Cdhk74W6.mjs';
let s = fs.readFileSync(path, 'utf8');
const before = s.length;

const replacements = [
  // header-panel uses compact cloud layers (was full-screen 6-layer stack)
  ['f=u;return', 'f=u||d;return'],
  // pull camera back slightly in header-panel
  ['c?[0,1.15,10.4]', 'c?[0,1.08,11.45]'],
];

const oldH =
  'H=({intensity:e=.58,speed:t=.08,portalMode:n=!1,compact:r=!1,isPartlyCloudy:i=!1})=>{let a={primary:`#FFFFFF`,secondary:`#F8F8F8`,tertiary:`#F0F0F0`,light:`#FAFAFA`,intensity:e},c=r&&typeof window<`u`&&window.innerWidth<=899;return c?(0,L.jsx)(`group`,{renderOrder:2,position:[0,.5,.12],scale:[1,1,1],children:(0,L.jsxs)(h,{material:d,children:[(0,L.jsx)(O,{segments:18,bounds:[1.05,.46,.66],volume:i?.52:.62,color:a.primary,fade:22,speed:t,opacity:a.intensity*.76,position:[-1.05,2.05,-2.05]}),(0,L.jsx)(O,{segments:14,bounds:[.88,.4,.58],volume:i?.38:.46,color:a.secondary,fade:24,speed:t*.84,opacity:a.intensity*.6,position:[.1,1.92,-2.48]}),!i&&(0,L.jsx)(O,{segments:11,bounds:[.72,.36,.52],volume:.32,color:a.tertiary,fade:26,speed:t*.72,opacity:a.intensity*.5,position:[-1.48,1.82,-2.82]})]})}):r?(0,L.jsx)(`group`,{renderOrder:2,children:(0,L.jsxs)(h,{material:d,children:[(0,L.jsx)(O,{segments:26,bounds:[2,.56,.88],volume:i?1.28:1.55,color:a.primary,fade:24,speed:t,opacity:a.intensity*.8,position:[-.82,2.02,-2.02]}),(0,L.jsx)(O,{segments:20,bounds:[1.5,.5,.78],volume:i?.95:1.14,color:a.secondary,fade:26,speed:t*.84,opacity:a.intensity*.64,position:[.72,1.78,-2.48]}),!i&&(0,L.jsx)(O,{segments:16,bounds:[1.12,.46,.7],volume:.82,color:a.tertiary,fade:28,speed:t*.72,opacity:a.intensity*.56,position:[-1.38,1.58,-2.88]})]})}):n?(0,L.jsx)(`group`,{renderOrder:2,children:(0,L.jsxs)(h,{material:d,children:[(0,L.jsx)(O,{segments:40,bounds:[8,3,3],volume:8,color:a.primary,fade:50,speed:t,opacity:a.intensity,position:[0,4,-2]}),(0,L.jsx)(O,{segments:35,bounds:[6,2.5,2.5],volume:6,color:a.secondary,fade:60,speed:t*.8,opacity:a.intensity*.8,position:[2,3,-3]})]})}):(0,L.jsx)(`group`,{renderOrder:2,children:(0,L.jsxs)(h,{material:d,children:[(0,L.jsx)(O,{segments:80,bounds:[12,4,4],volume:15,color:a.primary,fade:50,speed:t,opacity:a.intensity,position:[-5,4,-2]}),(0,L.jsx)(O,{segments:70,bounds:[14,3,3],volume:12,color:a.secondary,fade:60,speed:t*.7,opacity:a.intensity*.9,position:[6,3.5,-1]}),(0,L.jsx)(O,{segments:60,bounds:[10,3,3],volume:10,color:a.tertiary,fade:70,speed:t*1.1,opacity:a.intensity*.8,position:[0,5.5,-3]}),(0,L.jsx)(O,{segments:50,bounds:[8,2.5,2.5],volume:8,color:a.light,fade:80,speed:t*.9,opacity:a.intensity*.6,position:[-8,3,-4]}),(0,L.jsx)(O,{segments:45,bounds:[6,2,2],volume:6,color:a.secondary,fade:90,speed:t*1.3,opacity:a.intensity*.5,position:[8,6,-2]}),(0,L.jsx)(O,{segments:55,bounds:[9,2.5,2.5],volume:9,color:a.tertiary,fade:75,speed:t*.6,opacity:a.intensity*.7,position:[-2,2.5,-5]})]})})},';

const newH =
  'H=({intensity:e=.5,speed:t=.08,portalMode:n=!1,compact:r=!1,isPartlyCloudy:i=!1})=>{let a={primary:`#FFFFFF`,secondary:`#F8F8F8`,tertiary:`#F0F0F0`,light:`#FAFAFA`,intensity:e},c=r&&typeof window<`u`&&window.innerWidth<=899;return c?(0,L.jsx)(`group`,{renderOrder:2,position:[0,.5,.12],scale:[1,1,1],children:(0,L.jsxs)(h,{material:d,children:[(0,L.jsx)(O,{segments:18,bounds:[1.12,.5,.72],volume:i?.4:.48,color:a.primary,fade:24,speed:t,opacity:a.intensity*.62,position:[-1.05,2.05,-2.82]}),(0,L.jsx)(O,{segments:14,bounds:[.95,.44,.62],volume:i?.3:.36,color:a.secondary,fade:26,speed:t*.84,opacity:a.intensity*.48,position:[.1,1.92,-3.18]}),!i&&(0,L.jsx)(O,{segments:11,bounds:[.78,.38,.56],volume:.24,color:a.tertiary,fade:28,speed:t*.72,opacity:a.intensity*.38,position:[-1.48,1.82,-3.52]})]})}):r?(0,L.jsx)(`group`,{renderOrder:2,children:(0,L.jsxs)(h,{material:d,children:[(0,L.jsx)(O,{segments:26,bounds:[2.2,.62,.95],volume:i?1.02:1.18,color:a.primary,fade:26,speed:t,opacity:a.intensity*.64,position:[-.82,2.02,-2.72]}),(0,L.jsx)(O,{segments:20,bounds:[1.62,.54,.84],volume:i?.78:.9,color:a.secondary,fade:28,speed:t*.84,opacity:a.intensity*.5,position:[.72,1.78,-3.18]}),!i&&(0,L.jsx)(O,{segments:16,bounds:[1.2,.5,.76],volume:.62,color:a.tertiary,fade:30,speed:t*.72,opacity:a.intensity*.42,position:[-1.38,1.58,-3.58]})]})}):n?(0,L.jsx)(`group`,{renderOrder:2,children:(0,L.jsxs)(h,{material:d,children:[(0,L.jsx)(O,{segments:40,bounds:[8,3,3],volume:8,color:a.primary,fade:50,speed:t,opacity:a.intensity,position:[0,4,-2]}),(0,L.jsx)(O,{segments:35,bounds:[6,2.5,2.5],volume:6,color:a.secondary,fade:60,speed:t*.8,opacity:a.intensity*.8,position:[2,3,-3]})]})}):(0,L.jsx)(`group`,{renderOrder:2,children:(0,L.jsxs)(h,{material:d,children:[(0,L.jsx)(O,{segments:80,bounds:[12,4,4],volume:15,color:a.primary,fade:50,speed:t,opacity:a.intensity,position:[-5,4,-2]}),(0,L.jsx)(O,{segments:70,bounds:[14,3,3],volume:12,color:a.secondary,fade:60,speed:t*.7,opacity:a.intensity*.9,position:[6,3.5,-1]}),(0,L.jsx)(O,{segments:60,bounds:[10,3,3],volume:10,color:a.tertiary,fade:70,speed:t*1.1,opacity:a.intensity*.8,position:[0,5.5,-3]}),(0,L.jsx)(O,{segments:50,bounds:[8,2.5,2.5],volume:8,color:a.light,fade:80,speed:t*.9,opacity:a.intensity*.6,position:[-8,3,-4]}),(0,L.jsx)(O,{segments:45,bounds:[6,2,2],volume:6,color:a.secondary,fade:90,speed:t*1.3,opacity:a.intensity*.5,position:[8,6,-2]}),(0,L.jsx)(O,{segments:55,bounds:[9,2.5,2.5],volume:9,color:a.tertiary,fade:75,speed:t*.6,opacity:a.intensity*.7,position:[-2,2.5,-5]})]})})},';

replacements.push([oldH, newH]);

// Lower header / header-panel cloud intensities (f is true for both)
const intensityPatches = [
  ['intensity:f?.44:.5', 'intensity:f?.36:.5'],
  ['intensity:f?.52:.6', 'intensity:f?.42:.6'],
  ['intensity:f?.6:.8', 'intensity:f?.48:.8'],
  ['intensity:f?.58:.8', 'intensity:f?.46:.8'],
  ['intensity:f?.5:.6', 'intensity:f?.4:.6'],
  ['intensity:f?.56:.9', 'intensity:f?.44:.9'],
];

for (const [from, to] of [...replacements, ...intensityPatches]) {
  if (!s.includes(from)) {
    console.error('Pattern not found:', from.slice(0, 80));
    process.exit(1);
  }
  s = s.replace(from, to);
}

fs.writeFileSync(path, s);
console.log('patched clouds', before, '->', s.length);
