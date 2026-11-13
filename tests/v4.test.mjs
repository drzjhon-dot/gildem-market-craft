import test from 'node:test';
import assert from 'node:assert/strict';
import {toEpoch,historyMetrics,confidenceOf,scenarioProfit,qualityWeightedSale,allocateSmartPortfolio,focusPerSilver} from '../core/optimizer.js';
import {createPortfolioFromPlan,summarizePortfolio,recordSale,setLotCost,overallDashboard} from '../core/ledger.js';
import {addAlertFromRoute,evaluateAlert} from '../core/alerts.js';
const D=86400000,now=Date.UTC(2026,10,8,12);
const tick=ms=>Math.round(ms*10000+621355968000000000);
function sample(id,city,profit=40,cost=100,activity=null,focus=0){return {id,city,craftCity:'Martlock',profit,cost:cost*.8,capitalPerUnit:cost,returnRate:25,mode:'instant',sell:120,confidence:{score:city==='Black Market'?54:90},activity,focusPerUnit:focus,focusGain:focus?15:0,stressProfit:profit-12,materials:[{id:'T4_METALBAR',city:'Martlock',count:8,used:6,unitPrice:10,ret:true}]};}
test('timestamps .NET ticks e ISO se interpretan sin convertir órdenes en ventas',()=>{
 const ms=Date.UTC(2026,10,5);assert.ok(Math.abs(toEpoch(tick(ms))-ms)<1000);
 const h=historyMetrics([{timestamp:'2026-11-05T00:00:00Z',item_count:8,avg_price:100},{timestamp:tick(ms),item_count:4,avg_price:120},{timestamp:'2026-11-08T00:00:00Z',item_count:9999,avg_price:10}],14,now);
 assert.equal(h.count,12);assert.equal(h.isSalesData,false);assert.equal(h.activeDays,1);assert.equal(h.observedDaily,12/14);
});
test('calificación baja si hay BM sin profundidad; historia parcial reduce confianza',()=>{
 const royal=confidenceOf({ageHours:1,activity:{coverage:1,volatility:.02,observations:14},market:'Royal'});
 const bm=confidenceOf({ageHours:1,activity:{coverage:1,volatility:.02,observations:14},market:'Black Market'});
 assert.equal(royal.label,'Alta');assert.ok(bm.score<=54);assert.ok(confidenceOf({ageHours:25,activity:null}).score<royal.score);
});
test('calidad esperada requiere cotizaciones para cada calidad con probabilidad positiva',()=>{
 const q={1:{price:100,at:now},3:{price:400,at:now-D}};
 assert.equal(qualityWeightedSale(q,[80,0,20,0,0]).price,160);
 assert.equal(qualityWeightedSale(q,[80,20,0,0,0]),null);
 assert.equal(qualityWeightedSale(q,[100,0,0,0,0]).price,100);
 assert.equal(qualityWeightedSale(q,[50,0,0,0,0]),null);
});
test('estrés en precios y recursos reduce profit frente al escenario base',()=>{
 const s=scenarioProfit({sale:250,cost:110,materialCost:90,tax:.04,mode:'listed',setup:.025,drop:.08,materialsRise:.07});
 assert.ok(s.base>0);assert.ok(s.stressed<s.base);assert.equal(s.delta,s.stressed-s.base);
});
test('portafolio respeta presupuesto, tope de Focus y mercado mixto',()=>{
 const offers=[sample('A','Black Market',90,100,null,25),sample('B','Lymhurst',110,100,null,25)];
 const p=allocateSmartPortfolio(offers,1000,{focusLimit:125,useAll:true,unknownCap:10,ensureBothMarkets:true});
 assert.ok(p.totalCost<=1000);assert.ok(p.focusUsed<=125);assert.equal(p.focusUsed,125);
 assert.ok(p.rows.some(x=>x.city==='Black Market'));assert.ok(p.rows.some(x=>x.city==='Lymhurst'));
 assert.equal(p.materials[0].qtyGross,p.rows.reduce((a,b)=>a+b.qty*8,0));
 assert.equal(focusPerSilver(offers[0]),15/25);
});
test('oportunidad sin precio no se debe convertir en venta con una orden hipotética',()=>{
 const a=sample('T4_SHOES_PLATE_SET1','Black Market');
 const alert=addAlertFromRoute(a,{minRoi:10,minProfit:10});const map=new Map();
 assert.equal(evaluateAlert(alert,map,24,now),null);
 const row=(item,city,side,price)=>({item_id:item,city,quality:1,[side]:price,[side+'_date']:'2026-11-08T10:00:00Z'});
 const sell=row(a.id,'Black Market','buy_price_max',200);const mat=row('T4_METALBAR','Martlock','sell_price_min',10);
 map.set(a.id+'|Black Market|1',sell);map.set('T4_METALBAR|Martlock|1',mat);
 const outcome=evaluateAlert(alert,map,24,now);assert.equal(outcome.trigger,true);assert.ok(outcome.profit>10);
});
test('inversiones: ganancias realizadas cuentan solo unidades vendidas y tarifas',()=>{
 const candidate={...sample('A','Lymhurst',50),qty:5,taxRate:.04,setupRate:.025,transportCost:1};
 let p=createPortfolioFromPlan({rows:[candidate]},'Plan de pruebas');
 assert.equal(summarizePortfolio(p).realizedProfit,0);
 p=recordSale(p,'lot-0',{qty:2,price:200,fees:16,transport:4,at:'2026-11-08T12:00:00Z'});
 let ss=summarizePortfolio(p);assert.equal(ss.sold,2);assert.equal(ss.unsold,3);assert.equal(ss.netRevenue,380);assert.equal(ss.realizedProfit,220);
 assert.throws(()=>recordSale(p,'lot-0',{qty:4,price:200,fees:10}),/supera/);
 p=setLotCost(p,'lot-0',90);ss=summarizePortfolio(p);assert.equal(ss.realizedProfit,200);
 assert.equal(overallDashboard([p]).realizedProfit,200);
});
test('no invierte todo en recetas deficitarias o sin volumen demostrable',()=>{
 const p=allocateSmartPortfolio([sample('A','Lymhurst',-5),sample('B','Martlock',20,100,null)],1000,{useAll:true,unknownCap:2});
 assert.equal(p.totalCost,200);assert.equal(p.remaining,800);assert.equal(p.rows.length,1);
});
test('comparación bonus vs Caerleon selecciona una sola ruta Royal por ciudad de venta',async()=>{
 const {selectCraftSaleRoutes,craftingReturnRate}=await import('../core/engine.js');
 const city=craftingReturnRate({specialty:true});const no=craftingReturnRate({specialty:false});
 assert.ok(city.returnRate>no.returnRate);
 const a=sample('T4_SHOES_PLATE_SET1','Martlock',100,200);a.craftCity='Martlock';
 const b=sample('T4_SHOES_PLATE_SET1','Martlock',60,200);b.craftCity='Caerleon';
 const c=sample('T4_SHOES_PLATE_SET1','Black Market',120,200);c.craftCity='Caerleon';
 const d=sample('T4_SHOES_PLATE_SET1','Black Market',100,200);d.craftCity='Martlock';
 const out=selectCraftSaleRoutes([a,b,c,d],'mixed');
 assert.equal(out.filter(x=>x.city==='Martlock').length,1);
 assert.equal(out.filter(x=>x.city==='Black Market').length,1);
 assert.equal(out.find(x=>x.city==='Martlock').craftCity,'Martlock');
 assert.equal(out.find(x=>x.city==='Black Market').craftCity,'Caerleon');
});
test('alertas con mezcla de calidad exigen precio observable para cada calidad usada',()=>{
 const route={...sample('T4_SHOES_PLATE_SET1','Lymhurst',100),qualityMode:'mix',qualityWeights:[60,40,0,0,0]};
 const a=addAlertFromRoute(route,{minRoi:10,minProfit:20});const d='2026-11-08T11:00:00Z';
 const m=new Map([['T4_METALBAR|Martlock|1',{sell_price_min:10,sell_price_min_date:d}]]);
 m.set(route.id+'|Lymhurst|1',{buy_price_max:100,buy_price_max_date:d});
 assert.equal(evaluateAlert(a,m,24,now),null);
 m.set(route.id+'|Lymhurst|2',{buy_price_max:250,buy_price_max_date:d});
 const x=evaluateAlert(a,m,24,now);assert.ok(x&&x.trigger);
});
