import test from 'node:test';
import assert from 'node:assert/strict';
import {purchaseQuote,SAFE_ROYAL_PURCHASE_CITIES} from '../src/market.js';
import {DEFAULTS,settings} from '../src/planner.js';
import {batchCalculate} from '../src/batch-calculator.js';
import {readFileSync} from 'node:fs';
const now=Date.parse('2026-11-12T15:00:00Z');
const quotes=(entries)=>new Map(entries.map(([id,city,price,bid])=>[id+'|'+city,{id,city,ask:price>0?{price,time:now}:undefined,bid:bid>0?{price:bid,time:now}:undefined}]));
const recipe={T4_MAIN_MACE:{city:'Lymhurst',materials:[{id:'T4_METALBAR',count:12,ret:true}],fame:3600}};
const h={id:'T4_MAIN_MACE',city:'Black Market',quality1DailyUnits:90,quality1ActiveDays:7,days:7,averageDailyUnits:110,quality1AveragePrice:7000};
const q=quotes([
 ['T4_METALBAR','Lymhurst',120],['T4_METALBAR','Fort Sterling',80],['T4_METALBAR','Bridgewatch',110],
 ['T4_METALBAR','Caerleon',12],['T4_METALBAR','Brecilien',4],['T4_JOURNAL_WARRIOR_EMPTY','Lymhurst',1500],
 ['T4_JOURNAL_WARRIOR_EMPTY','Fort Sterling',900],['T4_MAIN_MACE','Black Market',0,6500],
]);
const cfg={...DEFAULTS,goal:'silver',diversify:false,tiers:[4],enchants:[0],budget:400000,saleDays:7,
  maxCapitalSharePct:100,minRoiPct:0,stressGuard:false,historyPriceCapPct:40,buyBufferPct:0,
  purchaseMode:'best-royal',inboundTransportPerUnit:8};
test('Compra materiales en la Royal con menor coste efectivo, aunque se fabrique en otra ciudad',()=>{
 assert.equal(SAFE_ROYAL_PURCHASE_CITIES.length,5);
 const route=purchaseQuote(q,'T4_METALBAR','Lymhurst',cfg,now+1000);
 assert.equal(route.city,'Fort Sterling');assert.equal(route.unitPrice,80);assert.equal(route.transportPerUnit,8);
 assert.equal(route.landedUnitPrice,88);assert.equal(route.savingsVsCraftCity,32);
 assert.equal(route.craftCity,'Lymhurst');assert.equal(route.riskRoute,false);
});
test('Tarifa de transporte puede convertir la compra local en la mejor alternativa',()=>{
 const route=purchaseQuote(q,'T4_METALBAR','Lymhurst',{...cfg,inboundTransportPerUnit:45},now+1000);
 assert.equal(route.city,'Lymhurst');assert.equal(route.landedUnitPrice,120);assert.equal(route.transportPerUnit,0);
});
test('No compra en Brecilien ni Caerleon externo sin consentimiento; Caerleon local sí',()=>{
 const a=purchaseQuote(q,'T4_METALBAR','Lymhurst',cfg,now+1000);
 const b=purchaseQuote(q,'T4_METALBAR','Lymhurst',{...cfg,includeCaerleonPurchases:true},now+1000);
 assert.equal(a.city,'Fort Sterling');assert.equal(b.city,'Caerleon');assert.equal(b.riskRoute,true);
 const local=purchaseQuote(q,'T4_METALBAR','Caerleon',cfg,now+1000);
 assert.equal(local.city,'Caerleon');assert.equal(local.transportPerUnit,0);
});
test('Modo compra local solo utiliza el mercado de la ciudad de fabricación',()=>{
 assert.equal(purchaseQuote(q,'T4_METALBAR','Lymhurst',{...cfg,purchaseMode:'craft-city'},now+1000).city,'Lymhurst');
 assert.equal(purchaseQuote(q,'T4_METALBAR','Thetford',{...cfg,purchaseMode:'craft-city'},now+1000),null);
});
test('Calculadora agrupa diarios T4 y compra diario en la Royal más barata con traslado',()=>{
 const result=batchCalculate({items:[{id:'T4_MAIN_MACE',qty:2}],recipes:recipe,quotes:q,now:now+1000,config:cfg});
 const metal=result.materials.find(x=>x.id==='T4_METALBAR');
 assert.equal(metal.city,'Fort Sterling');assert.equal(metal.landedUnitPrice,88);
 assert.equal(metal.total,metal.buy*88);
 const diary=result.materials.find(x=>x.id==='T4_JOURNAL_WARRIOR_EMPTY');
 assert(diary?.journal);assert.equal(diary.city,'Fort Sterling');assert.equal(diary.landedUnitPrice,908);
 assert.equal(diary.total,diary.buy*908);
 assert.equal(result.totals.journalCost,diary.total);
 assert(result.totals.profitBM!==null);assert(result.totals.purchaseTransportEstimated>0);
});
test('La interfaz permite seleccionar compras Royal y coste de traslado y mantiene sus pestañas',()=>{
 const ui=readFileSync('src/main.js','utf8'),html=readFileSync('index.html','utf8');
 for(const name of ['purchaseMode','inboundTransportPerUnit','includeCaerleonPurchases','craftFallbackCity'])assert(ui.includes(`data-cfg="${name}"`));
 assert(!html.includes('data-route="flip"'));assert(html.includes('data-route="refine"'));
 assert(ui.includes('→ fabricar en'));
 assert.throws(()=>settings({...cfg,purchaseMode:'sin-control'}),/modo de compra/);
});
test('No fusiona la misma materia al transportarla a destinos de fabricación distintos',()=>{
 const recipes={T4_MAIN_MACE:{city:'Lymhurst',materials:[{id:'T4_METALBAR',count:12,ret:true}],fame:100},
  T4_MAIN_AXE:{city:'Fort Sterling',materials:[{id:'T4_METALBAR',count:10,ret:true}],fame:100}};
 const all=quotes([['T4_METALBAR','Lymhurst',120],['T4_METALBAR','Fort Sterling',80],
  ['T4_MAIN_MACE','Black Market',0,6500],['T4_MAIN_AXE','Black Market',0,6500]]);
 const res=batchCalculate({items:[{id:'T4_MAIN_MACE',qty:2},{id:'T4_MAIN_AXE',qty:2}],recipes,quotes:all,now:now+1000,config:cfg});
 const steel=res.materials.filter(r=>r.id==='T4_METALBAR');
 assert.equal(steel.length,2,'Se distinguen entregas a Lymhurst y Fort Sterling');
 const ly=steel.find(r=>r.craftCity==='Lymhurst'),fs=steel.find(r=>r.craftCity==='Fort Sterling');
 assert.equal(ly.landedUnitPrice,88);assert.equal(fs.landedUnitPrice,80);
 assert.equal(res.totals.buyCapital,steel.reduce((sum,r)=>sum+r.total,0));
});

