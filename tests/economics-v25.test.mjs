import test from 'node:test';
import assert from 'node:assert/strict';
import {journalValue,bestFullJournalSale,purchaseAssessment,qualityExtraPerUnit,qualityBids,premiumTax,QUALITY_PROBS_DEFAULT} from '../src/economics.js';
import {buildCandidates,allocatePlan,DEFAULTS} from '../src/planner.js';
import {optimizePortfolio,estimateRoute} from '../src/portfolio-engine.js';
import {batchCalculate} from '../src/batch-calculator.js';
import {transferPlanRows} from '../src/planner-transfer.js';
const T=Date.parse('2026-11-12T12:00:00Z'),fresh=T-3600e3;
const Q=(entries)=>new Map(entries.map(([id,city,ask,bid])=>[id+'|'+city,{id,city,...(ask?{ask:{price:ask,time:fresh}}:{}),...(bid?{bid:{price:bid,time:fresh}}:{})}]));
const cfg=x=>({...DEFAULTS,goal:'silver',purchaseMode:'craft-city',diversify:false,stressGuard:false,minRoiPct:0,...x});

test('v2.5 Premium: impuesto 4 % con Premium y 8 % sin Premium',()=>{assert.equal(premiumTax(true),4);assert.equal(premiumTax(false),8);});

test('v2.5 diarios: el lleno se vende por el mejor canal neto y se descuenta el vacío',()=>{
 const quotes=Q([['T6_JOURNAL_WARRIOR_EMPTY','Martlock',4000,0],['T6_JOURNAL_WARRIOR_FULL','Lymhurst',30000,25000],['T6_JOURNAL_WARRIOR_FULL','Thetford',0,28500]]);
 const best=bestFullJournalSale(quotes,'T6_JOURNAL_WARRIOR_FULL',{tax:4,listingFee:2.5},T);
 // 30000×(1−0,065)=28050 frente a 28500×0,96=27360 → orden de venta en Lymhurst.
 assert.equal(best.city,'Lymhurst');assert.equal(Math.round(best.net),28050);
 const v=journalValue({quotes,journal:{id:'T6_JOURNAL_WARRIOR_EMPTY',fractional:.5},craftCity:'Martlock',config:{tax:4,listingFee:2.5,purchaseMode:'craft-city'},now:T});
 assert.equal(Math.round(v.valuePerCraft),Math.round((28050-4000)*.5));assert.equal(v.emptyCostPerCraft,2000);
});

test('v2.5 diarios en el Planner: bajan el coste neto, suben el capital y se pueden desactivar',()=>{
 const recipes={T6_MAIN_MACE:{city:'Martlock',amountCrafted:1,materials:[{id:'T6_METALBAR',count:16},{id:'T6_CLOTH',count:8}]}};
 const quotes=Q([['T6_METALBAR','Martlock',2500],['T6_CLOTH','Martlock',2600],['T6_MAIN_MACE','Black Market',0,70000],
  ['T6_JOURNAL_WARRIOR_EMPTY','Martlock',4000],['T6_JOURNAL_WARRIOR_FULL','Martlock',30000]]);
 const top=[{id:'T6_MAIN_MACE',city:'Black Market',days:7,quality1DailyUnits:10,quality1ActiveDays:7,quality1AveragePrice:70000}];
 const on=buildCandidates({top,recipes,quotes,config:cfg({}),selectedMarkets:['Black Market'],now:T}).candidates[0];
 const off=buildCandidates({top,recipes,quotes,config:cfg({journalProfit:false}),selectedMarkets:['Black Market'],now:T}).candidates[0];
 assert(on.journal&&on.journalGainPerCraft>0);assert.equal(off.journal,null);
 assert(Math.abs((off.expectedCostPerCraft-on.expectedCostPerCraft)-on.journalGainPerCraft)<1e-6);
 assert(on.grossCapitalPerCraft>off.grossCapitalPerCraft);
});

test('v2.5 Focus: se reparte donde más silver ahorra por punto y ninguna ruta queda en pérdida',()=>{
 const route=(id,cost,costF,points)=>({id,city:'Black Market',routeKey:id+'|BM',maxCrafts:10,craftAmount:1,history:{quality1DailyUnits:500},
  grossCapitalPerCraft:1000,expectedCostPerCraft:cost,costWithFocus:costF,focusPerCraft:points,planningPrice:2000,marketFee:0,
  expectedFamePerCraft:0,estimatedProfitPerCraft:2000-cost,materials:[],qty:0});
 // A ahorra 300 silver con 100 puntos (3/punto); B ahorra 300 con 300 puntos (1/punto).
 const A=route('T5_MAIN_MACE',1500,1200,100),B=route('T6_MAIN_MACE',1500,1200,300);
 const c=cfg({budget:100000,focus:true,focusAvailable:1000,maxCapitalSharePct:100,useBudget:true,style:'dynamic',sellHaircutPct:0});
 const out=optimizePortfolio([A,B],c),get=id=>out.selected.find(r=>r.id===id);
 assert.equal(get('T5_MAIN_MACE').focusQty,10,'A recibe Focus primero');
 assert.equal(get('T6_MAIN_MACE').focusQty,0,'a B solo le quedarían 0 puntos útiles');
 assert(out.best.focusLeft>=0);
 for(const r of out.selected)assert(estimateRoute(r,r.qty,c,r.focusQty).profit>0);
});

test('v2.5 calidades superiores: extra esperado con la mejor puja de calidad ≤ q y tope del 15 %',()=>{
 const extra=qualityExtraPerUnit({1:10000,2:12000,3:15000},10000,QUALITY_PROBS_DEFAULT);
 // Q2 → 12000 (+2000×0,25), Q3 → 15000 (+5000×0,055), Q4 y Q5 → 15000 (+5000×0,006)
 assert.equal(Math.round(extra),Math.round(2000*.25+5000*.055+5000*.005+5000*.001));
 assert.equal(qualityExtraPerUnit({2:90000},10000),1500,'nunca más del 15 %');
 const bids=qualityBids([{item_id:'X',city:'Black Market',quality:2,buy_price_max:500,buy_price_max_date:new Date(fresh).toISOString()}],'Black Market',T);
 assert.equal(bids.get('X')[2],500);
});

test('v2.5 compras: días de mercado, sobrecoste y precio inflado',()=>{
 const ok=purchaseAssessment({buy:100,unitPrice:1000,history:{averageDailyUnits:500,averageUnitPrice:1000}});
 assert.equal(ok.level,'ok');assert.equal(ok.extraCost,0);
 const hard=purchaseAssessment({buy:2000,unitPrice:1000,history:{averageDailyUnits:400,averageUnitPrice:700},observedAt:new Date(T-5*3600e3).toISOString(),now:T});
 assert.equal(hard.level,'hard');assert.equal(hard.slippagePct,.2);assert.equal(hard.extraCost,2000*1000*.2);
 assert(hard.inflated);assert.equal(Math.round(hard.ageHours),5);
 assert.equal(purchaseAssessment({buy:10,unitPrice:5,history:null}).level,'unknown');
});

test('v2.5 Calculadora: Focus del plan reduce la compra, diarios llenos suman al profit',()=>{
 const rows=[{id:'T6_MAIN_MACE',city:'Black Market',qty:4,focusQty:2}];
 const items=transferPlanRows(rows).items;assert.equal(items[0].focusQty,2);
 const recipes={T6_MAIN_MACE:{city:'Martlock',amountCrafted:1,materials:[{id:'T6_METALBAR',count:16}]}};
 const quotes=Q([['T6_METALBAR','Martlock',2500],['T6_MAIN_MACE','Black Market',0,70000],['T6_JOURNAL_WARRIOR_EMPTY','Martlock',4000],['T6_JOURNAL_WARRIOR_FULL','Martlock',30000]]);
 const c=cfg({});
 const withF=batchCalculate({items,recipes,quotes,config:c,now:T}),noF=batchCalculate({items:[{id:'T6_MAIN_MACE',qty:4}],recipes,quotes,config:c,now:T});
 const bar=r=>r.materials.find(m=>m.id==='T6_METALBAR').buy;
 assert(bar(withF)<bar(noF),`${bar(withF)} < ${bar(noF)}`);
 assert(withF.totals.journalValue>0);
 const noJ=batchCalculate({items,recipes,quotes,config:{...c,journalProfit:false},now:T});
 assert(Math.abs(withF.totals.profitBM-noJ.totals.profitBM-withF.totals.journalValue)<1e-6);
});

import {createPlanLogEntry,verifyPlanEntry,planLogWindow,sanitizePlanLog} from '../src/plan-log.js';
test('v2.5 diario de planes: guarda rutas y compara con la actividad real',()=>{
 const result={summary:{capitalReserved:1e6,totalProfit:1e5},rows:[
  {id:'T6_MAIN_MACE',city:'Black Market',qty:5,craftAmount:1,grossCapitalPerCraft:1e5,totalProfit:5e4,planningPrice:70000,history:{quality1DailyUnits:10,effectiveQuality1DailyUnits:8}},
  {id:'T5_MAIN_MACE',city:'Black Market',qty:5,craftAmount:1,grossCapitalPerCraft:1e5,totalProfit:5e4,planningPrice:30000,history:{quality1DailyUnits:6}}]};
 const created=Date.parse('2026-11-05T15:00:00Z');
 const e=createPlanLogEntry(result,{saleDays:7,style:'balanced'},created);
 assert.equal(e.rows.length,2);assert.equal(e.rows[0].usedDaily,8);
 assert.deepEqual(planLogWindow(e,Date.parse('2026-11-05T20:00:00Z')),{days:0,window:1,ready:false,complete:false});
 const w=planLogWindow(e,Date.parse('2026-11-12T10:00:00Z'));assert.equal(w.days,7);assert.equal(w.window,7);assert(w.complete);
 const v=verifyPlanEntry(e,[{id:'T6_MAIN_MACE',city:'Black Market',quality1DailyUnits:9,quality1AveragePrice:71000},{id:'T5_MAIN_MACE',city:'Black Market',quality1DailyUnits:2,quality1AveragePrice:30000}]);
 assert.equal(v.rows[0].verdict,'cumplido');assert.equal(v.rows[1].verdict,'demanda menor');assert.equal(v.ok,1);
 assert(v.advice.length>=1);
 assert.equal(sanitizePlanLog([e,{bad:1}]).length,1);
});

test('v2.5 diarios: tope del 25 % de la venta del objeto',()=>{
 const recipes={T8_MAIN_MACE:{city:'Martlock',amountCrafted:1,materials:[{id:'T8_METALBAR',count:16},{id:'T8_CLOTH',count:8}]}};
 const quotes=Q([['T8_METALBAR','Martlock',20000],['T8_CLOTH','Martlock',21000],['T8_MAIN_MACE','Black Market',0,600000],
  ['T8_JOURNAL_WARRIOR_EMPTY','Martlock',10000],['T8_JOURNAL_WARRIOR_FULL','Martlock',2000000]]);
 const top=[{id:'T8_MAIN_MACE',city:'Black Market',days:7,quality1DailyUnits:10,quality1ActiveDays:7,quality1AveragePrice:600000}];
 const r=buildCandidates({top,recipes,quotes,config:cfg({}),selectedMarkets:['Black Market'],now:T}).candidates[0];
 assert(r.journal.capped);assert(Math.abs(r.journalGainPerCraft-600000*.25)<1e-6);
});

import {focusCostFactor} from '../src/planner.js';
test('v2.5 Focus: 10.000 de eficiencia (FCE) reducen el coste a la mitad',()=>{
 assert.equal(focusCostFactor({focusEfficiency:0}),1);assert.equal(focusCostFactor({focusEfficiency:10000}),.5);
 assert(Math.abs(focusCostFactor({focusEfficiency:20000})-.25)<1e-12);
});
