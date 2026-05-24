import fs from 'fs';

const filePath = '3d-weather-codrops-main/dist-widget/weatherService-iG8lrujy.mjs';
let source = fs.readFileSync(filePath, 'utf8');

const marker = 'hn_weather_resilience_v1';
if (source.includes(marker)) {
  console.log('weatherService resilience patch already applied');
  process.exit(0);
}

const pattern = /Xn=\{getCurrentWeather:async\(e,t=\{\}\)=>\{[\s\S]*?\},searchLocations:async/;
if (!pattern.test(source)) {
  console.error('getCurrentWeather block not found');
  process.exit(1);
}

const replacement = `Xn={getCurrentWeather:async(e,t={})=>{let n=Pn(e),r=n.query,i=Z(t.locale),a=\`hn_weather_resilience_v1:\${i}:\${r}\`,o=(e,t=!1)=>{if(!e)return null;let n=Date.now(),r=Number(e.expiresAt),i=Number(e.savedAt);if(Number.isFinite(r)&&r>=n)return e.data||null;if(t&&Number.isFinite(i)&&n-i<1728e5)return e.data||null;return null},s=e=>{if(!e||typeof localStorage>\`u\`)return null;try{let t=localStorage.getItem(a);if(!t)return null;let n=JSON.parse(t);return o(n,e)}catch{return null}},c=e=>{if(!e||typeof localStorage>\`u\`)return e;try{localStorage.setItem(a,JSON.stringify({savedAt:Date.now(),expiresAt:Date.now()+18e5,data:e}))}catch{}return e},l=s(!1),u=s(!0),d=e=>{if(u&&u.location){let t=Object.assign({},u,{stale:!0,fromCache:!0});return t.location=Object.assign({},u.location,{name:u.location.name||n.location?.name||n.query,query:u.location.query||r}),t}return null},f=async()=>{let e;for(let t=0;t<3;t++)try{return await Yn(n,{locale:i})}catch(n){if(e=n,!kn(n)||t===2)break;await new Promise(e=>setTimeout(e,350*(t+1)))}throw e};if(un)try{let e=await qn(r);if(e)return c(Wn(e,n,i))}catch(e){if(On(e)){let t=d(e);if(t)return t;throw e.response?.data?.error?Error(e.response.data.error):X()}if(!kn(e)){let t=d(e);if(t)return t;throw e}}if(pn)try{return c(Wn(await Jn(r),n,i))}catch(e){if(On(e)){let t=d(e);if(t)return t;throw e.response?.data?.error?Error(e.response.data.error):X()}if(!kn(e)){let t=d(e);if(t)return t;throw e}}try{return c(await f())}catch(e){let t=d(e);if(t)return t;throw On(e)?X():e.response?.data?.reason?Error(e.response.data.reason):Error(\`Unable to load weather data right now.\`)}},searchLocations:async`;

source = source.replace(pattern, replacement);
fs.writeFileSync(filePath, source);
console.log('weatherService resilience patch applied');
