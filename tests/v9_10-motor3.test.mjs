import test from 'node:test';
import assert from 'node:assert/strict';
import {portfolioSettings} from '../core/craft-plan-controls.js';
import {allocatePortfolioV6} from '../core/allocator-v6.js';
import {allocatePortfolioV3,allocateBestPortfolio} from '../core/motor3.js';
import {bulkMarketCandidates,bulkItemExposureFraction} from '../core/high-volume.js';
import {filterViableCraftRoutes} from '../core/viability.js';
import {PLAN_STYLES} from '../core/market-impact.js';
const stems=['MAIN_MACE','2H_MACE','2H_FLAIL','2H_MACE_MORGANA','MAIN_ROCKMACE_KEEPER'];
function fixture({city='Black Market',budget=10_000_000}={}){
 const rows=[];
 for(let tier=4;tier<=8;tier++)for(let ench=0;ench<=3;ench++)for(let stemIndex=0;stemIndex<stems.length;stemIndex++){
  const stem=stems[stemIndex],id=`T${tier}_${stem}${ench?'@'+ench:''}`;
  const price=20_000*Math.pow(2.15,tier-4)*Math.pow(2.4,ench)*(1+stemIndex*.13);
  const cost=price*.76,capitalPerUnit=cost*.97;
  // Simular actividad de alta, media y baja rotación según tier/enchant.
  const daily=Math.max(0,Math.round(600/(1+stemIndex*.48)/(1+Math.pow(tier-4,1.65)*.7)/(1+ench*ench*1.35)));
  const profit=price*.22;
  rows.push({id,city,craftCity:'Thetford',mode:'listed',sell:price,cost,capitalPerUnit,profit,stressProfit:profit*.68,
   saleTaxPercent:6.5,setupRate:.025,transportCost:100,stationCost:cost*.012,
   craftAmount:1,craftFame:1800*Math.pow(2.2,tier-4)*Math.pow(2.3,ench),
   confidence:{score:82},ageHours:2,referenceSide:city==='Black Market'?'buy_price_max':'sell_price_min',
   activity:{observations:14,count:daily*14,activeDays:14,observedDaily:daily,medianPrice:price*.97,coverage:1},
   activity7:{observations:7,count:daily*7,activeDays:7,observedDaily:daily},
   demandDaily:daily,qualityFactor:1,materials:[],
   competition:{known:true,unitsAhead:10,penalty:1},marketSignals:{bid:price*.85,ask:price,spreadPercent:15},
   salePriceProvisional:false,depthVerified:false});
 }
 return rows;
}

function run(alloc,{city='Black Market',budget=10e6,style=2,focusLimit=null}={}){
 const routes=fixture({city});
 const eligible=bulkMarketCandidates(filterViableCraftRoutes(routes,{budget,mode:city==='Black Market'?'black':'royal'}).accepted,{minWeekly:36}).accepted;
 const profile=portfolioSettings({style,fameGoal:1,eligibleItems:new Set(eligible.map(x=>x.id)).size});
 return alloc(eligible,budget,{goal:'balanced',useAll:true,capFraction:PLAN_STYLES[style].maxShare,unknownCap:0,horizonDays:7,intelligent:true,bulkMode:true,saturation:style,
  fameWeight:.5,maxPerItemFraction:Math.min(bulkItemExposureFraction(eligible),profile.itemFractionCeiling),targetDifferentItems:profile.targetDifferentItems,diversityLanes:profile.diversityLanes,maxVariants:80,focusLimit});
}
test('v9.10 · Motor 3.0: respeta presupuesto, capacidad por ruta y solo rutas con beneficio',()=>{
 for(const budget of [1e6,3e6,10e6,30e6])for(const city of ['Black Market','Lymhurst']){const p=run(allocatePortfolioV3,{city,budget});
  assert(p.totalCost<=budget+1e-6);for(const r of p.rows){assert(r.qty<=r.maxCrafts);assert(r.totalProfit>0);}}
});
test('v9.10 · Motor 3.0 corrige el plan casi vacío del Mercado Negro con 3M (el 9.9 invertía ~0,3M)',()=>{
 const old=run(allocatePortfolioV6,{budget:3e6}),best=run((c,b,o)=>allocateBestPortfolio(allocatePortfolioV6,c,b,o),{budget:3e6});
 assert(old.totalCost<1e6,'el caso de regresión sigue existiendo en el 9.9');
 assert(best.totalCost>2.5e6);assert(best.totalProfit>old.totalProfit*3);assert.equal(best.engineComparison.chosen,'motor3');
});
test('v9.10 · Con planes equivalentes se mantiene el reparto más diversificado del motor 9.9',()=>{
 const best=run((c,b,o)=>allocateBestPortfolio(allocatePortfolioV6,c,b,o),{city:'Lymhurst'});
 assert.equal(best.engineComparison.chosen,'v99');assert(best.rows.length>=best.engineComparison.motor3.routes);
});
test('v9.10 · Motor 3.0 respeta el Focus disponible',()=>{
 const routes=fixture({city:'Lymhurst'}).map(r=>({...r,focusPerUnit:500}));
 const eligible=bulkMarketCandidates(filterViableCraftRoutes(routes,{budget:10e6,mode:'royal'}).accepted,{minWeekly:36}).accepted;
 const p=allocatePortfolioV3(eligible,10e6,{useAll:true,capFraction:.12,horizonDays:7,intelligent:true,bulkMode:true,saturation:2,focusLimit:20000});
 assert(p.focusUsed<=20000);assert(p.rows.length>0);
});
