import test from 'node:test';
import assert from 'node:assert/strict';
import {diversityPolicy,diversityRouteCapacity,diversityPlanStatistics} from '../core/diversity-policy.js';
import {allocatePortfolioV6} from '../core/allocator-v6.js';
import {fitPlan} from '../core/plan.js';
import {validateCraftPlan,variantParts} from '../core/craft-plan-controls.js';
import {filterViableCraftRoutes} from '../core/viability.js';
import {bulkMarketCandidates} from '../core/high-volume.js';

function fixtures(city='Black Market'){
 const rows=[];
 for(const tier of [4,5,6,7,8])for(const enchant of [0,1,2])for(const item of ['MAIN_MACE','2H_MACE','2H_FLAIL']){
  const id=`T${tier}_${item}${enchant?'@'+enchant:''}`;
  const cost=Math.round(({4:17000,5:45000,6:150000,7:540000,8:1300000}[tier])*(1+.25*enchant));
  const weekly=({4:4900,5:2100,6:560,7:120,8:40}[tier])/(1+enchant);
  const profit=cost*(tier>=6?.06:.25);
  rows.push({id,city,craftCity:'Thetford',mode:'listed',sell:cost*1.5,cost:cost*.9,
   capitalPerUnit:cost,profit,stressProfit:tier>=6?-cost*.06:profit*.3,
   confidence:{score:80},ageHours:2,referenceSide:city==='Black Market'?'buy_price_max':'sell_price_min',
   activity:{observations:14,activeDays:12,count:weekly*2,observedDaily:weekly/7,medianPrice:cost*1.5},
   activity7:{observations:7,activeDays:7,count:weekly,observedDaily:weekly/7},
   demandDaily:weekly/7,qualityFactor:1,craftAmount:1,craftFame:2200*tier*tier*(1+enchant),
   materials:[],focusPerUnit:20,competition:{known:true,unitsAhead:1,penalty:1},saleTaxPercent:4});
 }
 return rows;
}
function simulate({city='Black Market',budget=12e6,style=2,goal=1,days=7,diversity=true,tiers=[4,5,6,7,8],enchants=[0,1,2],focusLimit=null}={}){
 const source=fixtures(city).filter(r=>tiers.includes(variantParts(r.id).tier)&&enchants.includes(variantParts(r.id).enchant));
 const viable=filterViableCraftRoutes(source,{budget,mode:city==='Black Market'?'black':'royal',diversityPriority:diversity});
 const eligible=bulkMarketCandidates(viable.accepted,{minWeekly:goal===2?24:goal===1?36:50,diversityPriority:diversity,requireStress:!diversity});
 const alloc=allocatePortfolioV6(eligible.accepted,budget,{goal:goal?'balanced':'roi',horizonDays:days,
  capFraction:diversityPolicy(style).activityShare,intelligent:true,bulkMode:true,saturation:style,
  fameWeight:goal===2?1:goal===1?.5:0,diversityLanes:true,diversityWeight:goal===2?.13:goal===1?.07:.025,
  forceDiversity:diversity,maxPerItemFraction:goal===2?.22:goal===1?.34:.6,
  targetDifferentItems:goal===2?32:goal===1?20:10,maxVariants:80,unknownCap:0,focusLimit});
 const plan=fitPlan(alloc.rows,budget,focusLimit,{preserveTiers:diversity});
 const checked=validateCraftPlan(plan.rows,{tiers,enchants,ids:source.map(r=>r.id),budget,focusLimit,totalCost:plan.totalCost,market:city==='Black Market'?'black':'royal'});
 assert.deepEqual(checked.problems,[]);
 assert(plan.rows.every(r=>r.qty<=r.maxCrafts),'no exceder volumen por ruta');
 return {plan,alloc,source,eligible,stat:diversityPlanStatistics(plan.rows,budget)};
}
test('top8: topes de lote por perfil, tier, días y observaciones AODP sin inventar movimiento',()=>{
 const one=fixtures()[0];
 const caps=[1,2,3].map(style=>diversityRouteCapacity(one,{style,horizonDays:7,available:10000}));
 assert(caps[0]<caps[1]&&caps[1]<caps[2],JSON.stringify(caps));
 assert(caps[2]<=36);
 assert.equal(diversityRouteCapacity({...one,activity:null,activity7:null,demandDaily:null},{style:3,available:10}),0);
 const longer=diversityRouteCapacity(one,{style:2,horizonDays:30,available:10000});
 assert(longer>=caps[1]);
 const expensive=fixtures().find(r=>variantParts(r.id).tier===8);
 assert(diversityRouteCapacity(expensive,{style:2,available:1000,horizonDays:7})>=1);
});
test('top8: con alta actividad T4 los lotes T4 permanecen pequeños y entra T6-T8 cuando son viables',()=>{
 for(const city of ['Black Market','Martlock'])for(const style of [1,2,3]){
  const {plan,stat}=simulate({city,style});
  assert(plan.rows.length>0);
  assert([6,7,8].every(t=>stat.byTier.some(x=>x.tier===t)),`${city}/${style}: ${JSON.stringify(stat.byTier)}`);
  assert(stat.lowShare<=diversityPolicy(style).lowTierBudgetShare+.0001);
  assert(plan.rows.filter(x=>variantParts(x.id).tier<=5).every(x=>x.qty<=diversityPolicy(style).lowLotMax7d));
 }
});
test('top8: cambio de Estilo realmente modifica los límites de lote/capital',()=>{
 const results=[1,2,3].map(style=>simulate({budget:40e6,style}));
 const low=results.map(({plan})=>plan.rows.filter(x=>variantParts(x.id).tier<=5).reduce((a,r)=>a+r.qty,0));
 assert(new Set(low).size>1,`los tres estilos produjeron igual lotes T4/T5: ${low}`);
 assert(results.every(({plan})=>plan.totalCost<=40e6));
});
test('top8: objetivos de fama cambian elección; no se inventa rentabilidad',()=>{
 const silver=simulate({budget:16e6,goal:0});
 const fame=simulate({budget:16e6,goal:2});
 const signature=x=>x.plan.rows.map(r=>r.id+':'+r.qty).sort().join(',');
 assert.notEqual(signature(silver),signature(fame),'Más fama y Más silver deben cambiar la cartera cuando hay alternativas');
 assert(fame.plan.rows.every(r=>r.totalProfit>0));
});
test('top8: combinaciones no consecutivas, presupuesto y Focus son inmutables',()=>{
 for(const budget of [5e6,8e6,25e6])for(const style of [1,2,3])for(const goal of [0,1,2]){
  const r=simulate({budget,style,goal,tiers:[4,6,8],enchants:[0,2],focusLimit:650});
  assert(r.plan.rows.every(x=>[4,6,8].includes(variantParts(x.id).tier)&&[0,2].includes(variantParts(x.id).enchant)));
  assert(r.plan.totalCost<=budget+.001);
  assert(r.plan.focusUsed<=650+.001);
 }
});
test('top8: desactivado no impone nuevos topes de diversidad',()=>{
 const input=fixtures().filter(r=>r.id==='T4_MAIN_MACE');
 const a=allocatePortfolioV6(input,12e6,{intelligent:true,bulkMode:true,horizonDays:7,saturation:3,capFraction:.35,forceDiversity:false,maxPerItemFraction:.6});
 const b=allocatePortfolioV6(input,12e6,{intelligent:true,bulkMode:true,horizonDays:7,saturation:3,capFraction:.35,forceDiversity:true,maxPerItemFraction:.6});
 assert(a.rows.length&&b.rows.length);
 assert(a.rows[0].qty>b.rows[0].qty,`${a.rows[0].qty} vs ${b.rows[0].qty}`);
});
test('top8: sin historial AODP o con profit esperado negativo no se fuerza un tier',()=>{
 const routes=fixtures().map(r=>({...r,activity:null,activity7:null,demandDaily:null}));
 assert.equal(bulkMarketCandidates(routes,{diversityPriority:true}).accepted.length,0);
 const bad=fixtures().map(r=>({...r,profit:-100}));
 assert.equal(filterViableCraftRoutes(bad,{budget:25e6,diversityPriority:true}).accepted.length,0);
});
