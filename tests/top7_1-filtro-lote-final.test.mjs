import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {minUsefulLot,filterRowsByFinalLot} from '../core/allocator-v6.js';
const row=(tier,qty,capital=130000)=>({id:`T${tier}_MAIN_MACE`,city:'Black Market',depthVerified:false,qty,capitalPerUnit:capital,maxCrafts:15,profit:1200});
test('regresión: la limpieza final no elimina T6-T8 de 1 unidad en diversidad prioritaria',()=>{
 const rows=[row(4,2),row(6,1),row(7,1),row(8,1)];
 assert.ok(minUsefulLot(rows[1],15)>1,'El algoritmo previo eliminaba la T6 de una unidad');
 const result=filterRowsByFinalLot(rows,{diversityPriority:true});
 assert.deepEqual(result.accepted.map(r=>r.id),['T6_MAIN_MACE','T7_MAIN_MACE','T8_MAIN_MACE']);
 assert.deepEqual(result.rejected.map(r=>r.id),['T4_MAIN_MACE']);
});
test('con diversidad desactivada se conserva el lote mínimo comercial',()=>{
 const result=filterRowsByFinalLot([row(6,1),row(6,3),row(7,1)],{diversityPriority:false});
 assert.deepEqual(result.accepted.map(r=>r.qty),[3]);
 assert.equal(result.rejected.length,2);
});
test('una ruta sin unidades nunca supera el filtro, ni siquiera con diversidad',()=>{
 assert.equal(filterRowsByFinalLot([row(8,0)],{diversityPriority:true}).accepted.length,0);
});
test('el filtro final de Black/Royal llama al mismo criterio sin volver a minUsefulLot',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.ok(app.includes('filterRowsByFinalLot(checked.plan.rows,{diversityPriority})'));
 assert.ok(!app.includes('checked.plan.rows.filter(r=>r.qty>=minUsefulLot('));
});
test('la versión es visible en el sidebar para verificar despliegue',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(html.includes('Gildem v9.11.0'));
 assert.ok(html.includes('gildem-build-tag'));
});
