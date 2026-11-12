import test from 'node:test';import assert from 'node:assert/strict';
import {GROUPS,BRANCHES,catalogPage,variant} from '../src/branches.js';
import {utcRange,toUtcMs,summarizeHistory,quoteMap,cheapestMaterial,marketFetch} from '../src/market.js';
import {DEFAULTS,settings,returnRate,estimatedFame,journalEstimate} from '../src/planner.js';

const T=Date.parse('2026-11-11T19:00:00Z');const ago=new Date(T-3600e3).toISOString();
const hist=(id,city='Black Market',daily=100,price=50_000)=>({id,city,averageDailyUnits:daily,averageDailySilver:daily*price,
 averageUnitPrice:price,activeDays:7,days:7,observations:7,qualities:[1,2,3]});
const recipe=(materials,city='Martlock',amount=1)=>({city,materials:materials.map(([id,count,ret])=>({id,count,ret:ret!==false})),amount});
const quote=(id,city,ask,bid=0,at=ago)=>({item_id:id,city,quality:1,sell_price_min:ask,sell_price_min_date:at,buy_price_max:bid,buy_price_max_date:at});
const recipes={'T6_MAIN_AXE':recipe([['T6_METALBAR',16],['T6_PLANKS',8]]),
 'T7_MAIN_AXE':recipe([['T7_METALBAR',16],['T7_PLANKS',8]]),
 'T8_MAIN_AXE':recipe([['T8_METALBAR',16],['T8_PLANKS',8]]),
 'T4_MAIN_AXE':recipe([['T4_METALBAR',16],['T4_PLANKS',8]]),
 'T6_POTION_HEAL':recipe([['T6_HERB',2]],'Brecilien',5)};
const prices=[...['T4','T6','T7','T8'].flatMap((t,i)=>[
 quote(`${t}_METALBAR`,'Martlock',350+i*150),quote(`${t}_PLANKS`,'Lymhurst',250+i*160),
 quote(`${t}_MAIN_AXE`,'Black Market',0,45000+i*13000),quote(`${t}_MAIN_AXE`,'Lymhurst',47000+i*14000)
]),quote('T6_HERB','Bridgewatch',500),quote('T6_POTION_HEAL','Lymhurst',8000)];
const q=quoteMap(prices);
const config={...DEFAULTS,budget:1_000_000,tiers:[4,6,7,8],enchants:[0],saleDays:7};

// Catálogo y rama
test('11 grupos, 110 opciones, incluidas 5 ramas de refinamiento',()=>{
 assert.deepEqual(GROUPS.map(g=>g.items.length),[17,9,1,2,13,1,15,9,36,5,2]);
 assert.equal(BRANCHES.length,110);
 assert.equal(variant('T7_MAIN_AXE@3').ench,3);
 assert.equal(variant('T6_MAIN_AXE@9'),null);
});
test('distribución del catálogo cubre distintas ramas y tiers sin fabricar IDs',()=>{
 const ids=['T4_MAIN_AXE','T5_MAIN_AXE','T6_MAIN_AXE','T7_MAIN_AXE','T8_MAIN_AXE','T4_MAIN_SWORD'];
 const page=catalogPage(ids,['axe','sword'],{limit:4});
 assert(page.ids.includes('T4_MAIN_SWORD'));assert(page.ids.every(id=>ids.includes(id)));
 assert.equal(page.total,6);assert.equal(page.complete,false);
});

test('días UTC completos: se ignora el día abierto, suma calidades 1–5, deduplica puntos y pondera precios',()=>{
 const rows=[{item_id:'T6_MAIN_AXE',location:'Black Market',quality:1,data:[
  {timestamp:'2026-11-10T00:00:00',item_count:12,avg_price:200},
  {timestamp:'2026-11-10T00:00:00',item_count:12,avg_price:200},
  {timestamp:'2026-11-11T00:00:00',item_count:1000,avg_price:500}]},
  {item_id:'T6_MAIN_AXE',location:'Black Market',quality:2,data:[{timestamp:'2026-11-10T00:00:00',item_count:8,avg_price:400}]},
  {item_id:'T6_MAIN_AXE',location:'Black Market',quality:5,data:[{timestamp:'2026-11-10T00:00:00',item_count:1,avg_price:2000}]}];
 const rowsOut=summarizeHistory(rows,{days:1,now:T});assert.equal(rowsOut.length,1);
 assert.equal(rowsOut[0].units,21);assert.equal(rowsOut[0].averageDailySilver,7600);
 assert.equal(rowsOut[0].averageUnitPrice,7600/21);assert.equal(rowsOut[0].activeDays,1);
 const r=utcRange(7,T);assert.equal(r.date,'2026-11-04');assert.equal(r.end_date,'2026-11-11');
});
test('rechaza puntos sin precio válido, calidad fuera de 1–5 y fechas futuras',()=>{
 const x=summarizeHistory([{item_id:'T4_BAG',location:'Thetford',quality:6,data:[{timestamp:'2026-11-10',item_count:100,avg_price:100}]},
  {item_id:'T4_BAG',location:'Thetford',quality:1,data:[{timestamp:'2026-11-10',item_count:10,avg_price:0}]}],{days:1,now:T});assert.equal(x.length,0);
});
test('ticks .NET, epoch numérico y cotizaciones con fecha explícita',()=>{
 const ticks=(T/1000*10000000)+621355968000000000;
 assert(Math.abs(toUtcMs(ticks)-T)<1000);
 assert.equal(toUtcMs('2026-11-10T00:00:00Z'),Date.parse('2026-11-10'));
 assert.equal(cheapestMaterial(q,'T6_METALBAR',['Martlock'],48,T).price,500);
 assert.equal(cheapestMaterial(q,'T6_METALBAR',['Martlock'],0.1,T),null);
});
test('formula de retorno 18+15=>24.812% y Focus obligatorio verificado',()=>{
 const r=returnRate({recipe:{city:'Martlock'},bonusCity:true});
 assert(Math.abs(r.returnPct-24.81203)<0.001);
 assert(returnRate({recipe:{city:'Martlock'},focus:true}).returnPct>r.returnPct);
 assert.throws(()=>settings({...DEFAULTS,focus:true,focusPerCraft:0,focusAvailable:0}),/Focus/);
 assert.doesNotThrow(()=>settings({...DEFAULTS,focus:true,focusPerCraft:0,focusAvailable:10000}),'v2.5: el coste de Focus puede venir de la receta del juego');
 assert.doesNotThrow(()=>settings({...DEFAULTS,focus:true,focusPerCraft:120,focusAvailable:1000}));
});
test('fama y diarios están marcados como estimados, no acreditados',()=>{
 const f=estimatedFame('T6_MAIN_AXE',recipes.T6_MAIN_AXE,true);
 assert(f.estimated&&f.value>0);
 const journal=journalEstimate('T6_MAIN_AXE',f,3);
 assert(journal?.estimated&&journal.fractional>0);
 assert.equal(journalEstimate('T6_POTION_HEAL',null,3),null);
});

