import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterViableCraftRoutes} from '../core/viability.js';
import {bulkMarketCandidates} from '../core/high-volume.js';
import {allocatePortfolioV6} from '../core/allocator-v6.js';
import {validateCraftPlan,variantParts} from '../core/craft-plan-controls.js';
import {rebuildPlan,fitPlan} from '../core/plan.js';
import {PLAN_STYLES} from '../core/market-impact.js';

function routes(city='Black Market'){
 const result=[];
 for(const tier of [4,5,6,7,8])for(const enchant of [0,1,2])for(const stem of ['MAIN_MACE','2H_MACE','2H_FLAIL']){
  const id=`T${tier}_${stem}${enchant?'@'+enchant:''}`;
  const capital=({4:25000,5:60000,6:180000,7:640000,8:1650000}[tier])*(enchant?1+enchant*.26:1);
  const weekly=({4:2100,5:950,6:140,7:20,8:8}[tier])/(enchant+1);
  const profit=capital*(tier>=6?.035:.20),stress=capital*(tier>=6?-.07:.12);
  result.push({id,city,craftCity:'Thetford',mode:'listed',sell:capital*1.25,cost:capital*.90,capitalPerUnit:capital,
   profit,stressProfit:stress,confidence:{score:78},ageHours:2,referenceSide:city==='Black Market'?'buy_price_max':'sell_price_min',
   activity:{observations:14,activeDays:12,count:weekly*2,observedDaily:weekly/7,medianPrice:capital*1.24},
   activity7:{observations:7,activeDays:6,count:weekly,observedDaily:weekly/7},
   demandDaily:weekly/7,qualityFactor:1,craftAmount:1,craftFame:2000*tier*tier,
   materials:[],focusPerUnit:0,competition:{known:true,unitsAhead:2,penalty:1},saleTaxPercent:4,setupRate:0,
   stationCost:capital*.005,transportCost:capital*.005});
 }
 return result;
}
function experiment({budget=20_000_000,city='Black Market',tiers=[4,5,6,7,8],enchants=[0,1,2],style=2,forceDiversity=true}={}){
 const input=routes(city).filter(r=>tiers.includes(variantParts(r.id).tier)&&enchants.includes(variantParts(r.id).enchant));
 const assessed=filterViableCraftRoutes(input,{budget,mode:city==='Black Market'?'black':'royal',diversityPriority:forceDiversity});
 const eligible=bulkMarketCandidates(assessed.accepted,{minWeekly:36,requireStress:!forceDiversity,diversityPriority:forceDiversity});
 const result=allocatePortfolioV6(eligible.accepted,budget,{goal:'balanced',horizonDays:14,capFraction:PLAN_STYLES[style].maxShare,
  intelligent:true,bulkMode:true,saturation:style,fameWeight:.5,diversityLanes:true,diversityWeight:.15,forceDiversity,
  maxPerItemFraction:.18,maxVariants:70,targetDifferentItems:24,unknownCap:0});
 const fitted=fitPlan(result.rows,budget);
 const check=validateCraftPlan(fitted.rows,{tiers,enchants,ids:input.map(x=>x.id),budget,totalCost:fitted.totalCost,market:city==='Black Market'?'black':'royal'});
 assert(check.ok,check.problems.join('; '));
 assert(fitted.totalCost<=budget);
 assert(fitted.rows.every(r=>r.qty<=r.maxCrafts&&r.totalProfit>0&&r.activity7.count>0));
 return {fitted,result,assessed,eligible,tiers:new Set(fitted.rows.map(r=>variantParts(r.id).tier)),enchants:new Set(fitted.rows.map(r=>variantParts(r.id).enchant))};
}
test('diversidad prioritaria: 5/10/20/35M BM puede incluir T6-T8 con estrés negativo y no superar presupuesto',()=>{
 const reports=[];
 for(const budget of [5_000_000,10_000_000,20_000_000,35_000_000])for(const style of [1,2,3]){
  const r=experiment({budget,style});
  assert(r.tiers.has(6)&&r.tiers.has(7)&&r.tiers.has(8),`T6/7/8 ausentes: ${JSON.stringify([...r.tiers])}, ${budget}, estilo ${style}`);
  assert(r.fitted.rows.some(x=>x.stressProfit<0),'debe permitir estrés adverso identificado');
  const lowSpent=r.fitted.rows.filter(x=>variantParts(x.id).tier<=5).reduce((sum,x)=>sum+x.qty*x.capitalPerUnit,0);
  assert(lowSpent<=budget*.55+1,`T4/T5 superan 55% en modo diversidad: ${lowSpent}/${budget}`);
  reports.push({budget,style,tiers:[...r.tiers].sort(),enchants:[...r.enchants].sort(),items:r.fitted.rows.length,
   spent:Math.round(r.fitted.totalCost),profit:Math.round(r.fitted.totalProfit)});
 }
 console.log('SIMULACION_TOP7_BM',JSON.stringify(reports));
});
test('Royal: filtros discontinuos no introducen T5 ni .1, y distintos presupuestos respetan el tope',()=>{
 for(const budget of [5_000_000,14_000_000,28_000_000])for(const style of [1,2,3]){
  const r=experiment({city:'Martlock',budget,tiers:[4,6,8],enchants:[0,2],style});
  assert(r.fitted.rows.every(x=>[4,6,8].includes(variantParts(x.id).tier)&&[0,2].includes(variantParts(x.id).enchant)));
  assert(r.fitted.totalCost<=budget);
 }
});
test('No se fabrican productos con pérdidas esperadas o sin actividad, aunque la prioridad sea diversidad',()=>{
 const invalid=routes().map(r=>({...r,profit:-1000,stressProfit:-2500}));
 const pass=filterViableCraftRoutes(invalid,{budget:30e6,mode:'black',diversityPriority:true});
 assert.equal(pass.accepted.length,0);
 const missing=routes().map(r=>({...r,activity:null,activity7:null,demandDaily:null}));
 const screened=bulkMarketCandidates(missing,{diversityPriority:true,requireStress:false});
 assert.equal(screened.accepted.length,0);
});
test('La opción de diversidad se presenta y transmite en Black y Royal, y muestra advertencia de riesgo',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert(app.includes('Forzar diversidad (priorizar T6, T7 y T8)'));
 assert(app.includes("id=\"${prefix}-qc-diversity\""));
 assert(app.includes('diversityPriority:craftPrefs.diversityPriority!==false'));
 assert(app.includes('diversityPriority:autoPrefs.diversityPriority!==false'));
 assert(app.includes('Diversidad prioritaria · riesgo de pérdida'));
});
