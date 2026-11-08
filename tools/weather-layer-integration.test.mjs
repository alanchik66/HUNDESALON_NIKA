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

test('current rain uses current measurements and selected forecast uses its own daily condition/amount/wind',()=>{
  const current=headerWeatherRainOptions({...host,__weatherCurrentMeta:{weatherCode:61,precipitation:2,windSpeedKph:22,windDirection:240}});
  assert.deepEqual(current,{kind:'rain',precipitationMm:2,windKph:22,windDegree:240});
  const forecast={day:{condition:{code:1240,text:'Rain showers'},totalprecip_mm:24,avgwind_kph:15,maxwind_kph:35,wind_degree:120}};
  assert.deepEqual(headerWeatherRainOptions(host,forecast),{kind:'rain',precipitationMm:1,windKph:15,windDegree:120});
  assert.equal(headerWeatherRainOptions(host,{day:{condition:{code:1210,text:'Light snow'},totalprecip_mm:8}}).kind,'none');
  assert.equal(headerWeatherRainOptions(host,{day:{condition:{code:1072,text:'Patchy freezing drizzle'},totalprecip_mm:2}}).kind,'rain');
  assert.equal(headerWeatherRainOptions(host,{day:{condition:{code:1000,text:'Clear'},totalprecip_mm:0}}).kind,'none');
});

test('legacy rain remains until a successful native create and pending updates commit the latest forecast only',async()=>{
  const pending=deferred(),factory=layerFactory(),h=regionFixture(),m=await machine(()=>pending.promise);
  m.syncHeaderWeatherRain(h.region,{host});assert.equal(h.attrs.get('data-weather-native-rain'),'loading');
  m.syncHeaderWeatherRain(h.region,{host,forecast:{day:{condition:{code:1000,text:'Clear'},totalprecip_mm:0}}});
  assert.equal(factory.creates.length,0);pending.resolve(factory.module);await flush();
  assert.equal(h.attrs.get('data-weather-native-rain'),'ready');assert.equal(factory.creates[0].kind,'none');
  m.syncHeaderWeatherRain(h.region,{host});assert.equal(factory.updates[0].kind,'rain');
  factory.fail();m.syncHeaderWeatherRain(h.region,{host});assert.equal(h.attrs.has('data-weather-native-rain'),false);assert.equal(factory.disposals,1);
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

test('clearing and remounting a ShadowRoot reinstalls fallback rain suppression without changing stars or snow',async()=>{
  const factory=layerFactory(),h=regionFixture(),m=await machine(async()=>factory.module);
  m.syncHeaderWeatherRain(h.region,{host});await flush();const old=h.root.children[0];
  assert.match(old.textContent,/recovery--rainy/);assert.match(old.textContent,/recovery--stormy/);assert.doesNotMatch(old.textContent,/snowy|stars/);
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
  const lightningBindings={jsxRuntime,WeatherRain,WeatherCloudLayer:()=>{},React:{useRef:()=>({current:null})},P:()=>{},h:()=>{},d:{},O:()=>{}};
  const lightning=new Function(...Object.keys(lightningBindings),`return ${variable(text,'WeatherLightning')};`)(...Object.values(lightningBindings));
  for(const compact of [false,true])for(const externalRain of [false,true])assert.equal(flatten(lightning({compact,externalRain})).filter(node=>node.type===WeatherRain).length,externalRain?0:1);
});

test('an unresolved optional rain import cannot delay the real astronomy clock loader',async()=>{
  const text=await shell,clock={solarPosition:()=>{}},calls=[],pending=deferred();
  const code=['loadHeaderWeatherSolarClockModule','syncHeaderWeatherRainLayer'].map(name=>declaration(text,name)).join('\n').replace(/\bimport\s*\(/g,'loadModule(');
  const loadModule=url=>{calls.push(url);return url.includes('rain-integration')?pending.promise:Promise.resolve({skyClock:clock});};
  const api=new Function('loadModule','resolveHeaderWeatherSunSceneModuleUrl','performance',`let headerWeatherSolarClockModulePromise=null,headerWeatherSolarClockModuleRetry=0,headerWeatherRainIntegration,headerWeatherRainRetryAt=0;${code};return{loadHeaderWeatherSolarClockModule,syncHeaderWeatherRainLayer};`)(loadModule,()=> 'https://preview.example/assets/js/header-weather-sun-scene.js?v=current',{now:()=>1000});
  api.syncHeaderWeatherRainLayer({},{});assert.equal(await api.loadHeaderWeatherSolarClockModule(),clock);
  assert.equal(calls.length,2);assert.ok(calls[0].includes('rain-integration'));pending.resolve({});await flush();
});
