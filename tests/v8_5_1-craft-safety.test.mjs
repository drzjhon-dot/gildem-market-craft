import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateCraftViability,filterViableCraftRoutes,safeBookCraftCapacity} from '../core/viability.js';
import {planLevelCraft} from '../core/level-craft.js';

const id='T5_SHOES_LEATHER_SET1';
const recipes={[id]:{city:'Lymhurst',materials:[{id:'T5_LEATHER',count:8,ret:true}],amountCrafted:1}};
const material=[{id:'T5_LEATHER',city:'Lymhurst',count:8,used:6,unitPrice:900,upfrontUnitPrice:900}];
const good=(fields={})=>({id,city:'Martlock',craftCity:'Lymhurst',mode:'listed',sell:12000,profit:2600,stressProfit:1350,
  cost:9000,capitalPerUnit:10000,ageHours:2,activity:{observations:11,activeDays:9,observedDaily:15,avgPrice:11500},
  confidence:{score:83},competition:{known:true,unitsAhead:3},craftAmount:1,materials:material,
  focusPerUnit:0,stationCost:200,saleTaxPercent:4,setupRate:.025,...fields});

test('Level rejects loss, razor-thin profit and stress losses, independent of fame',()=>{
 for(const r of [good({profit:-5}),good({profit:50}),good({stressProfit:-20})]){
  assert.equal(evaluateCraftViability(r,{budget:200000,mode:'level'}).ok,false);
  const p=planLevelCraft({routes:[r],recipes,goalFame:25000,budget:200000});
  assert.equal(p.items.length,0);
  assert(p.rejectedRoutes>=1);
 }
});
test('expensive non-liquid listing is rejected, even when its nominal profit is large',()=>{
 const expensive=good({capitalPerUnit:1_000_000,cost:700_000,profit:250_000,stressProfit:120_000,
  activity:{observations:1,activeDays:1,observedDaily:.2,avgPrice:0},competition:{known:false}});
 const p=planLevelCraft({routes:[expensive],recipes,goalFame:60000,budget:4_000_000});
 assert.equal(p.items.length,0);
 assert(p.safetySummary.includes('actividad Royal insuficiente'));
});
test('no orderbook means BM is NOT a valid sale outlet',()=>{
 const bm=good({city:'Black Market',mode:'instant',sell:11000,depthVerified:false,marketCapacity:1,orderLevels:[],activity:null});
 assert.equal(evaluateCraftViability(bm,{budget:100_000,mode:'level'}).ok,false);
 assert.equal(planLevelCraft({routes:[bm],recipes,goalFame:15000,budget:100_000}).sales.length,0);
});
test('Royal with too many competing listings or quoted price above recent reference is discarded',()=>{
 assert.equal(evaluateCraftViability(good({competition:{known:true,unitsAhead:200}}),{budget:200000,mode:'royal'}).ok,false);
 assert.equal(evaluateCraftViability(good({sell:30000,activity:{observations:13,activeDays:10,observedDaily:15,avgPrice:10000}}),{budget:200000,mode:'royal'}).ok,false);
});
test('verified liquid cheap high-margin route remains viable and produces conservative quantities',()=>{
 const r=good(),check=evaluateCraftViability(r,{budget:200000,mode:'level'});
 assert(check.ok);
 const screened=filterViableCraftRoutes([r,good({profit:-1})],{budget:200000,mode:'level'});
 assert.equal(screened.accepted.length,1);assert.equal(screened.rejected.length,1);
 const p=planLevelCraft({routes:[r],recipes,goalFame:100000,budget:200000,capFraction:.1,maxStages:20});
 assert.equal(p.sales.length,1);
 assert.equal(p.sales[0].qty,1); // solo 10% de 15 observaciones diarias
});

test('Level cannot multiply a single Royal market observation into 20 rounds',()=>{
 const r=good({activity:{observations:14,activeDays:12,observedDaily:40,avgPrice:11500}});
 const p=planLevelCraft({routes:[r],recipes,goalFame:400000,budget:100000,maxStages:24});
 const qty=p.sales.reduce((sum,x)=>sum+x.qty,0);
 assert(qty>0&&qty<=Math.floor(40*.10));
 assert(p.stages.length<=8);
 assert(!p.completed);
});
test('a profitable first BM bid cannot subsidize later unprofitable bid levels',()=>{
 const base=good({id,city:'Black Market',craftCity:'Caerleon',mode:'instant',sell:12000,profit:2600,stressProfit:1350,
  ageHours:1,depthVerified:true,marketCapacity:2,orderLevels:[{price:12000,amount:1},{price:2000,amount:1}],competition:undefined});
 const listed=filterViableCraftRoutes([base],{budget:100000,mode:'level'});
 assert.equal(safeBookCraftCapacity(base,.09),1);
 assert.equal(listed.accepted.length,1);
 assert.equal(listed.accepted[0].marketCapacity,1);
 const p=planLevelCraft({routes:[base],recipes,goalFame:100000,budget:100000,maxStages:12});
 assert.equal(p.sales.reduce((s,x)=>s+x.qty,0),1);
 assert(p.netProfit>0);
});

test('insufficient bid margins reject only that route, without damaging other accepted ones',()=>{
 const goodRoyal=good();
 const marginalBM=good({city:'Black Market',craftCity:'Caerleon',mode:'instant',depthVerified:true,marketCapacity:1,
  orderLevels:[{price:10000,amount:1}],setupRate:0,stationCost:200});
 const scan=filterViableCraftRoutes([goodRoyal,marginalBM],{budget:200000,mode:'level'});
 assert.deepEqual(scan.accepted.map(x=>x.city),['Martlock']);
 assert.equal(scan.rejected.length,1);
 assert(scan.rejected[0].reasons.some(x=>x.includes('profundidad')));
});

test('study is opt-in, requires fee, and can never consume over 20% of upfront budget',()=>{
 const studyRoute={...good(),city:null,studyOnly:true,sell:0,profit:-10000,stressProfit:-20000,
  materials:[{id:'T5_LEATHER',city:'Lymhurst',count:8,used:6,unitPrice:500,upfrontUnitPrice:500}]};
 const off=planLevelCraft({routes:[studyRoute],recipes,goalFame:500000,budget:100000,study:false,studyFee:250});
 const unknownFee=planLevelCraft({routes:[studyRoute],recipes,goalFame:500000,budget:100000,study:true,studyFee:0});
 const on=planLevelCraft({routes:[studyRoute],recipes,goalFame:500000,budget:100000,study:true,studyFee:250,maxStages:12});
 assert.equal(off.studyCount,0);assert.equal(unknownFee.studyCount,0);
 assert(on.studyCount>0);
 assert(on.items.filter(x=>x.method==='study').reduce((s,x)=>s+x.investment,0)<=20000);
 assert(on.netProfit>=-20000);
 assert.equal(on.sales.length,0);
});
test('Black and Royal scan call the shared safety filter before investment allocation',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert(app.includes('filterViableCraftRoutes(candidates,{budget,mode:'));
 assert(app.includes('selectCraftSaleRoutes(viable.accepted,market)'));
 assert(app.includes('filterViableCraftRoutes(candidates,{budget:input.budget,mode:'));
 assert(app.includes('selectCraftSaleRoutes(viable.accepted,input.market)'));
 assert(app.includes("allowLoss:false"));
 assert(app.includes('normalizeSellBook(books.rows,ids,cities,prefs.maxAge)'));
});
