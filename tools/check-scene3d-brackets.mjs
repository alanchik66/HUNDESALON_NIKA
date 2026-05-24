import fs from 'fs';

const s = fs.readFileSync('3d-weather-codrops-main/dist-widget/Scene3D-Cdhk74W6.mjs', 'utf8');
const start = s.indexOf('return(0,L.jsx)(`div`,{style:{width');
const tail = s.slice(start);
let depth = 0;
let inStr = false;
let q = '';

for (let i = 0; i < tail.length; i += 1) {
  const c = tail[i];
  if (inStr) {
    if (c === q && tail[i - 1] !== '\\') inStr = false;
    continue;
  }
  if (c === '`') {
    inStr = true;
    q = c;
    continue;
  }
  if (c === '(' || c === '{' || c === '[') depth += 1;
  if (c === ')' || c === '}' || c === ']') depth -= 1;
  if (depth < 0) {
    console.log('negative depth at', i, JSON.stringify(tail.slice(Math.max(0, i - 20), i + 20)));
    break;
  }
  if (depth === 0 && i > 20) {
    console.log('balanced at', i, JSON.stringify(tail.slice(i, i + 40)));
    break;
  }
}
console.log('final depth', depth);
console.log('end', JSON.stringify(tail.slice(-100)));
