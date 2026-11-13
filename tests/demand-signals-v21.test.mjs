import test from 'node:test';
import assert from 'node:assert/strict';
import {demandSignals} from '../src/demand-signals.js';
import {summarizeHistory} from '../src/market.js';
import {captureMarketSignals,reconcileMarketEvidence,observedWindow} from '../src/market-intelligence.js';
import {DEFAULTS} from '../src/planner.js';
const row=(units,prices)=>({quality1DailyUnits:units.reduce((a,b)=>a+b,0)/units.length,quality1Series:units.map((u,i)=>[u,prices?.[i]??(u?1000:0)])});

test('v2.1: un volcado en un solo día no infla la demanda',()=>{
 const s=demandSignals(row([2,1,2,60,1,2,2]));
 assert.equal(s.label,'Pico aislado');
 assert(s.demandDaily<3,`demanda ${s.demandDaily}`);
 assert(s.windowMean>9);
});
test('v2.1: una serie estable conserva casi toda la media',()=>{
 const s=demandSignals(row([10,11,9,10,12,10,11]));
 assert.equal(s.label,'Estable');
 assert(s.demandDaily>=s.windowMean*.9);
});
test('v2.1: si los últimos 3 días caen, la demanda baja hacia ellos',()=>{
 const s=demandSignals(row([14,15,13,14,3,2,3]));
 assert(s.falling);assert(s.demandDaily<s.robustDaily);assert(s.demandDaily>s.recent3);
});
test('v2.1: un aumento reciente NO amplía la demanda',()=>{
 const s=demandSignals(row([3,3,3,3,12,14,15]));
 assert(s.demandDaily<=s.windowMean);
});
test('v2.1: precio Q1 reciente más bajo se detecta',()=>{
 const s=demandSignals(row([5,5,5,5,5,5,5],[1000,1000,1000,1000,800,800,800]));
 assert(s.priceFalling);assert(Math.abs(s.recentPrice-800)<1e-6);
});
test('v2.1: summarizeHistory guarda la serie Q1 diaria y la ficha del Top la conserva',()=>{
 const now=Date.parse('2026-11-12T12:00:00Z'),day=86400000,end=Math.floor(now/day)*day;
 const data=[0,1,2,3,4,5,6].map(i=>({timestamp:new Date(end-(7-i)*day+3600e3).toISOString(),item_count:i===3?40:4,avg_price:1000+i}));
 const [h]=summarizeHistory([{item_id:'T5_MAIN_MACE',location:'Black Market',quality:1,data},{item_id:'T5_MAIN_MACE',location:'Black Market',quality:2,data}],{days:7,now});
 assert.equal(h.quality1Series.length,7);assert.equal(h.quality1Series[3][0],40);assert.equal(h.quality1Series[0][0],4);
 const snap=captureMarketSignals([h],new Set(['T5_MAIN_MACE|Black Market']));
 const back=reconcileMarketEvidence({snapshots:snap,ids:['T5_MAIN_MACE'],markets:['Black Market'],days:7,now});
 assert.deepEqual(back.rows[0].quality1Series,h.quality1Series);
 assert.equal(demandSignals(back.rows[0]).label,'Pico aislado');
});
