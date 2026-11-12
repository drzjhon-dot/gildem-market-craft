import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {captureMarketSignals,catalogItemMatches,reconcileMarketEvidence,observedWindow,trafficSignal} from '../src/market-intelligence.js';
import {markedItemsForPlanner,transferPlanRows} from '../src/planner-transfer.js';
import {allocatePlan,buildCandidates,settings} from '../src/planner.js';

const now=Date.UTC(2026,10,12,12),win=observedWindow(7,now);
const m=(id,city,all,q1,extra={})=>({id,city,days:7,from:win.from,to:win.to,averageDailyUnits:all,quality1DailyUnits:q1,quality1ActiveDays:6,activeDays:7,quality1AveragePrice:85000,averageUnitPrice:100000,...extra});
const mace=m('T8_MAIN_MACE','Black Market',18,7);
const marks=new Set(['T8_MAIN_MACE|Black Market']);
test('Top snapshots retain exact item+city + Q1 and total historical units per day',()=>{
 const r=captureMarketSignals([mace],marks);
 assert.equal(r.length,1);assert.equal(r[0].allDaily,18);assert.equal(r[0].q1Daily,7);
 assert.equal(r[0].q1ActiveDays,6);assert.equal(r[0].to,win.to);
});
test('same SKU in two different cities keeps TWO independent history snapshots',()=>{
 const rows=[mace,m('T8_MAIN_MACE','Lymhurst',13,4)];const selected=new Set(rows.map(r=>r.id+'|'+r.city));
 const rec={'T8_MAIN_MACE':{materials:[{id:'T8_METALBAR',count:1}]}};
 const r=markedItemsForPlanner(rows,selected,rec,[],150);
 assert.deepEqual(r.items,['T8_MAIN_MACE']);assert.equal(r.signals.length,2);
 assert.equal(r.signals.find(x=>x.city==='Lymhurst').q1Daily,4);
});
test('reconciliation keeps selected Top Q1 and separately sourced Q1 from new destinations',()=>{
 const captured=captureMarketSignals([mace],marks);
 const queried=[m('T8_MAIN_MACE','Black Market',19,8),m('T8_MAIN_MACE','Lymhurst',10,4)];
 const r=reconcileMarketEvidence({snapshots:captured,queried,ids:['T8_MAIN_MACE'],markets:['Black Market','Lymhurst'],days:7,now});
 assert.equal(r.rows.length,2);assert.equal(r.fromTop,1);assert.equal(r.fromAdditional,1);
 assert.equal(r.rows.find(x=>x.city==='Black Market').quality1DailyUnits,7);
 assert.equal(r.rows.find(x=>x.city==='Lymhurst').quality1DailyUnits,4);
 assert.equal(r.discrepancies.length,1);
});
test('window mismatch does not reuse stale selected daily activity',()=>{
 const captured=captureMarketSignals([mace],marks);
 const later=reconcileMarketEvidence({snapshots:captured,queried:[],ids:['T8_MAIN_MACE'],markets:['Black Market'],days:7,now:now+8*86400000});
 assert.equal(later.rows.length,0);assert.equal(later.missing.length,1);
});
test('zero Q1 is retained as zero, never converted to all qualities',()=>{
 const h=m('T8_MAIN_MACE','Black Market',18,0,{quality1ActiveDays:0});
 const r=reconcileMarketEvidence({snapshots:captureMarketSignals([h],marks),queried:[],ids:[h.id],markets:[h.city],days:7,now});
 assert.equal(r.rows[0].quality1DailyUnits,0);
 assert.equal(trafficSignal(r.rows[0]).level,'none');
});
test('individual catalogue selection accepts Spanish names and respects specific branch',()=>{
 const ids=['T8_MAIN_MACE','T5_MAIN_MACE','T8_MAIN_AXE'];
 const names={'T8_MAIN_MACE':'Maza del anciano','T5_MAIN_MACE':'Maza del experto','T8_MAIN_AXE':'Hacha del anciano'};
 const x=catalogItemMatches({ids,names,branchKeys:['mace'],search:'maza del anciano'});
 assert.deepEqual(x.ids,['T8_MAIN_MACE']);
 const y=catalogItemMatches({ids,names,branchKeys:['mace'],selectedOnly:true,selectedIds:['T8_MAIN_MACE']});
 assert.deepEqual(y.ids,['T8_MAIN_MACE']);
});
test('planner retains separate city routes for one SKU and respects shared budget',()=>{
 const c=settings({budget:5000000,tiers:[8],enchants:[0],saleDays:7,maxCapitalSharePct:100,diversify:true,minRoiPct:2});
 const history=m('T8_MAIN_MACE','Black Market',18,7);
 const candidate=city=>({id:'T8_MAIN_MACE',city,routeKey:'T8_MAIN_MACE|'+city,craftCity:'Martlock',history:{...history,city},craftAmount:1,maxCrafts:2,
  grossCapitalPerCraft:60000,expectedCostPerCraft:35000,planningPrice:95000,marketQuote:95000,marketFee:.04,
  estimatedProfitPerCraft:55000,stressProfitPerCraft:40000,expectedFamePerCraft:1000,materials:[],returnPct:24.8,focusPerCraft:0,qty:0});
 const r=allocatePlan({candidates:[candidate('Black Market'),candidate('Lymhurst')],config:c});
 assert.equal(r.rows.length,2);assert.deepEqual(new Set(r.rows.map(x=>x.city)),new Set(['Black Market','Lymhurst']));
 assert(r.summary.capitalReserved<=c.budget);assert(r.rows.every(x=>x.coverageSharePct<=100));
 assert.equal(transferPlanRows(r.rows).items[0].qty,r.summary.crafts);
});
test('ranking and planner surfaces show Q1 and individual catalogue controls',()=>{
 const src=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 for(const x of ['catalog-search','catalog-select-visible','catalog-only-selected','catalog-mode','Calidad 1/día','state.plannerSignals','reconcileMarketEvidence'])assert(src.includes(x),x);
});
