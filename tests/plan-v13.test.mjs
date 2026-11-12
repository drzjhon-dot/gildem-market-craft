import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {summarizeHistory,quoteMap} from '../src/market.js';
import {DEFAULTS,gradeOneDaily} from '../src/planner.js';
import {buildRoutesV3} from '../src/engine-v3.js';
const now=Date.parse('2026-11-11T18:00:00Z');
const qdate=new Date(now-3600000).toISOString();
const candle='2026-11-10T00:00:00Z';
const item='T6_MAIN_AXE';
const recipe={city:'Martlock',amountCrafted:1,materials:[{id:'T6_METALBAR',count:16,ret:true},{id:'T6_PLANKS',count:8,ret:true}]};
const recipes={[item]:recipe};
const quoted=(id,city,sell,buy=0)=>({item_id:id,city,quality:1,sell_price_min:sell,sell_price_min_date:qdate,buy_price_max:buy,buy_price_max_date:qdate});
const prices=quoteMap([quoted('T6_METALBAR','Martlock',600),quoted('T6_PLANKS','Lymhurst',400),quoted(item,'Lymhurst',78000),quoted(item,'Black Market',0,60000)]);
const marketRows=[
 {item_id:item,location:'Lymhurst',quality:1,data:[{timestamp:candle,item_count:20,avg_price:70000}]},
 {item_id:item,location:'Lymhurst',quality:3,data:[{timestamp:candle,item_count:3000,avg_price:180000}]},
 {item_id:item,location:'Black Market',quality:1,data:[{timestamp:candle,item_count:15,avg_price:60500}]}
];
const history=summarizeHistory(marketRows,{days:1,now});
const config={...DEFAULTS,budget:1000000,tiers:[6],enchants:[0],saleDays:7,minRoiPct:5,stressGuard:false,style:'dynamic'};
function produce(opts={},dest='Lymhurst'){
 const c={...config,...opts};
  return buildRoutesV3({top:history,quotes:prices,recipes,config:c,selectedMarkets:[dest],now});
}
test('historial 1-5 en ranking, pero planes y impacto solo con liquidez Q1',()=>{
 const row=history.find(h=>h.city==='Lymhurst');
 assert.equal(row.units,3020);
 assert.equal(row.averageDailyUnits,3020);
 assert.equal(row.quality1DailyUnits,20);
 assert.equal(gradeOneDaily(row),20);
 const b=produce();assert.equal(b.candidates.length,1);
 assert(b.candidates[0].maxCrafts<40,'no se atribuye la liquidez Q3 a Q1');
});
test('ciudades de venta excluyen las que no están elegidas',()=>{
 const bm=produce({},'Black Market');
 assert(bm.candidates.every(r=>r.city==='Black Market'));
 assert.equal(produce({},'Thetford').candidates.length,0);
});
test('limita picos de cotizaciones según historial Q1 (calidad 1) sin falsear el precio observado',()=>{
 const row=produce({historyPriceCapPct:5}).candidates[0];
 assert.equal(row.marketQuote,78000);
 assert.equal(row.planningPrice,73500);
 assert.equal(row.historyQuality1Price,70000);
});
test('con más colchón de compra y rebaja de venta, el profit proyectado baja',()=>{
 const safe=produce({buyBufferPct:15,sellHaircutPct:8}).candidates[0];
 const loose=produce({buyBufferPct:0,sellHaircutPct:0}).candidates[0];
 assert(safe.estimatedProfitPerCraft<loose.estimatedProfitPerCraft);
 assert(safe.grossCapitalPerCraft>loose.grossCapitalPerCraft);
});
test('Craft Planner contiene configuración de ventas independiente y la calculadora manual permanece',()=>{
 const src=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(src,/function planBuilderPanel\(/);
 assert.match(src,/function calcPage\(\)\{return hero\('calc'\)\+batchPanel\(\)/);
 assert.match(src,/marketChips\(state\.saleMarkets,'sale'\)/);
 assert.match(src,/qualities:'1',days:state\.days/);
 assert.match(src,/reconcileMarketEvidence/);
 assert.match(src,/marketFetch\('history',missingIds/);
 assert.doesNotMatch(src,/state\.saleMarkets=new Set\(state\.markets\)/);
});

