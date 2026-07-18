import fs from 'fs';

const path = '3d-weather-codrops-main/dist-widget/weatherService-iG8lrujy.mjs';
let s = fs.readFileSync(path, 'utf8');
const before = s.length;

s = s.replace(/console\.log\(`\[OpenMeteo\] Final resolved name[^`]*`\),/g, '');
s = s.replace(/console\.log\(`\[Nominatim\] Final resolved name[^`]*`\),/g, '');

const inStart = s.indexOf('In=async({latitude:e,longitude:t},n=`en`)=>{');
const inEnd = s.indexOf('},Ln=async');
if (inStart >= 0 && inEnd >= 0) {
  s = `${s.slice(0, inStart)}In=async()=>null,${s.slice(inEnd + 2)}`;
}

const dollarNeedle = '$=async({latitude:e,longitude:t},n=`en`)=>{';
const salonShortcut =
  '$=async({latitude:e,longitude:t},n=`en`)=>{if(Math.abs(e-51.313317)<0.001&&Math.abs(t-12.45543)<0.001){let r=Z(n),i=`${r}:51.3133,12.4554`;if(Sn.has(i))return Sn.get(i);let a={latitude:e,longitude:t,name:`Zuckelhausen`,region:`Sachsen`,country:`Germany`,countryCode:`DE`,timezone:`Europe/Berlin`};return Sn.set(i,a),a}';
if (s.includes(dollarNeedle) && !s.includes('51.313317')) {
  s = s.replace(dollarNeedle, salonShortcut);
}

const nominatimNeedle = 'headers:{Accept:`application/json`},timeout:1e4}),a=i.data?.address';
const nominatimReplacement =
  'headers:{Accept:`application/json`,"User-Agent":"HUNDESALON-NIKA/1.0 (https://hundesalon-nika.com; weather-widget)"},timeout:1e4}),a=i.data?.address';
if (!s.includes(nominatimNeedle)) {
  console.error('Nominatim headers pattern not found');
  process.exit(1);
}
s = s.replace(nominatimNeedle, nominatimReplacement);

fs.writeFileSync(path, s);
console.log('patched weatherService', before, '->', s.length);
