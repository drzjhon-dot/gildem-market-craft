import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyTopFilters,sanitizeTopFilter,activeFilterCount,tiersInRows} from '../src/top-filters.js';
const r=(id,q1,silver,city='Black Market',series=null)=>({id,city,quality1DailyUnits:q1,averageDailySilver:silver,quality1Series:series});
const rows=[r('T4_MAIN_MACE',30,200000),r('T5_MAIN_MACE@1',8,900000),r('T6_2H_MACE',3,1500000),r('T8_MAIN_MACE@2',1,6000000),
 r('T6_MAIN_AXE',12,700000,'Black Market',[[2,1],[1,1],[2,1],[60,1],[1,1],[2,1],[2,1]]),r('T4_METALBAR',500,300000,'Martlock')];
const ids=list=>list.map(x=>x.id);
test('v2.2 filtros: tier y encantamiento',()=>{
 assert.deepEqual(ids(applyTopFilters(rows,{tiers:[6]})),['T6_2H_MACE','T6_MAIN_AXE']);
 assert.deepEqual(ids(applyTopFilters(rows,{tiers:[4,5],enchants:[0]})),['T4_MAIN_MACE','T4_METALBAR']);
});
test('v2.2 filtros: vendidos Q1/día y silver/día mínimos',()=>{
 assert.deepEqual(ids(applyTopFilters(rows,{minQ1:10})),['T4_MAIN_MACE','T6_MAIN_AXE','T4_METALBAR']);
 assert.deepEqual(ids(applyTopFilters(rows,{minSilver:1_000_000})),['T6_2H_MACE','T8_MAIN_MACE@2']);
});
test('v2.2 filtros: búsqueda por nombre en español (sin tildes) o por ID',()=>{
 const names={T6_2H_MACE:'Maza pesada del adepto',T4_MAIN_MACE:'Maza del adepto'};
 assert.deepEqual(ids(applyTopFilters(rows,{search:'PESADA'},{names})),['T6_2H_MACE']);
 assert.deepEqual(ids(applyTopFilters(rows,{search:'metalbar'},{names})),['T4_METALBAR']);
});
test('v2.2 filtros: señal Q1 y solo marcados',()=>{
 assert.deepEqual(ids(applyTopFilters(rows,{signal:'warn'})),['T6_MAIN_AXE']);
 assert(!ids(applyTopFilters(rows,{signal:'clean'})).includes('T6_MAIN_AXE'));
 assert.deepEqual(ids(applyTopFilters(rows,{onlyMarked:true},{marked:new Set(['T5_MAIN_MACE@1|Black Market'])})),['T5_MAIN_MACE@1']);
});
test('v2.2 filtros: valores inválidos se limpian y se cuentan los activos',()=>{
 const f=sanitizeTopFilter({tiers:['6',9,'x'],minQ1:-5,minSilver:'abc',signal:'hack'});
 assert.deepEqual(f.tiers,[6]);assert.equal(f.minQ1,0);assert.equal(f.minSilver,0);assert.equal(f.signal,'all');
 assert.equal(activeFilterCount(f),1);assert.equal(activeFilterCount({}),0);
 assert.deepEqual(tiersInRows(rows),[4,5,6,8]);
});
test('v2.2 interfaz: filtros persistentes, marcas que no se pierden al filtrar',()=>{
 const js=readFileSync('src/main.js','utf8');
 for(const x of ['id="top-filters"','id="top-search"','id="top-min-q1"','id="top-min-silver"','id="top-signal"','id="top-detailed"','topFilter:state.topFilter'])assert(js.includes(x),x);
 // El envío al Planner usa todas las filas marcadas, no solo las visibles con el filtro actual.
 assert(js.includes('markedItemsForPlanner(visibleTop(),state.marked'));
});
