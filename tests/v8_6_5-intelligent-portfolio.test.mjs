import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {allocatePortfolioV6} from '../core/allocator-v6.js';
import {pendingUnitsByMarket,pendingAdjustedCapacity,investmentBudget,weightedPurchaseQuote,materialDepthAssessment,portfolioDiversityStats,stagedMaterialNeeds,observedRotation} from '../core/intelligent-portfolio.js';
import {limitRowsByMaterialBook} from '../core/procurement-liquidity.js';

const candidate=(i,{city='Black Market',id=`T${4+i%3}_SHOES_PLATE_TEST${i}`,profit=6500,capitalPerUnit=60000,marketCapacity=120,qty=0}={})=>({
 id,city,craftCity:'Martlock',mode:'listed',craftAmount:1,profit,cost:capitalPerUnit*.72,
 capitalPerUnit,stressProfit:Math.max(0,profit*.70),sell:capitalPerUnit,marketCapacity,
 activity:{observations:12,activeDays:12,observedDaily:200,count:2800},
 activity7:{observations:7,activeDays:7,observedDaily:220},demandDaily:200,
 confidence:{score:80},competition:{penalty:.92},materials:[{id:'T4_METALBAR',city:'Martlock',count:4,used:2,unitPrice:2500}]
});

const a = new Intl.NumberFormat('en-US');

test('inversión sin reserva predeterminada; presupuesto real siempre acotado',()=>{
 assert.deepEqual(investmentBudget(10_000_000),{gross:10_000_000,spendable:10_000_000,reserve:0,reservePercent:0});
 assert.equal(investmentBudget(10_000_000,{reservePercent:0}).spendable,10_000_000);
 assert.equal(investmentBudget(100,{reservePercent:85}).spendable,50);
});

test('descuenta solo el inventario confirmado pendiente de venta, no planes guardados',()=>{
 const lot={id:'T5_SHOES_PLATE_SET2',market:'Black Market',qty:24,sales:[{qty:7},{qty:3}]};
 const p=pendingUnitsByMarket([{started:true,lots:[lot,{...lot,market:'Martlock',qty:6,sales:[]}]},{started:false,lots:[{...lot,qty:99,sales:[]}]}]);
 assert.equal(p.get('T5_SHOES_PLATE_SET2|Black Market'),14);
 assert.equal(p.get('T5_SHOES_PLATE_SET2|Martlock'),6);
 assert.equal(pendingAdjustedCapacity({id:lot.id,city:lot.market,craftAmount:1},25,p),11);
 assert.equal(pendingAdjustedCapacity({id:lot.id,city:lot.market,craftAmount:3},6,p),1);
 assert.equal(pendingAdjustedCapacity({id:lot.id,city:lot.market,craftAmount:1},2,p),0);
});

test('cartera inteligente prioriza objetos distintos sin sobrecargar un solo item ni gastar reserva',()=>{
 const values=Array.from({length:18},(_,i)=>candidate(i,{city:['Black Market','Martlock','Lymhurst'][i%3],profit:2500+i*350}));
 const funds=investmentBudget(10_000_000);
 const result=allocatePortfolioV6(values,funds.spendable,{intelligent:true,useAll:true,maxPerItemFraction:.12,targetDifferentItems:12,maxVariants:15});
 assert(result.rows.length>=12,'debería repartir entre varios objetos disponibles');
 const stats=portfolioDiversityStats(result.rows,{budget:10_000_000,reserve:funds.reserve});
 assert(stats.differentItems>=12,'distintos artículos de verdad, no solo destinos');
 assert(result.totalCost<=funds.spendable);
 assert(result.totalProfit>0);
 const itemCost=new Map();
 for(const row of result.rows)itemCost.set(row.id,(itemCost.get(row.id)||0)+row.qty*row.capitalPerUnit);
 assert([...itemCost.values()].every(v=>v<=funds.spendable*.12+1e-6),'máximo 12% por objeto');
 assert(stats.perMarket.every(r=>r.capital<=funds.spendable*.46),'sin concentrar todo en una ciudad Royal cuando hay varias');
});

test('usar todo no desactiva topes; si solo hay 2 objetos viables, nunca inventa un tercero',()=>{
 const funds=investmentBudget(10_000_000,{reservePercent:0});
 const items=[candidate(1),candidate(2),candidate(3,{profit:-100})];
 const result=allocatePortfolioV6(items,funds.spendable,{intelligent:true,useAll:true,maxPerItemFraction:.12});
 assert.equal(new Set(result.rows.map(r=>r.id)).size,2);
 assert(result.totalCost<=funds.spendable*.24+1e-6);
 assert(result.rows.every(x=>x.profit>0));
});

test('el stock del Mercado Negro reduce cantidad nueva; otros mercados no se ven afectados',()=>{
 const base=candidate(1,{marketCapacity:20,id:'T5_SHOES_PLATE_SET2'});
 const pending=new Map([[`${base.id}|Black Market`,13]]);
 const black=allocatePortfolioV6([base],2_000_000,{intelligent:true,pendingByMarket:pending,maxPerItemFraction:.5});
 const elsewhere=allocatePortfolioV6([{...base,city:'Martlock'}],2_000_000,{intelligent:true,pendingByMarket:pending,maxPerItemFraction:.5});
 assert.equal(black.rows[0].maxCrafts,7);
 assert.equal(elsewhere.rows[0].maxCrafts,20);
 assert(black.rows[0].qty<=7);
});

test('una sola ciudad Royal seleccionada NO activa tope de concentración entre ciudades',()=>{
 const routes=Array.from({length:7},(_,i)=>candidate(i,{city:'Martlock',marketCapacity:75}));
 const result=allocatePortfolioV6(routes,3_000_000,{intelligent:true,useAll:true,maxPerItemFraction:.18});
 assert.equal(result.rows.length,7);
 assert(result.totalCost>3_000_000*.45,'una única ciudad seleccionada no se corta arbitrariamente al 45%');
});

test('ponderación de precios por tramos limita la compra al techo aprobado',()=>{
 const levels=[{price:100,amount:10},{price:115,amount:20},{price:170,amount:100}];
 const q=weightedPurchaseQuote(levels,20,{maxUnitPrice:120});
 assert.deepEqual(q,{requested:20,filled:20,complete:true,missing:0,cost:2150,averageUnitPrice:107.5,highestUnitPrice:115});
 const limited=weightedPurchaseQuote(levels,40,{maxUnitPrice:120});
 assert.equal(limited.filled,30);assert.equal(limited.missing,10);assert.equal(limited.complete,false);
 assert.equal(weightedPurchaseQuote([],40).filled,0);
});

test('materias caras e insuficientes no se presentan como disponibles al precio puntual',()=>{
 const mats=[{id:'T5_METALBAR',city:'Martlock',qtyGross:20,unitPrice:100}];
 const books=new Map([['T5_METALBAR|Martlock',[{price:100,amount:10},{price:107,amount:20},{price:200,amount:100}]]]);
 const d=materialDepthAssessment(mats,books,{reserveAllowance:100,profitAllowance:100,useFraction:1});
 assert(d.checked===1);
 assert.equal(d.rows[0].ceiling,105);
 assert.equal(d.rows[0].filled,10);
 assert.equal(d.rows[0].missing,10);
 assert(d.firstBatchOnly);
 const filtered=limitRowsByMaterialBook([candidate(1,{marketCapacity:50,qty:4})],books,{unknownCraftCap:0});
 assert(filtered.rows[0].qty<=4);
});

test('lista de primera compra no suma todo el objetivo y desglosa refinado por inputs',()=>{
 const rows=[{qty:20,procurementFirstBatch:4,materials:[{id:'T5_METALBAR',city:'Martlock',count:6,unitPrice:120,originalPrice:120} ]},
  {qty:10,procurementFirstBatch:0,materials:[{id:'T5_PLANKS',city:'Fort Sterling',count:3,unitPrice:90}]},
  {qty:3,procurementFirstBatch:2,materials:[{id:'T5_CLOTH',city:'Lymhurst',count:4,used:2,unitPrice:100,refining:{rrr:20,city:'Lymhurst',inputs:[{id:'T5_FIBER',city:'Lymhurst',count:3,unitPrice:22}]}}]}];
 const first=stagedMaterialNeeds(rows);
 assert.equal(first.find(x=>x.id==='T5_METALBAR').qty,24);
 assert.equal(first.find(x=>x.id==='T5_PLANKS'),undefined);
 assert.equal(first.find(x=>x.id==='T5_FIBER').qty,24);
 assert.equal(first.find(x=>x.id==='T5_CLOTH'),undefined);
});

test('Black y Royal enlazan reserva, pending sales y libro por tramos a planes nuevos',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.doesNotMatch(app,/id=\"\$\{prefix\}-qc-reserve/);
 assert.match(app,/bulkMarketCandidates\(eligible/);
 assert.match(app,/pendingUnitsByMarket\(loadPortfolios\(\)\)/);
 assert.match(app,/intelligent:true/);
 assert.match(app,/materialDepthAssessment\(constrained\.materials,books/);
 assert.match(app,/firstStageHtml/);
 assert.match(sw,/core\/intelligent-portfolio\.js/);
});

test('la reserva queda protegida también al calcular techos de compra',async()=>{
 const {shoppingWithCeilings}=await import('../core/results-view.js');
 const source={budget:10_000,investableBudget:8_500,
  plan:{totalCost:8_000,totalProfit:10_000,materials:[{id:'T4_PLANKS',city:'Lymhurst',qtyGross:20,unitPrice:100}]}};
 const ceiling=shoppingWithCeilings(source)[0].suggestedCeiling;
 assert.equal(ceiling,125,'500 silver de holgura real / 20 materiales = 25/u');
});

test('Resultados permite copiar primer lote separado de compras objetivo',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/data-action="results-copy-first"/);
 assert.match(app,/if\(action==='results-copy-first'\)/);
 assert.match(app,/stagedMaterialNeeds\(p\.plan\?\.rows/);
 assert.match(app,/No hay primer lote respaldado por órdenes/);
});


test('distingue actividad observada de velocidad de venta garantizada',()=>{
 assert.equal(observedRotation({demandDaily:500}).tier,'high');
 assert.equal(observedRotation({demandDaily:45}).tier,'medium');
 assert.equal(observedRotation({demandDaily:2}).tier,'slow');
 assert.equal(observedRotation({}).tier,'unknown');
});

test('editar cantidades no puede gastar la reserva ni evadir el máximo por artículo',async()=>{
 const {validateIntelligentEdits}=await import('../core/intelligent-portfolio.js');
 const valid=validateIntelligentEdits([{id:'T4_A',qty:8,capitalPerUnit:100}],10_000);
 assert(valid.ok);
 assert(!validateIntelligentEdits([{id:'T4_A',qty:13,capitalPerUnit:100}],10_000).ok);
 assert(!validateIntelligentEdits(Array.from({length:10},(_,i)=>({id:'T4_'+i,qty:1,capitalPerUnit:1050})),10_000).ok);
});
