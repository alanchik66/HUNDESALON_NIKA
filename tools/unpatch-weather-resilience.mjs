import fs from 'fs';

const filePath = '3d-weather-codrops-main/dist-widget/weatherService-iG8lrujy.mjs';
let source = fs.readFileSync(filePath, 'utf8');

const marker = 'hn_weather_resilience_v1';
if (!source.includes(marker)) {
  console.log('weatherService resilience patch is not present');
  process.exit(0);
}

const pattern = /Xn=\{getCurrentWeather:async\(e,t=\{\}\)=>\{[\s\S]*?\},searchLocations:async/;
if (!pattern.test(source)) {
  console.error('patched getCurrentWeather block not found');
  process.exit(1);
}

const original =
  'Xn={getCurrentWeather:async(e,t={})=>{let n=Pn(e),r=n.query,i=Z(t.locale);if(un)try{let e=await qn(r);if(e)return Wn(e,n,i)}catch(e){if(On(e))throw e.response?.data?.error?Error(e.response.data.error):X();if(!kn(e))throw e}if(pn)try{return Wn(await Jn(r),n,i)}catch(e){if(On(e))throw e.response?.data?.error?Error(e.response.data.error):X();if(!kn(e))throw e}try{return await Yn(n,{locale:i})}catch(e){throw On(e)?X():e.response?.data?.reason?Error(e.response.data.reason):Error(`Unable to load weather data right now.`)}},searchLocations:async';

source = source.replace(pattern, original);
fs.writeFileSync(filePath, source);
console.log('weatherService resilience patch removed');
