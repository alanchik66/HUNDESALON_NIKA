import fs from 'fs';
import { parse } from 'acorn';

const scenePath = '3d-weather-codrops-main/dist-widget/Scene3D-Cdhk74W6.mjs';
const starsParams = 'radius:22,depth:11,count:360,factor:1.48,saturation:0,fade:!0,speed:.32,renderOrder:-80';
const starsBlock = `c&&x?(0,L.jsx)(\`div\`,{className:\`weather-app__stars-scene weather-app__stars-scene--header-panel\`,style:{position:\`absolute\`,inset:0,pointerEvents:\`none\`,zIndex:0},children:(0,L.jsx)(f,{dpr:[1,2],frameloop:\`always\`,camera:{position:[0,1.15,10.4],fov:56},gl:{alpha:!0,antialias:!0,powerPreference:\`high-performance\`,stencil:!1,depth:!0},onCreated:({gl:e})=>{e.setClearColor(0,0)},style:{width:\`100%\`,height:\`100%\`,background:\`transparent\`},children:(0,L.jsx)(S,{${starsParams}})})}):null,`;

let s = fs.readFileSync(scenePath, 'utf8');
const openNeedle = 'children:(0,L.jsxs)(f,{dpr:[1,2]';
const openReplace = `children:[${starsBlock}(0,L.jsxs)(f,{dpr:[1,2]`;
const closeNeedle = 'maxDistance:c?12:20})]})]})})};export{ie as default}';
const closeReplace = 'maxDistance:c?12:20})]})]})]})};export{ie as default}';

let sOpen = s.replace(openNeedle, openReplace);
console.log('after open only, parse:', tryParse(sOpen));
const hasClose = sOpen.includes(closeNeedle);
console.log('close needle found after open:', hasClose);
s = sOpen.replace(closeNeedle, closeReplace);
console.log('close applied:', s !== sOpen);
tryParse(s, 'patched');
console.log('end tail', s.slice(s.lastIndexOf('maxDistance'), s.lastIndexOf('maxDistance') + 55));

function tryParse(src, label) {
  try {
    parse(src, { sourceType: 'module', ecmaVersion: 2022 });
    return 'ok';
  } catch (e) {
    if (label) {
      console.log(label, 'pos', e.pos, JSON.stringify(src.slice(e.pos - 60, e.pos + 60)));
    }
    return e.message;
  }
}
