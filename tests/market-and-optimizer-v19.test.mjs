import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GROUPS,BRANCHES,BRANCH_BY_KEY,catalogPage} from '../src/branches.js';
import {DEFAULTS} from '../src/planner.js';
const make=(id,city='Black Market',price=200,cost=45,maxCrafts=100,daily=50)=>({
 id,city,routeKey:id+'|'+city,maxCrafts,craftAmount:1,history:{id,city,quality1DailyUnits:daily,quality1ActiveDays:7,days:7,averageDailyUnits:daily},
 grossCapitalPerCraft:100,expectedCostPerCraft:cost,materials:[],planningPrice:price,marketFee:0,
 expectedFamePerCraft:id.startsWith('T8_')?10000:100,estimatedProfitPerCraft:price-cost,stressProfitPerCraft:price*.9-cost,focusPerCraft:0,qty:0
});
const c=(patch={})=>({...DEFAULTS,budget:10000,tiers:[4,5,8],enchants:[0],useBudget:true,diversify:false,goal:'silver',style:'dynamic',minRoiPct:0,maxCapitalSharePct:100,stressGuard:false,sellHaircutPct:0,buyBufferPct:0,...patch});
test('Refinamiento: cinco familias en el catálogo, fuera del Top y con pestaña propia',()=>{
 const refining=GROUPS.find(g=>g.key==='refining');assert.equal(refining.items.length,5);
 assert(BRANCH_BY_KEY.get('refine_metalbar').test('T8_METALBAR_LEVEL3@3'));
 assert(BRANCH_BY_KEY.get('refine_planks').test('T6_PLANKS'));
 assert(!BRANCH_BY_KEY.get('refine_planks').test('T6_METALBAR'));
 const html=readFileSync('index.html','utf8');assert.equal((html.match(/class="nav-link[^\"]*" data-route=/g)||[]).length,5);
 assert(!html.includes('data-route="flip"')&&html.includes('data-route="refine"'));
 const main=readFileSync('src/main.js','utf8');assert(main.includes("TOP_GROUPS=GROUPS.filter(g=>g.key!=='refining')"));assert(!main.includes('if(state.selectedBranches.size>=6)'));
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
