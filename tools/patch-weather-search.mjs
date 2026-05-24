import fs from 'fs';
import path from 'path';

const distDir = '3d-weather-codrops-main/dist-widget';
const servicePath = path.join(distDir, 'weatherService-iG8lrujy.mjs');

const SEARCH_HELPERS = `pn_search=\`https://photon.komoot.io/api/\`,_n_search=\`https://nominatim.openstreetmap.org/search\`,_ua_search=\`HUNDESALON-NIKA/1.0 (https://hundesalon-nika.com; weather-search)\`,_searchAliasMap=new Map([[\`гавайи\`,\`Hawaii, United States\`],[\`гавайи остроа\`,\`Hawaii, United States\`],[\`гавайи острова\`,\`Hawaii, United States\`],[\`hawaii islands\`,\`Hawaii, United States\`],[\`крым\`,\`Crimea\`],[\`крымский полуостров\`,\`Crimea\`],[\`сахалин\`,\`Sakhalin, Russia\`],[\`камчатка\`,\`Kamchatka, Russia\`],[\`сибирь\`,\`Siberia, Russia\`],[\`байкал\`,\`Lake Baikal, Russia\`],[\`кавказ\`,\`Caucasus\`],[\`бавария\`,\`Bavaria, Germany\`],[\`тироль\`,\`Tyrol, Austria\`],[\`прованс\`,\`Provence, France\`],[\`калифорния\`,\`California, United States\`],[\`флорида\`,\`Florida, United States\`],[\`тексас\`,\`Texas, United States\`],[\`аляска\`,\`Alaska, United States\`],[\`скандинавия\`,\`Scandinavia\`],[\`бали\`,\`Bali, Indonesia\`],[\`ибица\`,\`Ibiza, Spain\`],[\`мальдивы\`,\`Maldives\`],[\`сейшелы\`,\`Seychelles\`],[\`гаваї\`,\`Hawaii, United States\`],[\`гавайи\`,\`Hawaii, United States\`],[\`крим\`,\`Crimea\`],[\`сакалін\`,\`Sakhalin, Russia\`],[\`камчатка\`,\`Kamchatka, Russia\`],[\`каліфорнія\`,\`California, United States\`],[\`флорида\`,\`Florida, United States\`],[\`аляска\`,\`Alaska, United States\`],[\`hawaii\`,\`Hawaii, United States\`],[\`crimea\`,\`Crimea\`],[\`bavaria\`,\`Bavaria, Germany\`],[\`california\`,\`California, United States\`]]),_normSearchKey=e=>String(e||\`\`).trim().toLowerCase().replace(/\\s+/g,\` \`),_searchLanguages=e=>{let t=Z(e);return Array.from(new Set([t,\`en\`,\`de\`,\`\`]))},_pushSearchResult=(e,t,n)=>{let r=t.id||\`\${t.latitude},\${t.longitude}\`,i=t.label||An(t),a=\`\${r}:\${i}\`;return n.has(a)?e:(n.add(a),e.push({...t,label:i,query:t.query||jn(t)}),e)},_mapOpenMeteoSearchRow=(e,t)=>({id:\`\${e.latitude},\${e.longitude}\`,name:e.name||t,region:e.admin1||e.admin2||\`\`,country:e.country||\`\`,countryCode:e.country_code||\`\`,timezone:e.timezone||\`\`,latitude:e.latitude,longitude:e.longitude,label:An({name:e.name||t,region:e.admin1||e.admin2||\`\`,country:e.country||\`\`}),query:jn({name:e.name||t,region:e.admin1||e.admin2||\`\`,country:e.country||\`\`,latitude:e.latitude,longitude:e.longitude})}),_mapPhotonSearchRow=e=>{let t=e?.properties||{},n=Number(e?.geometry?.coordinates?.[1]),r=Number(e?.geometry?.coordinates?.[0]);if(!Number.isFinite(n)||!Number.isFinite(r))return null;let i=t.name||t.city||t.county||t.state||\`\`,a=t.state||t.county||t.district||\`\`,o=t.country||\`\`;return{id:\`\${n},\${r}\`,name:i,region:a,country:o,countryCode:String(t.countrycode||\`\`).trim().toUpperCase(),timezone:\`\`,latitude:n,longitude:r,label:[i,a,o].filter(Boolean).join(\`, \`),query:[i,a,o].filter(Boolean).join(\`, \`)}},_mapNominatimSearchRow=e=>{let t=e?.address||{},n=Number(e?.lat),r=Number(e?.lon);if(!Number.isFinite(n)||!Number.isFinite(r))return null;let i=Q(t.name,t.city,t.town,t.village,t.municipality,t.county,t.state,t.region,e?.display_name?.split(\`,\`)?.[0]),a=Q(t.state,t.region,t.state_district,t.county,t.municipality),o=Q(t.country);return{id:\`\${n},\${r}\`,name:i||\`\`,region:a||\`\`,country:o||\`\`,countryCode:String(t.country_code||\`\`).trim().toUpperCase(),timezone:\`\`,latitude:n,longitude:r,label:[i,a,o].filter(Boolean).join(\`, \`),query:[i,a,o].filter(Boolean).join(\`, \`)}},_fetchOpenMeteoSearch=async(e,t)=>{let n=[];for(let r of _searchLanguages(t)){let i={name:e,count:12,format:\`json\`};r&&(i.language=r);try{let t=await G.get(mn,{params:i,timeout:1e4});for(let r of t.data?.results||[])n.push(_mapOpenMeteoSearchRow(r,e))}catch{}}return n},_fetchPhotonSearch=async(e,t)=>{try{let n=await G.get(pn_search,{params:{q:e,limit:12,lang:Z(t)},timeout:1e4});return(n.data?.features||[]).map(_mapPhotonSearchRow).filter(Boolean)}catch{return[]}},_fetchNominatimSearch=async(e,t)=>{try{let n=Z(t),r=await G.get(_n_search,{params:{q:e,format:\`jsonv2\`,addressdetails:1,limit:12,"accept-language":n+",en,de"},headers:{Accept:\`application/json\`,"User-Agent":_ua_search},timeout:1e4});return(Array.isArray(r.data)?r.data:[]).map(_mapNominatimSearchRow).filter(Boolean)}catch{return[]}},_rankSearchResults=(e,t)=>{let n=_normSearchKey(t);return[...e].sort((e,t)=>{let r=e=>{let t=_normSearchKey(e.name),r=_normSearchKey(e.region),i=_normSearchKey(e.country),a=_normSearchKey(e.label);return t===n?0:t.startsWith(n)?1:a.includes(n)?2:r.includes(n)||i.includes(n)?3:9};return r(e)-r(t)})},`;

const NEW_SEARCH_LOCATIONS = `searchLocations:async(e,t={})=>{let n=Nn(e),r=Z(t.locale),i=_normSearchKey(n),a=new Set,o=[],s=_searchAliasMap.get(i),c=Array.from(new Set([n,s].filter(Boolean)));for(let e of c){for(let t of await _fetchOpenMeteoSearch(e,r))o=_pushSearchResult(o,t,a);if(o.length<6)for(let t of await _fetchPhotonSearch(e,r))o=_pushSearchResult(o,t,a);if(o.length<4)for(let t of await _fetchNominatimSearch(e,r))o=_pushSearchResult(o,t,a)}return _rankSearchResults(o,n).slice(0,12)}`;

let service = fs.readFileSync(servicePath, 'utf8');

if (service.includes('pn_search=')) {
  console.log('weatherService search helpers already patched');
} else {
  const anchor = 'searchLocations:async';
  if (!service.includes(anchor)) {
    console.error('searchLocations anchor not found');
    process.exit(1);
  }
  const start = service.indexOf(anchor);
  const end = service.indexOf('},getApproximateLocationByIp', start);
  if (end < 0) {
    console.error('searchLocations end anchor not found');
    process.exit(1);
  }
  service = service.slice(0, start) + NEW_SEARCH_LOCATIONS + service.slice(end + 1);
  service = service.replace('}},Hn=async(e,t=`en`)=>', `}},${SEARCH_HELPERS}Hn=async(e,t=\`en\`)=>`);
  fs.writeFileSync(servicePath, service);
  console.log('patched weatherService searchLocations');
}

const copyReplacements = [
  // ru
  ['searchPlaceholder:`Искать город...`', 'searchPlaceholder:`Искать место: страна, город, село, район...`'],
  ['searchResultsLabel:`Выберите город`', 'searchResultsLabel:`Выберите место`'],
  [
    'searchNoResults:`Города не найдены`',
    'searchNoResults:`Место не найдено. Уточните запрос или попробуйте на латинице.`',
  ],
  ['enterCityName:`Введите название города...`', 'enterCityName:`Введите страну, город, село или район...`'],
  [
    'locationUnavailable:`Не удалось определить вашу геопозицию. Введите город вручную.`',
    'locationUnavailable:`Не удалось определить геопозицию. Введите место вручную.`',
  ],
  [
    'locationPermissionDenied:`Разрешите доступ к геопозиции в браузере или введите город вручную.`',
    'locationPermissionDenied:`Разрешите геопозицию в браузере или введите место вручную.`',
  ],
  [
    'locationTimeout:`Не удалось получить координаты вовремя. Попробуйте ещё раз или введите город вручную.`',
    'locationTimeout:`Не удалось получить координаты вовремя. Введите место вручную.`',
  ],
  [
    'locationBlockedInBrowser:`Геопозиция работает только в защищённом режиме браузера. Откройте сайт через localhost/https или введите город вручную.`',
    'locationBlockedInBrowser:`Геопозиция доступна только через localhost/https. Введите место вручную.`',
  ],
  [
    'loadError:`Не удалось загрузить погоду. Попробуйте ввести город вручную.`',
    'loadError:`Не удалось загрузить погоду. Введите место вручную.`',
  ],
  // uk
  ['searchPlaceholder:`Введіть місто...`', 'searchPlaceholder:`Шукати місце: країна, місто, село, район...`'],
  ['searchResultsLabel:`Оберіть місто`', 'searchResultsLabel:`Оберіть місце`'],
  [
    'searchNoResults:`Міста не знайдено`',
    'searchNoResults:`Місце не знайдено. Уточніть запит або спробуйте латиницю.`',
  ],
  ['enterCityName:`Введіть назву міста...`', 'enterCityName:`Введіть країну, місто, село або район...`'],
  // de
  ['searchPlaceholder:`Stadt suchen...`', 'searchPlaceholder:`Ort suchen: Land, Stadt, Dorf, Region...`'],
  ['searchResultsLabel:`Stadt wählen`', 'searchResultsLabel:`Ort wählen`'],
  [
    'searchNoResults:`Keine passenden Städte`',
    'searchNoResults:`Kein Ort gefunden. Bitte genauer suchen oder lateinisch eingeben.`',
  ],
  ['enterCityName:`Stadtname eingeben...`', 'enterCityName:`Land, Stadt, Dorf oder Region eingeben...`'],
  // en
  ['searchPlaceholder:`Search city...`', 'searchPlaceholder:`Search place: country, city, village, region...`'],
  ['searchResultsLabel:`Choose a city`', 'searchResultsLabel:`Choose a place`'],
  [
    'searchNoResults:`No matching cities`',
    'searchNoResults:`No place found. Try a more specific name or Latin spelling.`',
  ],
  ['enterCityName:`Enter city name...`', 'enterCityName:`Enter country, city, village, or region...`'],
];

const widgetFiles = [
  'weather-widget.header-panel-preview.es.js',
  'weather-widget.header-panel-dropdown-scene.es.js',
  'weather-widget.es.js',
];

for (const file of widgetFiles) {
  const filePath = path.join(distDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = 0;
  for (const [from, to] of copyReplacements) {
    if (content.includes(from)) {
      content = content.replaceAll(from, to);
      changed += 1;
    }
  }
  if (changed > 0) {
    fs.writeFileSync(filePath, content);
    console.log(`updated copy in ${file} (${changed} strings)`);
  } else if (content.includes('Искать место:')) {
    console.log(`copy already updated in ${file}`);
  } else {
    console.warn(`no copy replacements applied in ${file}`);
  }
}
