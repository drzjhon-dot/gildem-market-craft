import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {aggregateTopMarket,topMarketCatalogIds} from '../core/top-market.js';
const now=Date.UTC(2026,10,11,14); // día 11 todavía abierto
const p=(day,count,avg_price)=>({timestamp:`2026-11-${String(day).padStart(2,'0')}T00:00:00`,item_count:count,avg_price});

test('Top Mercado suma calidades 1-5, deduplica y excluye el día UTC incompleto',()=>{
 const data=[
  {item_id:'T5_2H_FLAIL',location:'Black Market',quality:1,data:[p(10,42,1000),p(9,18,1000),p(11,1000,1000)]},
  {item_id:'T5_2H_FLAIL',location:'Black Market',quality:2,data:[p(10,25,2000)]},
  {item_id:'T5_2H_FLAIL',location:'Black Market',quality:2,data:[p(10,25,2000)]}, // repetido por API
  {item_id:'T5_2H_FLAIL',location:'Black Market',quality:3,data:[p(8,12,4000)]},
  {item_id:'T5_2H_FLAIL',location:'Black Market',quality:5,data:[p(7,3,10000)]},
  {item_id:'T5_2H_FLAIL',location:'Black Market',quality:6,data:[p(10,999,1000)]}, // calidad inexistente
 ];
 const rows=aggregateTopMarket(data,{days:7,now});
 assert.equal(rows.length,1);
 const a=rows[0];
 assert.equal(a.totalUnits,100);
 assert.equal(a.activeDays,4);
 assert.equal(a.dailyAmount,100/7);
 assert.equal(a.unitPrice,(60*1000+25*2000+12*4000+3*10000)/100);
 assert.deepEqual(a.qualities,[1,2,3,5]);
 assert.equal(a.periodStart,'2026-11-04');
 assert.equal(a.periodEnd,'2026-11-10');
});

test('universo de mazas: T4.0 a T8.0, .1, sin receta y T3 existente',()=>{
 const ids=['T3_MAIN_MACE','T4_MAIN_MACE','T5_2H_FLAIL','T6_MAIN_MACE','T4_MAIN_MACE@1','T7_2H_FLAIL@2','T8_MAIN_MACE','T5_MAIN_ROCKMACE_KEEPER@3'];
 const names=Object.fromEntries(ids.map(x=>[x,'Nombre']));
 const recipes={'T4_MAIN_MACE':{materials:[{id:'x'}],city:'Thetford'}};
 const r=topMarketCatalogIds(recipes,names,['mace'],{limit:200});
 assert.equal(r.available,ids.length);
 assert.equal(r.truncated,false);
 assert.deepEqual(new Set(r.ids),new Set(ids));
 assert(r.ids.indexOf('T6_MAIN_MACE')<r.ids.indexOf('T4_MAIN_MACE@1'));
 const short=topMarketCatalogIds(recipes,names,['mace'],{limit:3});
 assert(short.truncated);assert.equal(short.ids.length,3);
});

test('Top Mercado usa historia de calidades 1-5 sin cambiar historia del motor de craft',()=>{
 const data=readFileSync(new URL('../core/data.js',import.meta.url),'utf8');
 assert(data.includes("export const historyTopMarket="));
 assert(data.includes("qualities:'1,2,3,4,5'"));
 assert(data.includes("export const history=(ids,region='west',force=false)=>api('history',ids,region"));
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert(app.includes('historyTopMarket(ids,prefs.region,force,input.cities,input.days)'));
 assert(app.includes('topMarketCatalogIds(recipes,names,input.branches'));
 assert(app.includes('no garantizan demanda ejecutable'));
});


test('Top Mercado interpreta timestamps AODP sin zona como UTC, no hora del navegador',()=>{
 const original=process.env.TZ;
 try{
  process.env.TZ='America/New_York';
  const m={item_id:'T4_MAIN_MACE',quality:1,location:'Black Market',data:[
   {timestamp:'2026-11-10T23:55:00',item_count:12,avg_price:1000},
   {timestamp:'2026-11-11T00:05:00',item_count:300,avg_price:1000}
  ]};
  const row=aggregateTopMarket([m],{days:7,now:Date.UTC(2026,10,11,14)})[0];
  assert(row);assert.equal(row.totalUnits,12);assert.equal(row.activeDays,1);
 }finally{if(original===undefined)delete process.env.TZ;else process.env.TZ=original;}
});

test('el proxy Netlify conserva las fechas UTC y calidades del Top Mercado',async()=>{
 const {default:market}=await import('../netlify/functions/market.mjs');
 const fetchOriginal=globalThis.fetch;
 const requests=[];
 try{
  globalThis.fetch=async url=>{
   requests.push(String(url));
   return new Response('[]',{status:200,headers:{'content-type':'application/json'}});
  };
  const params=new URLSearchParams({region:'west',kind:'history',items:'T4_MAIN_MACE',locations:'Black Market',qualities:'1,2,3,4,5','time-scale':'24',date:'2026-11-04',end_date:'2026-11-11'});
  const result=await market(new Request('https://example.netlify.app/.netlify/functions/market?'+params));
  assert.equal(result.status,200);
  assert.equal(requests.length,1);
  const remote=new URL(requests[0]);
  assert.equal(remote.hostname,'west.albion-online-data.com');
  for(const k of ['date','end_date','qualities','locations','time-scale'])assert.equal(remote.searchParams.get(k),params.get(k));
 }finally{globalThis.fetch=fetchOriginal;}
});
