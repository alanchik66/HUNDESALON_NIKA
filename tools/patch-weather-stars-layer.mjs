/**
 * Header-panel: 3D Stars on a dedicated back canvas (not in the clouds canvas).
 */
import fs from 'fs';

const scenePath = '3d-weather-codrops-main/dist-widget/Scene3D-Cdhk74W6.mjs';
const sceneVer = '20260522-stars-layer-split-1';
let s = fs.readFileSync(scenePath, 'utf8');

const starsBlock =
  'c&&x?(0,L.jsx)(`div`,{className:`weather-app__stars-scene weather-app__stars-scene--header-panel`,style:{position:`absolute`,inset:0,pointerEvents:`none`,zIndex:0},children:(0,L.jsx)(f,{dpr:[1,2],frameloop:`always`,camera:{position:[0,1.15,10.4],fov:56},gl:{alpha:!0,antialias:!0,powerPreference:`high-performance`,stencil:!1,depth:!0},onCreated:({gl:e})=>{e.setClearColor(0,0)},style:{width:`100%`,height:`100%`,background:`transparent`},children:(0,L.jsx)(S,{radius:34,depth:16,count:420,factor:2.1,saturation:0,fade:!0,speed:.35,renderOrder:-80})})})}):null,';

const openNeedle = 'children: (0, L.jsxs)(f, {';
const openReplace = `children: [${starsBlock}(0, L.jsxs)(f, {`;

const closeNeedle = `        ],
      }),
    });
  };
export { ie as default };`;
const closeReplace = `        ],
      }),
      ],
    });
  };
export { ie as default };`;

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
s = s.replace('(O || s || c) &&', '(O || s) &&');

fs.writeFileSync(scenePath, s);

for (const file of [
  '3d-weather-codrops-main/dist-widget/weather-widget.header-panel-preview.es.js',
  '3d-weather-codrops-main/dist-widget/weather-widget.header-panel-dropdown-scene.es.js',
]) {
  let w = fs.readFileSync(file, 'utf8');
  w = w.replace(/Scene3D-Cdhk74W6\.mjs\?v=[^`]+/, `Scene3D-Cdhk74W6.mjs?v=${sceneVer}`);
  fs.writeFileSync(file, w);
}

console.log('patched', scenePath, 'cache', sceneVer);
