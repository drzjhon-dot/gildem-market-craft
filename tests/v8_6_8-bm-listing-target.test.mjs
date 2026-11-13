import test from 'node:test';
import assert from 'node:assert/strict';
import {historicalBmListingTarget,chooseBmListingPrice} from '../core/bm-listing-prices.js';
import {readFileSync} from 'node:fs';
const now=Date.UTC(2026,10,10,15);
const history=(count=432,price=31800,days=10)=>Array.from({length:days},(_,i)=>({timestamp:new Date(now-(i+1)*86400000).toISOString(),item_count:count,avg_price:price}));
test('arco T6 con actividad de 432 por día permite una referencia histórica prudente, nunca un bid ejecutable',()=>{
 const r=historicalBmListingTarget(history(),{price:19000},{now});
 assert(r);assert.equal(r.price,26600);assert.equal(r.reference,'historical-bm-target');assert(r.provisional);
 assert.equal(r.metric.observedDaily,4320/14);
});
test('si el historial no tiene cuatro días activos o menos de 50 a la semana, no se inventa un precio',()=>{
 assert.equal(historicalBmListingTarget(history(432,31800,3),{price:21000},{now}),null);
 assert.equal(historicalBmListingTarget(history(1,31800,10),{price:21000},{now}),null);
});
test('no fabrica sobre una referencia del BM demasiado antigua o volátil',()=>{
 const old=history().map((x,i)=>({...x,timestamp:new Date(now-(i+8)*86400000).toISOString()}));
 assert.equal(historicalBmListingTarget(old,{price:18000},{now}),null);
 const wildly=history().map((x,i)=>({...x,avg_price:i%2?20000:100000}));
 assert.equal(historicalBmListingTarget(wildly,{price:18000},{now}),null);
});
test('si el bid actual ya cubre incluso el escenario de estrés, se prefiere la cotización actual',()=>{
 const p=historicalBmListingTarget(history(),{price:26000},{now});
 const chosen=chooseBmListingPrice({price:26000},p,{cost:18000,materialsCost:9000});
 assert.equal(chosen.source,'live-bid');assert(!chosen.provisional);
});
test('un objetivo histórico solo entra como escenario condicionado si sobrevive al estrés',()=>{
 const p=historicalBmListingTarget(history(),{price:19000},{now});
 const chosen=chooseBmListingPrice({price:19000},p,{cost:18000,materialsCost:4000});
 assert.equal(chosen.source,'historical-target');assert(chosen.provisional);
 const reject=chooseBmListingPrice({price:19000},p,{cost:28000,materialsCost:3000});
 assert.equal(reject.source,'none');
});
test('la interfaz no muestra planes de investigación ni ventas ficticias cuando falta margen',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert(!app.includes('researchPlanHtml('));
 assert(!app.includes('researchPlan:'));
 assert(!app.includes('export-research'));
 assert(app.includes('gcp-no-craft-plan'));
 assert(app.includes('historicalBmListingTarget('));
 assert(app.includes('chooseBmListingPrice('));
 assert(app.includes('Ampliar búsqueda'));
});

test('seis arcos con alta actividad y costes favorables pueden componer un plan BM de 5M sin fabricar a pérdidas',async()=>{
 const {bulkMarketCandidates,bulkItemExposureFraction}=await import('../core/high-volume.js');
 const {selectPatientRoutes}=await import('../core/adaptive-planner.js');
 const {allocatePortfolioV6}=await import('../core/allocator-v6.js');
 const {fitPlan}=await import('../core/plan.js');
 const rows=[
  ['T6_2H_BOW',432,31800,18000,19000],
  ['T6_2H_WARBOW',350,33400,19500,21000],
  ['T6_2H_LONGBOW',386,26000,15400,16000],
  ['T5_2H_BOW',385,13700,7600,8500],
  ['T5_2H_WARBOW',366,12800,6900,8100],
  ['T5_2H_LONGBOW',256,10600,5700,6900]
 ];
 const candidates=[];
 for(const [id,daily,median,cost,bid] of rows){
  const metric=historicalBmListingTarget(history(daily,median),{price:bid},{now});
  assert(metric,`${id}: no price`);
  const net=metric.price*.95,profit=net-cost,stressProfit=metric.price*.92*.95-cost-cost*.07;
  if(profit<=0||stressProfit<=0)continue;
  candidates.push({id,city:'Black Market',craftCity:'Lymhurst',mode:'listed',cost,capitalPerUnit:cost,profit,stressProfit,sell:metric.price,
   salePriceProvisional:true,ageHours:metric.ageHours,craftAmount:1,materials:[],focusPerUnit:0,confidence:{score:60},
   activity:metric.metric,activity7:metric.metric,demandDaily:daily,at:metric.at});
 }
 assert(candidates.length>=5);
 const accepted=bulkMarketCandidates(candidates).accepted;
 assert(accepted.length>=5);
 const patient=selectPatientRoutes(accepted,{budget:5_000_000,horizonDays:14,observedShare:.10});
 const fraction=bulkItemExposureFraction(patient.accepted);
 const allocation=allocatePortfolioV6(patient.accepted,5_000_000,{intelligent:true,bulkMode:true,capFraction:.10,horizonDays:14,
  useAll:true,maxPerItemFraction:fraction,maxVariants:65,targetDifferentItems:28});
 const plan=fitPlan(allocation.rows,5_000_000);
 assert(plan.rows.length>=5,`solamente ${plan.rows.length} arcos`);
 assert(plan.totalProfit>0);
 assert(plan.totalCost>=3_500_000,`no se aprovechó suficiente capital simulado: ${plan.totalCost}`);
 assert(plan.totalCost<=5_000_000);
});
