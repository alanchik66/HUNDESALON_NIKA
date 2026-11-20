import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'espree';
import { headerWeatherRainOptions } from '../assets/js/header-weather-rain-integration.js';
import * as cloudMotion from '../assets/js/weather-cloud-motion.js';

const source = path => readFile(new URL(path,import.meta.url),'utf8');
const integration = source('../assets/js/header-weather-rain-integration.js');
const shell = source('../assets/js/site-shell.js');
const scene = source('../3d-weather-codrops-main/src/scene.mjs');
function find(ast,predicate) {
  if(!ast||typeof ast!=='object')return;
  if(predicate(ast))return ast;
  for(const[key,value]of Object.entries(ast))if(key!=='range'){
    if(Array.isArray(value)){for(const item of value){const result=find(item,predicate);if(result)return result;}}
    else{const result=find(value,predicate);if(result)return result;}
  }
}
function declaration(text,name) {
  const ast=parse(text,{ecmaVersion:'latest',sourceType:text.includes('import ')?'module':'script',range:true});
  const node=find(ast,node=>node.type==='FunctionDeclaration'&&node.id?.name===name);
  assert.ok(node,name);return text.slice(...node.range);
}
function variable(text,name) {
  const ast=parse(text,{ecmaVersion:'latest',sourceType:'module',range:true});
  const node=find(ast,node=>node.type==='VariableDeclarator'&&node.id?.name===name);
  assert.ok(node,name);return text.slice(...node.init.range);
}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function regionFixture(){
  const root={children:[],append(node){this.children.push(node);node.parentNode=this;}},attrs=new Map(),children=[];
  const region={isConnected:true,children,ownerDocument:{createElement:()=>({})},getRootNode:()=>root,
    setAttribute:(key,value)=>attrs.set(key,value),removeAttribute:key=>attrs.delete(key),getAttribute:key=>attrs.get(key)??null,
    querySelector:()=>children.find(node=>node.dataset?.weatherLayer==='rain')??null,contains:node=>children.includes(node)};
  return{region,root,attrs};
}
async function machine(loader){
  let time=1000;
  const code=(await integration).replace(/\bexport\s+/g,'').replace(/\bimport\.meta\b/g,'meta').replace(/\bimport\s*\(/g,'loadModule(');
  const api=new Function('loadModule','meta','globalThis',`${code};return{syncHeaderWeatherRain,disposeHeaderWeatherRain};`)(loader,{url:'https://preview.example/assets/js/header-weather-rain-integration.js?v=qa'},{performance:{now:()=>time}});
  return{...api,advance:value=>{time+=value;}};
}
function layerFactory(){
  const creates=[],updates=[];let disposals=0,failUpdate=false;
  const createHeaderWeatherRainLayer=(region,options)=>{
    const canvas={dataset:{weatherLayer:'rain'}};region.children.push(canvas);creates.push({...options});
    return{update(value){if(failUpdate)throw Error('update failed');updates.push({...value});},dispose(){disposals++;region.children.splice(region.children.indexOf(canvas),1);}};
  };
  return{module:{createHeaderWeatherRainLayer},creates,updates,get disposals(){return disposals;},fail(){failUpdate=true;}};
}
const host={__weatherWidgetData:{current:{condition:{code:1183,text:'Light rain'},precip_mm:1,wind_kph:10,wind_degree:90}}};

test('current precipitation uses an explicit hourly rate and forecasts retain their own category without inventing a rate',()=>{
  const current=headerWeatherRainOptions({...host,__weatherCurrentMeta:{weatherCode:61,precipitation:2,precipitationRateMmPerHour:2,windSpeedKph:22,windDirection:240}});
  assert.deepEqual(current,{kind:'rain',precipitationMm:2,intensity:'light',showers:false,windKph:22,windDegree:240});
  const forecast={day:{condition:{code:1240,text:'Rain showers'},totalprecip_mm:24,avgwind_kph:15,maxwind_kph:35,wind_degree:120}};
  assert.deepEqual(headerWeatherRainOptions(host,forecast),{kind:'rain',precipitationMm:null,intensity:'light',showers:true,windKph:15,windDegree:120});
  assert.equal(headerWeatherRainOptions(host,{day:{condition:{code:1210,text:'Light snow'},totalprecip_mm:8}}).kind,'none');
  assert.equal(headerWeatherRainOptions(host,{day:{condition:{code:1072,text:'Patchy freezing drizzle'},totalprecip_mm:2}}).kind,'drizzle');
  assert.equal(headerWeatherRainOptions(host,{day:{condition:{code:1000,text:'Clear'},totalprecip_mm:0}}).kind,'none');
});

test('precipitation windows normalize rates while missing intervals and dry weather cannot invent current rain',()=>{
  for(const [seconds,amount,rate] of [[600,.5,3],[1800,1.5,3],[3600,3,3],[900,.75,3]]){
    const result=headerWeatherRainOptions({__weatherWidgetData:{current:{condition:{code:1183,text:'Rain'}}},__weatherCurrentMeta:{weatherCode:63,precipitation:amount,precipitationIntervalSeconds:seconds}});
    assert.equal(result.precipitationMm,rate);
    assert.equal(result.intensity,'moderate');
  }
  assert.equal(headerWeatherRainOptions({...host,__weatherCurrentMeta:{source:'dwd-bright-sky',weatherCode:63,precipitation:3}}).precipitationMm,null);
  assert.equal(headerWeatherRainOptions({...host,__weatherCurrentMeta:{weatherCode:99,precipitation:null,precipitationIntervalSeconds:900},__weatherWidgetData:{current:{condition:{code:1276,text:'Thunderstorm with hail'},precip_mm:0}}}).precipitationMm,null,'unknown authoritative amount cannot become legacy zero');
  assert.equal(headerWeatherRainOptions({...host,__weatherCurrentMeta:{weatherCode:0,precipitationRateMmPerHour:4}}).kind,'none','past accumulation does not override an explicitly clear condition');
  for(const invalid of [null,undefined,'',false,true,[],{},NaN,Infinity,-1]){
    assert.doesNotThrow(()=>headerWeatherRainOptions({...host,__weatherCurrentMeta:{weatherCode:63,precipitation:invalid,precipitationIntervalSeconds:invalid,precipitationRateMmPerHour:invalid}}));
    assert.equal(headerWeatherRainOptions({...host,__weatherCurrentMeta:{weatherCode:63,precipitationRateMmPerHour:invalid}}).precipitationMm,null);
  }
});

test('precipitation categories preserve drizzle, showers and hail in every locale, with snow and ice pellets excluded',()=>{
  const classify=(code,text='')=>headerWeatherRainOptions({__weatherWidgetData:{current:{condition:{code,text}}}});
  for(const code of [51,53,55,56,57,1072,1150,1153,1168,1171])assert.equal(classify(code).kind,'drizzle');
  for(const code of [96,99])assert.equal(classify(code).kind,'hail');
  for(const text of ['Hail','Hagel','Град','Град із дощем'])assert.equal(classify(NaN,text).kind,'hail');
  assert.equal(classify(1273,'Thunderstorm with hail').kind,'hail','generic provider thunder code retains explicit hail text');
  for(const code of [71,73,75,77,85,86,1237,1261,1264,1279,1282])assert.equal(classify(code).kind,'none');
  for(const code of [80,81,82,1240,1243,1246,1249,1252])assert.equal(classify(code).showers,true);
  for(const code of [1069,1204,1207,1249,1252])assert.equal(classify(code).kind,'mixed');
  for(const text of ['Rain and snow','Wet snow','Schneeregen','Мокрый снег','Мокрий сніг'])assert.equal(classify(NaN,text).kind,'mixed');
  assert.equal(classify(67,'Freezing rain').kind,'rain');
  const mixed=headerWeatherRainOptions({...host,__weatherCurrentMeta:{weatherCode:67,precipitationKind:'mixed'}});
  assert.equal(mixed.kind,'mixed');assert.equal(mixed.intensity,'light');
  for(const [code,intensity] of [[61,'light'],[63,'moderate'],[65,'heavy'],[80,'light'],[81,'moderate'],[82,'violent'],[96,'light'],[97,'heavy'],[99,'heavy'],[1195,'heavy']])assert.equal(classify(code).intensity,intensity);
  const forecast=headerWeatherRainOptions(host,{day:{weatherCode:99,condition:{code:1273,text:'Thunderstorm'},totalprecip_mm:48}});
  assert.equal(forecast.kind,'hail');assert.equal(forecast.precipitationMm,null);assert.equal(forecast.intensity,'heavy');
});

test('the shared header label retains hail and heavy thunderstorms in all four languages',async()=>{
  const resolve=new Function('getHeaderWeatherConditionCode','getHeaderWeatherPressureLang','getHeaderWeatherConditionText',`${declaration(await shell,'resolveHeaderWeatherConditionLabel')};return resolveHeaderWeatherConditionLabel;`)(h=>h.code,h=>h.lang,h=>h.text||'');
  for(const [lang,hail,thunder]of [['ru','Гроза с градом','Гроза'],['uk','Гроза з градом','Гроза'],['de','Gewitter mit Hagel','Gewitter'],['en','Thunderstorm with hail','Thunderstorm']]){
    for(const code of [96,99,1273,1276])assert.equal(resolve({code,lang,text:'Thunderstorm with hail'}),hail);
    assert.equal(resolve({code:97,lang}),thunder);
    assert.equal(resolve({code:1276,lang,text:'Moderate or heavy rain with thunder'}),thunder);
  }
});

test('legacy rain remains until a successful native create and pending updates commit the latest forecast only',async()=>{
  const pending=deferred(),factory=layerFactory(),h=regionFixture(),m=await machine(()=>pending.promise);
  m.syncHeaderWeatherRain(h.region,{host});assert.equal(h.attrs.get('data-weather-native-rain'),'loading');
  m.syncHeaderWeatherRain(h.region,{host,forecast:{day:{condition:{code:1000,text:'Clear'},totalprecip_mm:0}}});
  assert.equal(factory.creates.length,0);pending.resolve(factory.module);await flush();
  assert.equal(h.attrs.get('data-weather-native-rain'),'ready');assert.equal(factory.creates[0].kind,'none');
  m.syncHeaderWeatherRain(h.region,{host});assert.equal(factory.updates[0].kind,'rain');
  const forecast={day:{condition:{code:1204,text:'Light sleet'}}};
  m.syncHeaderWeatherRain(h.region,{host,forecast});assert.equal(h.attrs.get('data-weather-native-precipitation'),'mixed');
  m.syncHeaderWeatherRain(h.region,{host});assert.equal(h.attrs.has('data-weather-native-precipitation'),false);
  m.syncHeaderWeatherRain(h.region,{host,forecast});
  factory.fail();m.syncHeaderWeatherRain(h.region,{host});assert.equal(h.attrs.has('data-weather-native-rain'),false);
  assert.equal(h.attrs.has('data-weather-native-precipitation'),false);assert.equal(factory.disposals,1);
});

test('optional import failure preserves legacy rain and retry is bounded rather than requested each clock tick',async()=>{
  let loads=0;const factory=layerFactory(),h=regionFixture(),m=await machine(async()=>{loads++;if(loads===1)throw Error('module unavailable');return factory.module;});
  m.syncHeaderWeatherRain(h.region,{host});await flush();assert.equal(h.attrs.has('data-weather-native-rain'),false);
  for(let i=0;i<10;i++){m.advance(1000);m.syncHeaderWeatherRain(h.region,{host});}assert.equal(loads,1);
  m.advance(6000);m.syncHeaderWeatherRain(h.region,{host});await flush();assert.equal(loads,2);assert.equal(h.attrs.get('data-weather-native-rain'),'ready');
});

test('detached/pending regions, removed rain canvases and explicit host teardown release tracked controllers',async()=>{
  const pending=deferred(),factory=layerFactory(),a=regionFixture(),b=regionFixture(),m=await machine(()=>pending.promise);
  m.syncHeaderWeatherRain(a.region,{host});a.region.isConnected=false;m.disposeHeaderWeatherRain({});
  pending.resolve(factory.module);await flush();assert.equal(factory.creates.length,0);
  m.syncHeaderWeatherRain(b.region,{host});await flush();assert.equal(factory.creates.length,1);
  const canvas=b.region.children[0];b.region.children.length=0;m.disposeHeaderWeatherRain(canvas);assert.equal(factory.disposals,1);
  m.syncHeaderWeatherRain(b.region,{host});await flush();m.disposeHeaderWeatherRain({contains:node=>node===b.region});assert.equal(factory.disposals,2);
  assert.equal(b.attrs.has('data-weather-native-rain'),false);
});

test('remounting reinstalls suppression scoped to rain and to ready mixed snowfall',async()=>{
  const factory=layerFactory(),h=regionFixture(),m=await machine(async()=>factory.module);
  m.syncHeaderWeatherRain(h.region,{host});await flush();const old=h.root.children[0];
  assert.match(old.textContent,/recovery--rainy/);assert.match(old.textContent,/recovery--stormy/);
  assert.ok(old.textContent.includes('[data-weather-native-precipitation="mixed"] .weather-scene-recovery--snowy'));
  assert.doesNotMatch(old.textContent,/stars/);
  m.disposeHeaderWeatherRain(h.region);old.parentNode=null;h.root.children.length=0;
  m.syncHeaderWeatherRain(h.region,{host});await flush();assert.equal(h.root.children.length,1);assert.notEqual(h.root.children[0],old);
});

test('the real React readiness hook defaults to legacy and restores it after a native failure',async()=>{
  const text=await scene,updates=[],observers=[];let cleanup;
  const React={useState:()=>[false,value=>updates.push(value)],useEffect:callback=>{cleanup=callback();}};
  class Observer{constructor(callback){this.callback=callback;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}
  const hook=new Function('React','MutationObserver',`${declaration(text,'useHeaderNativeRain')};return useHeaderNativeRain;`)(React,Observer);
  const h=regionFixture();h.attrs.set('data-weather-native-rain','loading');
  hook({current:{closest:()=>h.region}},true);assert.deepEqual(updates,[false]);
  h.attrs.set('data-weather-native-rain','ready');observers[0].callback();assert.equal(updates.at(-1),true);
  h.attrs.delete('data-weather-native-rain');observers[0].callback();assert.equal(updates.at(-1),false);cleanup();assert.equal(observers[0].disconnected,true);
  hook({current:null},false);assert.equal(updates.at(-1),false);
});

test('actual rainy and lightning React branches suppress only legacy rain after native readiness',async()=>{
  const text=await scene,WeatherRain=()=>{},WeatherClouds=()=>{},WeatherSnow=()=>{},WeatherLightning=()=>{};
  const jsxRuntime={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  const bindings={jsxRuntime,cloudMotion,CloudMotionContext:{Provider:()=>{}},WeatherRain,WeatherClouds,WeatherSnow,WeatherLightning,isPartlyCloudy:()=>false,weatherConditionType:value=>value,LegacyMoonPlaceholder:()=>{},LegacySunPlaceholder:()=>{}};
  const icon=new Function(...Object.keys(bindings),`return ${variable(text,'WeatherIcon')};`)(...Object.values(bindings));
  const flatten=node=>node&&typeof node==='object'?[node,...(Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).flatMap(flatten)]:[];
  for(const ready of [false,true]){
    const nodes=flatten(icon({weatherData:{location:{localtime:'2026-11-07 12:00'},current:{condition:{text:'rainy'}}},showConditionLabel:false,variant:'header-panel',externalRain:ready}));
    assert.equal(nodes.filter(node=>node.type===WeatherRain).length,ready?0:1);assert.equal(nodes.filter(node=>node.type===WeatherClouds).length,1);
  }
  const cloudTextureUrl=new URL('https://preview.example/assets/images/weather/cloud-9225a9f1.png?v=fixture');
  const lightningBindings={jsxRuntime,WeatherRain,WeatherCloudLayer:()=>{},React:{useRef:()=>({current:null})},P:()=>{},h:()=>{},d:{},O:()=>{},cloudTextureUrl};
  const lightning=new Function(...Object.keys(lightningBindings),`return ${variable(text,'WeatherLightning')};`)(...Object.values(lightningBindings));
  for(const compact of [false,true])for(const externalRain of [false,true]){
    const nodes=flatten(lightning({compact,externalRain}));
    assert.equal(nodes.filter(node=>node.type===WeatherRain).length,externalRain?0:1);
    const clouds=nodes.filter(node=>node.type===lightningBindings.h);
    assert.equal(clouds.length,1);
    assert.equal(clouds[0].props.texture,cloudTextureUrl.href,'both lightning layouts must load the canonical local cloud atlas');
  }
});

test('every authored cloud container supplies the local atlas instead of relying on the vendor CDN default',async()=>{
  const text=await scene,ast=parse(text,{ecmaVersion:'latest',sourceType:'module',range:true}),containers=[];
  find(ast,node=>{
    if(node.type==='CallExpression'&&node.arguments[0]?.name==='h'&&node.arguments[1]?.type==='ObjectExpression')containers.push(node.arguments[1]);
    return false;
  });
  assert.equal(containers.length,6,'four weather profiles and both lightning layouts are covered');
  for(const container of containers){
    const texture=container.properties.find(property=>property.key?.name==='texture')?.value;
    assert.equal(texture?.type,'MemberExpression');
    assert.equal(texture.object.name,'cloudTextureUrl');
    assert.equal(texture.property.name,'href');
  }
});

test('an unresolved optional rain import cannot delay the real astronomy clock loader',async()=>{
  const text=await shell,clock={solarPosition:()=>{}},calls=[],pending=deferred();
  const code=['loadHeaderWeatherSolarClockModule','syncHeaderWeatherRainLayer'].map(name=>declaration(text,name)).join('\n').replace(/\bimport\s*\(/g,'loadModule(');
  const loadModule=url=>{calls.push(url);return url.includes('rain-integration')?pending.promise:Promise.resolve({skyClock:clock});};
  const api=new Function('loadModule','resolveHeaderWeatherSunSceneModuleUrl','performance',`let headerWeatherSolarClockModulePromise=null,headerWeatherSolarClockModuleRetry=0,headerWeatherRainIntegration,headerWeatherRainRetryAt=0;${code};return{loadHeaderWeatherSolarClockModule,syncHeaderWeatherRainLayer};`)(loadModule,()=> 'https://preview.example/assets/js/header-weather-sun-scene.js?v=current',{now:()=>1000});
  api.syncHeaderWeatherRainLayer({},{});assert.equal(await api.loadHeaderWeatherSolarClockModule(),clock);
  assert.equal(calls.length,2);assert.ok(calls[0].includes('rain-integration'));pending.resolve({});await flush();
});
