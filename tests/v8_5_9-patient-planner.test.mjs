import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectPatientRoutes,patientCapacity,suggestedResearchPlan} from '../core/adaptive-planner.js';
import {allocatePortfolioV6} from '../core/allocator-v6.js';
import {fitPlan} from '../core/plan.js';

const route=(patch={})=>({id:'T5_MAIN_AXE',city:'Black Market',craftCity:'Martlock',mode:'listed',
 sell:19000,profit:900,stressProfit:-200,capitalPerUnit:12500,cost:11000,craftAmount:1,
 returnRate:25,materials:[{id:'T5_METALBAR',city:'Martlock',count:8,used:6,unitPrice:1000}],
 ageHours:2,activity:{observations:1,activeDays:1,observedDaily:0.25,count:3,days:14},
 confidence:{score:33},stationCost:0,...patch});

test('BM con rotación de 3 unidades en 14 días puede crear un lote paciente rentable',()=>{
 const r=route(), a=selectPatientRoutes([r],{budget:100000});
 assert.equal(a.accepted.length,1);
 assert.equal(a.accepted[0].marketCapacity,1);
 assert(a.accepted[0].patientWarnings.some(x=>/varios días/.test(x)));
 const draft=allocatePortfolioV6(a.accepted,100000,{capFraction:.1,unknownCap:1,minimumConfidence:0,useAll:true});
 assert.equal(draft.rows.length,1);
 const plan=fitPlan(draft.rows,100000);
 assert.equal(plan.rows.length,1);
 assert.equal(plan.rows[0].qty,1);
 assert(plan.totalProfit>0);
});
test('Royal no descarta cotizaciones con historial escaso, pero no fuerza lote grande',()=>{
 const slow=route({city:'Thetford',activity:{observations:0,activeDays:0,observedDaily:0,count:0},confidence:{score:20}});
 assert.equal(patientCapacity(slow),1);
 assert.equal(selectPatientRoutes([slow],{budget:20000}).accepted.length,1);
});
test('planes pacientes no inventan profit, precios ni presupuesto',()=>{
 assert.equal(selectPatientRoutes([route({profit:-1})],{budget:100000}).accepted.length,0);
 assert.equal(selectPatientRoutes([route({capitalPerUnit:200000})],{budget:100000}).accepted.length,0);
 assert.equal(selectPatientRoutes([route({ageHours:90})],{budget:100000}).accepted.length,0);
 assert.equal(selectPatientRoutes([route({mode:'instant',depthVerified:false})],{budget:100000}).accepted.length,0);
});
test('el motor permite una propuesta investigativa con precio objetivo, pero no inventa precio de venta',()=>{
 const rows=suggestedResearchPlan(['T5_MAIN_AXE'],{
  T5_MAIN_AXE:{city:'Martlock',materials:[{id:'T5_METALBAR',count:8}]}
 },new Map(),{budget:200000,market:'black',bmTax:2.5,listingFee:2.5,cities:['Thetford']},{
  quoteFn:()=>null,costFn:()=>({total:10000,rawMaterials:12000}),findPrice:()=>null});
 assert.equal(rows.length,1);assert.equal(rows[0].qty,1);
 assert.equal(rows[0].reference,null);
 assert(rows[0].target>10000);
 assert.equal(rows[0].ready,false);
});
test('Nivel se elimina del menú y los dos mercados conservan su motor adaptativo',()=>{
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert(!index.includes('data-nav="levelcraft"'));
 assert(index.includes('data-nav="crafting"'));
 assert(index.includes('data-nav="autocraft"'));
 assert(app.includes("if(page==='levelcraft')page='crafting'"));
 assert(app.includes('allocateCraftWithPatientFallback({candidates,viable,market,budget'));
 assert(app.includes('allocateCraftWithPatientFallback({candidates,viable,market:input.market'));
 assert(app.includes('gcp-no-craft-plan'));
 assert(!app.includes('researchPlanHtml('));
});

test('días con item_count cero no se convierten en días con actividad',async()=>{
 const {historyMetrics}=await import('../core/optimizer.js');
 const now=Date.UTC(2026,10,10,12),rows=[];
 for(let d=1;d<=10;d++)rows.push({timestamp:new Date(now-d*86400000).toISOString(),item_count:[1,5,9].includes(d)?1:0,avg_price:100});
 const m=historyMetrics(rows,14,now);
 assert.equal(m.count,3);
 assert.equal(m.activeDays,3);
 assert.equal(m.observedDaily,3/14);
 assert.equal(m.priceDays,3);
});
