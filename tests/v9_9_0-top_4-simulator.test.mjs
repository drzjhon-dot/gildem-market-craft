import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {exactBudget,validateCraftPlan,diversifiedRecipeIds,portfolioSettings} from '../core/craft-plan-controls.js';
import {allocatePortfolioV6} from '../core/allocator-v6.js';
import {bulkMarketCandidates,bulkItemExposureFraction} from '../core/high-volume.js';
import {filterViableCraftRoutes} from '../core/viability.js';
import {PLAN_STYLES} from '../core/market-impact.js';
import {addressableDemand,qualityVolumeIndex} from '../core/market-mechanics.js';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
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
function plan(routes,{budget=10_000_000,style=2,fameGoal=1,tiers=[4,5,6,7,8],enchants=[0,1,2,3]}={}){
 const selected=routes.filter(r=>tiers.includes(Number(r.id[1]))&&enchants.includes(Number(r.id.split('@')[1]||0)));
 const screened=filterViableCraftRoutes(selected,{budget,mode:selected[0]?.city==='Black Market'?'black':'royal'}).accepted;
 const minWeekly=fameGoal===2?24:fameGoal===1?36:50;
 const eligible=bulkMarketCandidates(screened,{minWeekly}).accepted;
 const profile=portfolioSettings({style,fameGoal,eligibleItems:new Set(eligible.map(x=>x.id)).size});
 const result=allocatePortfolioV6(eligible,budget,{goal:'balanced',useAll:true,capFraction:PLAN_STYLES[style].maxShare,unknownCap:0,horizonDays:7,
  intelligent:true,bulkMode:true,saturation:style,fameWeight:[0,.5,1][fameGoal],maxPerItemFraction:Math.min(bulkItemExposureFraction(eligible),profile.itemFractionCeiling),
  targetDifferentItems:profile.targetDifferentItems,diversityLanes:profile.diversityLanes,diversityWeight:profile.diversityWeight,maxVariants:80});
 const safety=validateCraftPlan(result.rows,{tiers,enchants,ids:selected.map(r=>r.id),budget,market:selected[0]?.city==='Black Market'?'black':'royal'});
 return {result,safety,eligibleCount:eligible.length,unique:new Set(result.rows.map(x=>x.id)).size,lanes:new Set(result.rows.map(x=>x.id[1]+'.'+(x.id.split('@')[1]||0))).size};
}
test('presupuesto: importe exacto válido, no se acepta 999, 0, negativos, decimales ni exceso',()=>{
 assert.equal(exactBudget('7850000'),7850000);assert.equal(exactBudget(1_000),1000);
 for(const v of [null,0,-1,999,3.4,Infinity,1_000_000_000_001,'abc'])assert.throws(()=>exactBudget(v));
});
test('búsqueda balanceada: el límite no elimina todos los T altos y encantamientos .2/.3',()=>{
 const ids=stems.flatMap(stem=>[4,5,6,7,8].flatMap(t=>[0,1,2,3].map(e=>`T${t}_${stem}${e?'@'+e:''}`)));
 const pick=diversifiedRecipeIds(ids,{limit:40});
 assert.equal(pick.length,40);assert.equal(new Set(pick).size,40);
 const types=new Set(pick.map(id=>id[1]+'.'+(id.split('@')[1]||0)));
 assert(types.size>=18,`${types.size} combinaciones distintas`);
});
test('bloqueo final: tiers, enchant, rama, ciudad y presupuesto estrictos',()=>{
 const row={id:'T5_MAIN_MACE@1',city:'Black Market',qty:5,capitalPerUnit:10000};
 const opts={tiers:[5],enchants:[1],ids:[row.id],budget:60000,market:'black'};
 assert(validateCraftPlan([row],opts).ok);
 for(const bad of [{id:'T4_MAIN_MACE@1'},{id:'T5_MAIN_MACE@2'},{id:'T5_2H_BOW@1'},{city:'Lymhurst'},{qty:7}]){
  const r=validateCraftPlan([{...row,...bad}],opts);assert(!r.ok,JSON.stringify(bad));
 }
});
test('el coste total bruto de compras y diarios tampoco puede sobrepasar el capital, aunque las filas asignadas parezcan caber',()=>{
 const row={id:'T5_MAIN_MACE@1',city:'Black Market',qty:5,capitalPerUnit:10000};
 const opts={tiers:[5],enchants:[1],ids:[row.id],budget:60000,market:'black'};
 assert(validateCraftPlan([row],{...opts,totalCost:59000}).ok);
 assert(!validateCraftPlan([row],{...opts,totalCost:61000}).ok);
 assert(!validateCraftPlan([row],{...opts,totalCost:NaN}).ok);
});
test('simulación 100 variantes de mazas BM: los nueve perfiles no exceden presupuesto ni mercado',()=>{
 const rows=fixture(),results=[];
 for(const style of [1,2,3])for(const fameGoal of [0,1,2]){
  const run=plan(rows,{style,fameGoal});
  assert(run.safety.ok,run.safety.problems.join('; '));
  assert(run.result.totalCost<=10_000_000);
  assert(run.result.rows.every(x=>x.qty<=x.maxCrafts&&x.totalProfit>0));
  assert(run.result.rows.every(x=>x.activity7.observations>0&&x.stressProfit>0));
  results.push({style,fameGoal,capital:Math.round(run.result.totalCost),unique:run.unique,lanes:run.lanes,profit:Math.round(run.result.totalProfit),fame:Math.round(run.result.totalFame||0)});
 }
 console.log('SIMULACION_MAZAS_BM',JSON.stringify(results));
 assert(new Set(results.map(r=>`${r.capital}|${r.unique}|${r.lanes}|${r.fame}`)).size>=3,'Estilos y objetivos deben producir planes distintos cuando hay suficientes oportunidades');
});
test('simulación Royal: tiers 5,7; ench .0,.2; presupuestos distintos sin fugas',()=>{
 const rows=fixture({city:'Martlock'});
 for(const budget of [750_000,3_500_000,11_250_000])for(const style of [1,2,3]){
  const run=plan(rows,{budget,style,fameGoal:2,tiers:[5,7],enchants:[0,2]});
  assert(run.safety.ok,run.safety.problems.join('; '));
  assert(run.result.rows.every(x=>[5,7].includes(Number(x.id[1]))&&[0,2].includes(Number(x.id.split('@')[1]||0))));
  assert(run.result.totalCost<=budget);
 }
});
test('simulación pocas ofertas y margen insuficiente: conserva capital, no usa rutas no viables',()=>{
 const items=fixture().map((x,i)=>({...x,stressProfit:i%11===0?x.stressProfit:-100,activity7:i%11===0?x.activity7:{observations:0,count:0},
   demandDaily:i%11===0?x.demandDaily:null,activity:i%11===0?x.activity:{observations:0,activeDays:0}}));
 const out=plan(items,{budget:10_000_000,style:1,fameGoal:2});
 assert(out.safety.ok);assert(out.unique<=9);assert(out.result.remaining>0);
});
test('historial de las calidades 2–5 es complementario y no convierte actividad en ventas certificadas',()=>{
 const result=addressableDemand(100,{2:10,3:8,4:6,5:2});
 assert.equal(result.daily,126);assert.equal(result.byQuality[5],2);
 assert.equal(addressableDemand(null,{2:100}).daily,null);
});
test('interfaz: tabla de Top Mercado tiene scroll y columnas gemelas; controles manuales y protección final',()=>{
 const app=read('app.js'),css=read('styles.css');
 assert(app.includes('gcp-top-scroll'));assert(css.includes('.gcp-top-list>.gx-top-row'));
 assert(app.includes('qc-budget-custom')&&app.includes('data-qc-budget-custom'));
 assert(app.includes("validateCraftPlan(plan.rows,{tiers:qcSelectedSettings('craft')"));
 assert(app.includes("validateCraftPlan(plan.rows,{tiers:qcSelectedSettings('auto')"));
 assert(app.includes("sendPlanToCalculator('crafting')")&&app.includes("sendPlanToCalculator('autocraft')"));
});
test('objetivo Más fama realmente prioriza rutas de fama destacada cuando el mercado admite alternativas',()=>{
 const candidates=fixture().map((r,i)=>({...r,craftFame:r.craftFame*(i%13===0?9:1)}));
 const silver=plan(candidates,{style:2,fameGoal:0});
 const fame=plan(candidates,{style:2,fameGoal:2});
 console.log('SIMULACION_FAMA_COMPARADA',JSON.stringify({silverFame:silver.result.totalFame,silverProfit:silver.result.totalProfit,fameFame:fame.result.totalFame,fameProfit:fame.result.totalProfit,silverItems:silver.unique,fameItems:fame.unique}));
 assert(fame.result.totalFame>silver.result.totalFame,'Más fama debe superar a Más silver si existen rutas con fama superior y liquidez');
});
