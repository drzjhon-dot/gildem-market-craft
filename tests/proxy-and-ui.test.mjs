import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import proxy from '../netlify/functions/market.mjs';
import {simulateItem,DEFAULTS} from '../src/planner.js';
import {quoteMap} from '../src/market.js';
const time=new Date().toISOString();
function apiRequest(query){return new Request('https://gildem.test/.netlify/functions/market?'+new URLSearchParams(query));}
const basic={kind:'prices',items:'T6_MAIN_AXE,T6_METALBAR',locations:'Martlock,Black Market',qualities:'1'};
test('proxy: prohíbe regiones extrañas, IDs maliciosos y ciudades no autorizadas',async()=>{
 for(const patch of [{items:'http://evil'},{locations:'Shanghai'},{qualities:'1,6'},{kind:'delete'},
  {items:Array.from({length:46},(_,i)=>`T6_ITEM_${i}`).join(',')}]){
  const r=await proxy(apiRequest({...basic,...patch}));assert.equal(r.status,400);
 }
});
test('proxy: West es el único host y el forzar evita caché de función',async()=>{
 const prev=globalThis.fetch,calls=[];
 globalThis.fetch=async(uri,options)=>{calls.push(String(uri));return new Response(JSON.stringify([]),{status:200,headers:{'content-type':'application/json'}});};
 try{
  const one=await proxy(apiRequest(basic));assert.equal(one.status,200);assert.equal(one.headers.get('x-gildem-cache'),'MISS');
  const two=await proxy(apiRequest(basic));assert.equal(two.headers.get('x-gildem-cache'),'HIT');
  const three=await proxy(apiRequest({...basic,refresh:'1'}));assert.equal(three.headers.get('x-gildem-cache'),'MISS');
  assert.equal(calls.length,2);assert(calls.every(x=>x.startsWith('https://west.albion-online-data.com/api/v2/stats/prices/')));
 }finally{globalThis.fetch=prev;}
});
test('proxy: History exige ventanas UTC válidas y devuelve 429 sin generar datos',async()=>{
 let r=await proxy(apiRequest({...basic,kind:'history',date:'2026-11-01',end_date:'2026-12-15'}));assert.equal(r.status,400);
 const previous=globalThis.fetch;globalThis.fetch=async()=>new Response('{}',{status:429});
 try{r=await proxy(apiRequest({...basic,kind:'history',date:'2026-11-07',end_date:'2026-11-11'}));assert.equal(r.status,429);assert.match((await r.json()).error,/límite/);}
 finally{globalThis.fetch=previous;}
});
test('simulador individual: resultado negativo explícito, sin filtrarlo; cuotas y cantidad exactas',()=>{
 const recipes={T5_MAIN_AXE:{city:'Martlock',materials:[{id:'T5_METALBAR',count:10}]}};
 const quotations=quoteMap([
  {item_id:'T5_METALBAR',city:'Martlock',quality:1,sell_price_min:5000,sell_price_min_date:time},
  {item_id:'T5_MAIN_AXE',city:'Black Market',quality:1,buy_price_max:14000,buy_price_max_date:time}
 ]);
 const out=simulateItem({id:'T5_MAIN_AXE',city:'Black Market',qty:3,quotes:quotations,recipes,config:DEFAULTS});
 assert(out.profit<0);assert.equal(out.qty,3);assert.equal(out.units,3);assert(out.capital>out.cost);
 assert.throws(()=>simulateItem({id:'T5_MAIN_AXE',city:'Black Market',qty:0,quotes:quotations,recipes}),/crafts/);
});
test('interfaz: exclusivamente dos pestañas, filtros esenciales y exportación, todas enlazadas',()=>{
 const html=readFileSync('index.html','utf8'),js=readFileSync('src/main.js','utf8'),css=readFileSync('styles.css','utf8');
 assert.equal((html.match(/data-route=/g)||[]).length,2);
 for(const token of ['data-route="top"','data-route="calc"','/src/main.js'])assert(html.includes(token),token);
 for(const token of ['data-group-all','data-branch','data-mark','force-top','run-plan','single-run','data-cfg="diversify"','data-cfg="focus"','data-cfg="budget"','export-plan','marketFetch(\'history\'','marketFetch(\'prices\''])assert(js.includes(token),token);
 assert(css.includes('@media(max-width:680px)'));
});
