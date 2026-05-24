/**
 * Header-panel 3D stars: dedicated back canvas + compact star field sizing.
 */
import fs from 'fs';

const scenePath = '3d-weather-codrops-main/dist-widget/Scene3D-Cdhk74W6.mjs';
const sceneVer = '20260522-stars-all-1';

/** Fits ~100px-tall weather strip: smaller points, tighter field than radius:34/factor:2.1. */
const starsParams = 'radius:22,depth:11,count:360,factor:1.48,saturation:0,fade:!0,speed:.32,renderOrder:-80';

const starsBlock = `c&&x?(0,L.jsx)(\`div\`,{className:\`weather-app__stars-scene weather-app__stars-scene--header-panel\`,style:{position:\`absolute\`,inset:0,pointerEvents:\`none\`,zIndex:0},children:(0,L.jsx)(f,{dpr:[1,2],frameloop:\`always\`,camera:{position:[0,1.15,10.4],fov:56},gl:{alpha:!0,antialias:!0,powerPreference:\`high-performance\`,stencil:!1,depth:!0},onCreated:({gl:e})=>{e.setClearColor(0,0)},style:{width:\`100%\`,height:\`100%\`,background:\`transparent\`},children:(0,L.jsx)(S,{${starsParams}})})}):null,`;

let s = fs.readFileSync(scenePath, 'utf8');

if (s.includes('weather-app__stars-scene--header-panel')) {
  s = s.replace(
    /\(0,L\.jsx\)\(S,\{radius:\d+,depth:\d+,count:\d+,factor:[\d.]+,saturation:0,fade:!0,speed:[\d.]+,renderOrder:-80\}\)/,
    `(0,L.jsx)(S,{${starsParams}})`
  );
  console.log('updated existing header-panel stars canvas');
} else {
  const openNeedle = 'children:(0,L.jsxs)(f,{dpr:[1,2]';
  const openReplace = `children:[${starsBlock}(0,L.jsxs)(f,{dpr:[1,2]`;
  const closeNeedle = 'maxDistance:c?12:20})]})]})})};export{ie as default}';
  const closeReplace = 'maxDistance:c?12:20})]})]})]})};export{ie as default}';

  if (!s.includes(openNeedle)) {
    console.error('open needle missing');
    process.exit(1);
  }
  if (!s.includes(closeNeedle)) {
    console.error('close needle missing');
    process.exit(1);
  }

  s = s.replace(openNeedle, openReplace);
  s = s.replace(closeNeedle, closeReplace);
  console.log('inserted header-panel stars canvas');
}

if (s.includes('(O||s||c)&&')) {
  s = s.replace('(O||s||c)&&', '(O||s)&&');
}

s = s.replace(
  'radius:s?34:100,depth:s?16:50,count:s?420:5e3,factor:s?2.1:4',
  'radius:s?24:100,depth:s?12:50,count:s?360:5e3,factor:s?1.5:4'
);

fs.writeFileSync(scenePath, s);

for (const file of [
  '3d-weather-codrops-main/dist-widget/weather-widget.header-panel-preview.es.js',
  '3d-weather-codrops-main/dist-widget/weather-widget.header-panel-dropdown-scene.es.js',
]) {
  let w = fs.readFileSync(file, 'utf8');
  w = w.replace(/Scene3D-Cdhk74W6\.mjs\?v=[^`]+/, `Scene3D-Cdhk74W6.mjs?v=${sceneVer}`);
  fs.writeFileSync(file, w);
  console.log('bumped', file);
}

console.log('done', sceneVer);
