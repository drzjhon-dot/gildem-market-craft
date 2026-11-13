import test from 'node:test';
import assert from 'node:assert/strict';
import {journalValue,bestFullJournalSale,purchaseAssessment,qualityExtraPerUnit,qualityBids,premiumTax,QUALITY_PROBS_DEFAULT} from '../src/economics.js';
import {DEFAULTS,focusCostFactor} from '../src/planner.js';
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

test('v2.5 Focus: 10.000 de eficiencia (FCE) reducen el coste a la mitad',()=>{
 assert.equal(focusCostFactor({focusEfficiency:0}),1);assert.equal(focusCostFactor({focusEfficiency:10000}),.5);
 assert(Math.abs(focusCostFactor({focusEfficiency:20000})-.25)<1e-12);
});

