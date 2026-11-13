import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {groupProduction,groupLogistics,distributeProductionQuantity} from '../core/production-view.js';
import {listingCapacity} from '../core/demand-first.js';
import {bulkItemExposureFraction} from '../core/high-volume.js';
import {allocatePortfolioV6} from '../core/allocator-v6.js';
const content=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const sample=[
 {id:'T4_CLOTH@2',qty:650,craftAmount:1,city:'Martlock',craftCity:'Lymhurst',mode:'listed',profit:700,totalProfit:455000,capitalPerUnit:1000,allocation:650000,maxCrafts:2000},
 {id:'T4_CLOTH@2',qty:650,craftAmount:1,city:'Thetford',craftCity:'Lymhurst',mode:'listed',profit:500,totalProfit:325000,capitalPerUnit:1000,allocation:650000,maxCrafts:1600},
 {id:'T4_CLOTH@2',qty:650,craftAmount:1,city:'Bridgewatch',craftCity:'Lymhurst',mode:'listed',profit:400,totalProfit:260000,capitalPerUnit:1000,allocation:650000,maxCrafts:1700},
 {id:'T4_CLOTH@1',qty:40,craftAmount:1,city:'Martlock',craftCity:'Lymhurst',mode:'listed',profit:1000,totalProfit:40000,capitalPerUnit:1000,allocation:40000,maxCrafts:1300}
];
test('un mismo item se agrupa aunque tenga distintos destinos, y encantamientos distintos siguen separados',()=>{
 const groups=groupProduction(sample);assert.equal(groups.length,2);
 const item=groups.find(x=>x.id==='T4_CLOTH@2');assert.equal(item.qty,1950);assert.equal(item.units,1950);
 assert.equal(item.profit,1040000);assert.equal(item.capital,1950000);assert.equal(item.sourceIndices.length,3);
});
test('logística conserva destinos, cantidades y profit sin duplicar capital',()=>{
 const logistics=groupLogistics(sample);assert.equal(logistics.length,4);
 assert.deepEqual(new Set(logistics.map(x=>x.city)),new Set(['Martlock','Thetford','Bridgewatch']));
 assert.equal(logistics.reduce((sum,r)=>sum+r.units,0),1990);
 assert.equal(logistics.reduce((sum,r)=>sum+r.profit,0),1080000);
});
test('la edición agrupada ajusta rutas reales sin aumentar un mercado más allá de su capacidad',()=>{
 const c=sample.map(x=>({...x}));const reduced=distributeProductionQuantity(c,'T4_CLOTH@2|equipo',1700);
 assert(reduced.ok);assert.equal(reduced.rows.filter(x=>x.id==='T4_CLOTH@2').reduce((sum,x)=>sum+x.qty,0),1700);
 assert.equal(reduced.rows.find(x=>x.id==='T4_CLOTH@1').qty,40);
});
test('la capacidad depende de la actividad observada, no del antiguo tope fijo de 650',()=>{
 const route={id:'T4_CLOTH',city:'Martlock',mode:'listed',demandDaily:20000,craftAmount:1,ageHours:1,confidence:{score:99}};
 assert(listingCapacity(route,{horizonDays:14,share:.10})>650);
 assert.equal(listingCapacity(route,{horizonDays:14,share:.10}),6000);
});
test('dos objetos rentables no tienen techo de 80% total por exposición',()=>{
 assert(bulkItemExposureFraction([{id:'A'},{id:'B'}])>=.5);
});
test('Resultados muestra producción agrupada y logística en tarjetas sin tabla ancha de fabricación',()=>{
 const js=content('app.js'),css=content('styles.css');
 const results=js.slice(js.indexOf('function resultsPage(){'),js.indexOf('async function resultsCopyShopping('));
 assert(results.includes('groupProduction(rows)'));assert(results.includes('groupLogistics(rows)'));
 assert(results.includes('gcp-production-grid'));assert(results.includes('gcp-logistics-grid'));assert(results.includes('gcp-shopping-grid'));
 assert(results.includes('data-plan-group'));assert(!results.includes('gcp-result-scroll'));
 assert(css.includes('.gcp-results .gcp-compact-grid'));assert(css.includes('grid-template-columns:minmax(0,1fr)'));
});

test('presupuesto de 10M se reparte entre dos objetos con demanda suficiente sin topes de ciudad o tier artificiales',()=>{
 const base={city:'Martlock',craftCity:'Lymhurst',mode:'listed',sell:1400,profit:300,stressProfit:140,
  cost:800,capitalPerUnit:1000,ageHours:1,craftAmount:1,materials:[],confidence:{score:90},
  activity:{observations:14,activeDays:14,count:200000,observedDaily:14000},
  activity7:{observations:7,count:100000,observedDaily:14000},demandDaily:14000};
 const routes=[{...base,id:'T4_CLOTH'},{...base,id:'T4_CLOTH@1'}];
 const share=bulkItemExposureFraction(routes);
 const result=allocatePortfolioV6(routes,10000000,{intelligent:true,bulkMode:true,useAll:true,
  capFraction:.10,horizonDays:14,maxPerItemFraction:share,maxVariants:65,targetDifferentItems:28});
 assert.equal(result.rows.length,2);
 assert(result.totalCost>=9900000,`solo emplea ${result.totalCost} de 10M`);
 assert(result.totalCost<=10000000);
 assert(result.rows.every(x=>x.totalProfit>0));
});
