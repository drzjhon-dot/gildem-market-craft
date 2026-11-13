import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import marketProxy from '../netlify/functions/market.mjs';
import {REGION,NUMERIC_SOURCE,WEST_MARKET_SOURCES} from '../core/server-policy.js';
const code=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('v9.11.0: único proveedor numérico de mercado AODP West, sin importaciones externas',()=>{
 assert.equal(REGION,'west');
 assert.equal(NUMERIC_SOURCE.base,'https://west.albion-online-data.com');
 assert.equal(WEST_MARKET_SOURCES.length,0);
 const app=code('app.js');
 for(const obsolete of ['market-volume-paste','saveExternalMarketVolume','externalDaily(snapshot','marketReferencesPanel(','checkMarketReferences(','Albion Online Hub','Royal Forge','Albion Free Market']){
  assert(!app.includes(obsolete),'El proveedor externo sigue activo: '+obsolete);
 }
 assert(app.includes('const aodp=market?.daily??null'));
 assert(app.includes('x.externalDemand=false'));
 assert(app.includes('historyTopMarket('));
 assert(app.includes("sendPlanToCalculator('crafting')"));
 assert(app.includes("sendPlanToCalculator('autocraft')"));
});

test('v9.11.0: un ranking externo previamente guardado no puede alterar la demanda de crafting',()=>{
 const source=code('app.js');
 const start=source.indexOf('function demandEvidence(');
 const end=source.indexOf('function control(id){',start);
 assert(start>=0&&end>start);
 const c={id:'T4_2H_FLAIL',city:'Black Market'};
 const ctx={
  discoverDemand:()=>({byMarket:new Map([[c.id+'|'+c.city,{
   daily:21,verified:true,activity:{activeDays:7},activity7:{observedDaily:21},activity30:{activeDays:10}
  }]])}),
  historyMetrics:()=>({activeDays:0,observations:0}),
  addressableDemand:(daily)=>({daily,factor:1,byQuality:null}),
  craftingFameFromRecipe:()=>({value:120,estimated:false}),
  applyBmReversion:()=>false,
  recipes:{'T4_2H_FLAIL':{materials:[]}},prefs:{premium:true},
  localStorage:{getItem:()=>JSON.stringify({source:'hub',region:'west',rows:[{id:c.id,city:c.city,daily:1_000_000}]})},
 };
 vm.createContext(ctx);
 vm.runInContext(source.slice(start,end)+'\nglobalThis.testFn=demandEvidence;',ctx);
 const r=ctx.testFn([c],[],[c.id],[c.city]);
 assert.equal(c.demandDaily,21);
 assert.equal(c.externalDemand,false);
 assert.match(c.demandSource,/AODP West/);
 assert.equal(r.importedRows,0);
});

test('v9.11.0: historial sin AODP no se rellena con datos de terceros',()=>{
 const source=code('app.js'),start=source.indexOf('function demandEvidence('),end=source.indexOf('function control(id){',start);
 const c={id:'T6_MAIN_MACE_HELL',city:'Black Market'};
 const ctx={discoverDemand:()=>({byMarket:new Map()}),historyMetrics:()=>({activeDays:0,observations:0}),
  addressableDemand:daily=>({daily,factor:1,byQuality:null}),craftingFameFromRecipe:()=>({value:0}),
  applyBmReversion:()=>false,recipes:{},prefs:{premium:true}};
 vm.createContext(ctx);
 vm.runInContext(source.slice(start,end)+'\nglobalThis.testFn=demandEvidence;',ctx);
 ctx.testFn([c],[],[c.id],[c.city]);
 assert.equal(c.demandDaily,null);
 assert.equal(c.externalDemand,false);
 assert.equal(c.demandSource,'Sin historial AODP');
});

test('v9.11.0: proxy de mercado usa únicamente REST West y preserva filtros de historia',async()=>{
 const req=new Request('https://gildem.invalid/.netlify/functions/market?region=west&kind=history&items=T4_MAIN_MACE&locations=Black%20Market&qualities=1,2,3,4,5&date=2026-11-01&end_date=2026-11-08&time-scale=24');
 const original=globalThis.fetch;
 const requests=[];
 try{
  globalThis.fetch=async(url,options)=>{requests.push({url:String(url),options});return new Response(JSON.stringify([]),{status:200,headers:{'content-type':'application/json'}});};
  const response=await marketProxy(req);
  assert.equal(response.status,200);
  assert.equal(requests.length,1);
  assert(requests[0].url.startsWith('https://west.albion-online-data.com/api/v2/stats/history/T4_MAIN_MACE.json?'));
  const url=new URL(requests[0].url);
  assert.equal(url.searchParams.get('qualities'),'1,2,3,4,5');
  assert.equal(url.searchParams.get('date'),'2026-11-01');
  assert.equal(url.searchParams.get('end_date'),'2026-11-08');
 }finally{globalThis.fetch=original;}
});

test('v9.11.0: imágenes solo del render oficial, nunca webs de otros mercados',()=>{
 const icon=code('core/icons.js'),image=code('netlify/functions/item-image.mjs');
 assert(icon.includes('render.albiononline.com'));
 assert(image.includes('render.albiononline.com'));
 assert(!icon.includes('albionfreemarket.com'));
 assert(!image.includes('albionfreemarket.com'));
});
