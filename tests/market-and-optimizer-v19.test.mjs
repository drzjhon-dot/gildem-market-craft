import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GROUPS,BRANCHES,BRANCH_BY_KEY,catalogPage} from '../src/branches.js';
import {allocatePlan,DEFAULTS,maxCraftByDemand} from '../src/planner.js';
const make=(id,city='Black Market',price=200,cost=45,maxCrafts=100,daily=50)=>({
 id,city,routeKey:id+'|'+city,maxCrafts,craftAmount:1,history:{id,city,quality1DailyUnits:daily,quality1ActiveDays:7,days:7,averageDailyUnits:daily},
 grossCapitalPerCraft:100,expectedCostPerCraft:cost,materials:[],planningPrice:price,marketFee:0,
 expectedFamePerCraft:id.startsWith('T8_')?10000:100,estimatedProfitPerCraft:price-cost,stressProfitPerCraft:price*.9-cost,focusPerCraft:0,qty:0
});
const c=(patch={})=>({...DEFAULTS,budget:10000,tiers:[4,5,8],enchants:[0],useBudget:true,diversify:false,goal:'silver',style:'dynamic',minRoiPct:0,maxCapitalSharePct:100,stressGuard:false,sellHaircutPct:0,buyBufferPct:0,...patch});
test('Top: Refinamiento está entre ramas, sin pestaña y con cinco familias enlazadas',()=>{
 const refining=GROUPS.find(g=>g.key==='refining');assert.equal(refining.items.length,5);
 assert(BRANCH_BY_KEY.get('refine_metalbar').test('T8_METALBAR_LEVEL3@3'));
 assert(BRANCH_BY_KEY.get('refine_planks').test('T6_PLANKS'));
 assert(!BRANCH_BY_KEY.get('refine_planks').test('T6_METALBAR'));
 const html=readFileSync('index.html','utf8');assert.equal((html.match(/class="nav-link[^\"]*" data-route=/g)||[]).length,3);
 assert(!html.includes('data-route="flip"')&&!html.includes('data-route="refine"'));
 const main=readFileSync('src/main.js','utf8');assert(!main.includes('if(state.selectedBranches.size>=6)'));
 assert(!main.includes('size>6')&&!main.includes('size===6'));
});
test('Ramas sin límite: catálogo acepta 11 opciones simultáneas con paginación y datos reales',()=>{
 const ids=['T4_MAIN_AXE','T5_MAIN_SWORD','T6_2H_BOW','T8_METALBAR','T4_PLANKS','T7_CLOTH'];
 const branches=['axe','sword','bow','mace','hammer','dagger','crossbow','spear','fire','refine_metalbar','refine_planks','refine_cloth'];
 assert(branches.length>6);
 const first=catalogPage(ids,branches,{offset:0,limit:3});const second=catalogPage(ids,branches,{offset:first.nextOffset,limit:3});
 assert.equal(first.total,6);assert.equal(second.complete,true);
 assert.deepEqual(new Set([...first.ids,...second.ids]),new Set(ids));
});
test('maximiza beneficio marginal: no añade crafts que REDUCEN beneficio aunque el lote siga positivo',()=>{
 const item=make('T4_MAIN_AXE','Black Market',100,80,50,4);
 const out=allocatePlan({candidates:[item],config:c({tiers:[4],budget:10000,saleDays:7})});
 assert(out.rows.length===1);
 assert(out.rows[0].qty>=1&&out.rows[0].qty<8);
 const q=out.rows[0].qty,impact=.0392857142857;
 const profit=n=>100*n*(1-Math.min(.33,impact*n))-80*n;
 assert(profit(q+1)<=profit(q)+1e-7,'una unidad adicional no debe mejorar el beneficio');
 assert(out.summary.capitalReserved<=10000);
});
test('capital fijo y estilo cambian la asignación al cambiar parámetros reales',()=>{
 const row=make('T5_MAIN_MACE','Black Market',450,40,70,500);
 const limited=allocatePlan({candidates:[row],config:c({tiers:[5],budget:2000,style:'dynamic',useBudget:true})});
 const rich=allocatePlan({candidates:[row],config:c({tiers:[5],budget:4000,style:'dynamic',useBudget:true})});
 assert(limited.summary.capitalReserved<=2000&&rich.summary.capitalReserved<=4000);
 assert(rich.summary.crafts>=limited.summary.crafts);
 // v2.0.1: el estilo se aplica una sola vez, al calcular maxCrafts desde la actividad Q1.
 // Demanda acotada (5 Q1/día) para que el techo lo marque el mercado y no el presupuesto.
 const thin={...row,history:{...row.history,quality1DailyUnits:5,averageDailyUnits:5}};
 const styled=style=>({...thin,maxCrafts:maxCraftByDemand(thin.history,1,{...c({tiers:[5]}),style})});
 const prudent=allocatePlan({candidates:[styled('prudent')],config:c({tiers:[5],style:'prudent',useBudget:false,budget:10000})});
 const dynamic=allocatePlan({candidates:[styled('dynamic')],config:c({tiers:[5],style:'dynamic',useBudget:false,budget:10000})});
 assert(dynamic.summary.crafts>prudent.summary.crafts,`Dinámico ${dynamic.summary.crafts} > Prudente ${prudent.summary.crafts}`);
 assert.equal(dynamic.summary.style,'dynamic');assert.equal(prudent.summary.goal,'silver');
});
test('diversidad T8 elegida se reserva si es viable y NO se escapa del presupuesto',()=>{
 const options=[make('T4_MAIN_AXE','Black Market',200,20),make('T8_MAIN_MACE','Black Market',240,80)];
 const result=allocatePlan({candidates:options,config:c({budget:2200,diversify:true,tiers:[4,8],maxCapitalSharePct:70})});
 assert(result.rows.some(x=>x.id.startsWith('T8_')));
 assert(result.rows.some(x=>x.id.startsWith('T4_')));
 assert(result.summary.capitalReserved<=2200+0.01);
 for(const row of result.rows)assert(row.qty*row.grossCapitalPerCraft<=2200*.70+0.01);
});
