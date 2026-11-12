import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rankEntries,sortRowsByTier} from '../src/market.js';
const rows=[
 {id:'T6_MAIN_MACE',city:'Martlock',averageDailySilver:80,averageDailyUnits:8,totalProfit:200},
 {id:'T4_MAIN_MACE',city:'Black Market',averageDailySilver:100,averageDailyUnits:10,totalProfit:300},
 {id:'T8_MAIN_MACE',city:'Thetford',averageDailySilver:200,averageDailyUnits:3,totalProfit:600},
 {id:'T5_MAIN_MACE@1',city:'Martlock',averageDailySilver:70,averageDailyUnits:5,totalProfit:400},
 {id:'T5_MAIN_MACE',city:'Martlock',averageDailySilver:110,averageDailyUnits:9,totalProfit:500},
 {id:'T6_MAIN_MACE@2',city:'Martlock',averageDailySilver:200,averageDailyUnits:4,totalProfit:50}
];
const ids=arr=>arr.map(r=>r.id);
test('Top Mercado: T4 a T8 con encantamientos agrupados, sin mutar la muestra',()=>{
 const source=ids(rows);
 assert.deepEqual(ids(rankEntries(rows,'tier-asc')),['T4_MAIN_MACE','T5_MAIN_MACE','T5_MAIN_MACE@1','T6_MAIN_MACE','T6_MAIN_MACE@2','T8_MAIN_MACE']);
 assert.deepEqual(ids(rows),source);
});
test('Top Mercado: orden descendente con tiers correctos',()=>{
 assert.deepEqual(ids(rankEntries(rows,'tier-desc')),['T8_MAIN_MACE','T6_MAIN_MACE','T6_MAIN_MACE@2','T5_MAIN_MACE','T5_MAIN_MACE@1','T4_MAIN_MACE']);
});
test('Top Mercado: silver conserva el orden anterior',()=>{
 const actual=rankEntries(rows,'silver');assert.equal(actual[0].id,'T6_MAIN_MACE@2');
 assert.equal(actual[1].id,'T8_MAIN_MACE');
});
test('Craft Planner: ordenar el resultado no cambia crafts, presupuesto ni profit',()=>{
 const original=rows.map(r=>({...r,qty:10,grossCapitalPerCraft:1000}));
 const before=original.reduce((n,r)=>n+r.totalProfit,0);
 const sorted=sortRowsByTier(original,'tier-desc',(a,b)=>b.totalProfit-a.totalProfit);
 assert.equal(sorted[0].id,'T8_MAIN_MACE');
 assert.equal(sorted.reduce((n,r)=>n+r.totalProfit,0),before);
 assert.equal(sorted.reduce((n,r)=>n+r.qty*r.grossCapitalPerCraft,0),60000);
 assert.deepEqual(ids(original),ids(rows));
 assert.deepEqual(ids(sortRowsByTier(original,'engine')),ids(rows));
});
test('Interfaz: selector en ambos resultados, persistencia y tres pestañas',()=>{
 const js=readFileSync('src/main.js','utf8'),html=readFileSync('index.html','utf8');
 assert(js.includes('id="top-sort-inline"')&&js.includes('id="plan-result-sort"'));
 assert(js.includes('planResultSort:state.planResultSort'));
 assert(js.includes("x.id==='plan-result-sort'"));
 assert.equal((html.match(/class="nav-link[^"]*" data-route=/g)||[]).length,3);
});
