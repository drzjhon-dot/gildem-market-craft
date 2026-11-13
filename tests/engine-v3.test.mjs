import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRoutesV3,planV3,settingsV3,routeTotals,CAPTURE,materialPrice} from '../src/engine-v3.js';
import {DEFAULTS} from '../src/planner.js';
import {slipExtra,focusThreshold} from '../src/optimizer.js';
import {top,recipes,quotes,T} from './fixtures/market-fixture.mjs';

const MARKETS=['Black Market','Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford'];
const base={...DEFAULTS,budget:30e6,tiers:[4,5,6,7,8],enchants:[0,1,2,3],journalProfit:false,trendAnalysis:false};
const run=(cfg={},extra={})=>{const c={...base,...cfg};const d=buildRoutesV3({top,recipes,quotes,config:c,selectedMarkets:MARKETS,now:T,...extra});return {d,p:planV3({...d,config:c,now:T})};};

test('Motor 3.0: nunca supera el presupuesto y el capital cuadra con las rutas',()=>{
 for(const cfg of [{},{budget:3e6},{budget:1e6,style:'prudent'},{style:'dynamic',useBudget:true},{goal:'fame'},{diversify:false}]){
  const {p}=run(cfg);const sum=p.rows.reduce((s,r)=>s+r.capital,0);
  assert(p.summary.capitalReserved<=(cfg.budget||base.budget)+1e-6);
  assert(Math.abs(sum-p.summary.capitalReserved)<1e-3);}
});
test('Motor 3.0: sin rutas a pérdida (salvo modo Fama dentro de su límite)',()=>{
 const {p}=run();assert(p.rows.length>20);assert(p.rows.every(r=>r.totalProfit>0));
 const f=run({goal:'fame',fameLossBudgetPct:5}).p;assert(f.summary.estimatedLosses<=base.budget*.05+1);
});
test('Motor 3.0: sin tope fijo de rutas; con 30M usa casi todo el presupuesto del mercado sintético',()=>{
 const {p}=run();assert(p.rows.length>40,'más de 40 rutas (el motor 2.x se quedaba en 40)');
 assert(p.summary.capitalReserved>base.budget*.8);
});
test('Motor 3.0: cada ruta respeta su capacidad (volumen Q1 × estilo × confianza)',()=>{
 for(const style of ['prudent','balanced','dynamic']){const {p}=run({style});
  for(const r of p.rows){assert(r.qty<=r.maxCrafts);
   const cap=r.horizonUnits*CAPTURE[style]*r.confidence;
   if(!r.bookBids)assert(r.qty*r.craftAmount<=Math.max(cap,r.craftAmount)+1e-9,`${r.id} ${r.city}`);}}
});
test('Motor 3.0: límites de exposición por tier/encantamiento/familia (con suelo 100/N + 5 %)',()=>{
 for(const [k,dim] of [['maxTierSharePct',r=>r.tier],['maxEnchantSharePct',r=>r.ench],['maxFamilySharePct',r=>r.family]]){
  const {p,d}=run({[k]:20});const groups=new Set(d.candidates.map(dim)).size;const lim=Math.max(.2,1/groups+.05)*Math.min(base.budget,Infinity);
  const g=new Map();for(const r of p.rows)g.set(dim(r),(g.get(dim(r))||0)+r.capital);
  for(const v of g.values())assert(v<=lim+1,`${k}: ${v} > ${lim}`);}
});
test('Motor 3.0: la venta por orden paga impuesto + publicación; el Mercado Negro solo impuesto',()=>{
 const {d}=run();const bm=d.candidates.find(r=>r.city==='Black Market'),roy=d.candidates.find(r=>r.city!=='Black Market');
 assert.equal(bm.saleMode,'instant');assert(Math.abs(bm.marketFee-.04)<1e-12);
 assert.equal(roy.saleMode,'order');assert(Math.abs(roy.marketFee-.065)<1e-12);
});
test('Motor 3.0: el precio baja al cubrir más volumen (beneficio marginal decreciente)',()=>{
 const {d}=run();const r=d.candidates.find(x=>x.maxCrafts>=10&&!x.bookBids);
 const m1=routeTotals(r,1).revenue,m10=routeTotals(r,10).revenue-routeTotals(r,9).revenue;assert(m10<m1);
});
test('Motor 3.0: compras = neto del retorno + retorno de un craft, nunca más que el bruto',()=>{
 const {p}=run({budget:5e6});
 for(const m of p.materials){assert(m.buy<=Math.ceil(m.gross-1e-8));assert(m.buy>=Math.floor(m.net));}
});
test('Motor 3.0: Focus solo donde ahorra, sin pasar del disponible',()=>{
 const no=run({focus:true,focusAvailable:20000,focusPerCraft:250}).p,off=run().p;
 assert(no.summary.focusSpent<=20000);assert(no.summary.focusSpent>0);assert(no.summary.totalProfit>=off.summary.totalProfit);
 assert.equal(focusThreshold([{focusPts:10,focusSavingPerPoint:5,max:10},{focusPts:10,focusSavingPerPoint:2,max:10}],100),5);
});
test('Motor 3.0: el encarecimiento de un material se reparte entre todas las rutas que lo usan',()=>{
 assert.equal(slipExtra(100,100),0);assert(slipExtra(300,100)>0);
 const matHist=[];for(const [k] of quotes){const [id,city]=k.split('|');if(/METALBAR|CLOTH|LEATHER|PLANKS/.test(id))matHist.push({id,city,averageDailyUnits:20});}
 const thin=(()=>{const c={...base};const d=buildRoutesV3({top,recipes,quotes,config:c,selectedMarkets:MARKETS,now:T});return planV3({...d,config:c,materialHistory:matHist,now:T});})();
 const free=run().p;
 assert(thin.summary.materialSlip>0);assert(thin.summary.totalProfit<free.summary.totalProfit);
});
test('Motor 3.0: prioridad «Más silver» compra con orden de compra cuando sale más barato',()=>{
 const q=new Map(quotes);const id='T4_METALBAR',city='Fort Sterling',o={...q.get(id+'|'+city)};o.bid={price:Math.round(o.ask.price*.8),time:T-3600e3};q.set(id+'|'+city,o);
 const order=materialPrice(q,id,'Martlock',settingsV3({...base,priority:'silver'}),T),instant=materialPrice(q,id,'Martlock',settingsV3({...base,priority:'fast-buy'}),T);
 assert.equal(order.mode,'order');assert.equal(instant.mode,'instant');assert(order.landedUnitPrice<instant.landedUnitPrice);
});
test('Motor 3.0: sin órdenes de venta visibles usa el histórico Q1 con menos confianza',()=>{
 const q=new Map(quotes);const row=top.find(r=>r.city==='Lymhurst');const k=row.id+'|Lymhurst';const o={...q.get(k)};delete o.ask;q.set(k,o);
 const d=buildRoutesV3({top:[row],recipes,quotes:q,config:base,selectedMarkets:['Lymhurst'],now:T});
 if(d.candidates.length){const r=d.candidates[0];assert.match(r.priceSource,/histórico/);assert(Math.abs(r.price-row.quality1AveragePrice*.97)<1);assert(r.confidence<1);}
 else assert.equal(d.rejected.margenNegativo+d.rejected.sinCupo,1);
});
test('Motor 3.0: el estilo dinámico marca el plan como arriesgado',()=>{
 assert.equal(run({style:'dynamic'}).p.verdict,'risky');
 assert.notEqual(run({style:'prudent'}).p.verdict,'risky');
});
