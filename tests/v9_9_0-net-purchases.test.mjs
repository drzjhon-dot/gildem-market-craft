import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shoppingWithCeilings,shoppingListText} from '../core/results-view.js';
const source=budget=>({budget,investableBudget:budget,plan:{totalCost:9000,totalProfit:4000,materials:[
 {id:'T5_METALBAR',city:'Thetford',qtyGross:800,qtyNet:602.4,unitPrice:100},
 {id:'T4_JOURNAL',city:'Lymhurst',qtyGross:2,unitPrice:500},
]}});

test('la lista de compras del plan compra el consumo NETO: el retorno reduce «A comprar», no solo «sobran»',()=>{
 const mats=shoppingWithCeilings(source(100000));
 const metal=mats.find(m=>m.id==='T5_METALBAR');
 assert.equal(metal.qtyBuy,603,'ceil(602,4): se compra el neto, no 800');
 assert.equal(metal.reused,197);
 assert.equal(metal.grossCost,603*100,'el capital usa la cantidad comprada');
 const journal=mats.find(m=>m.id==='T4_JOURNAL');
 assert.equal(journal.qtyBuy,2,'sin qtyNet (diarios) se compra el bruto');
 assert.equal(journal.reused,0);
 // más retorno (menos neto) => menos compra, mismo bruto
 const better=shoppingWithCeilings({...source(100000),plan:{...source(100000).plan,materials:[{id:'T5_METALBAR',city:'Thetford',qtyGross:800,qtyNet:417,unitPrice:100}]}});
 assert.equal(better[0].qtyBuy,417);
 assert.equal(better[0].qtyGross,800);
});
test('los techos y el texto copiable usan la cantidad comprada',()=>{
 const mats=shoppingWithCeilings(source(100000));
 const metal=mats.find(m=>m.id==='T5_METALBAR');
 assert(metal.suggestedCeiling>metal.unitPrice);
 const total=mats.reduce((a,m)=>a+(m.suggestedCeiling-m.unitPrice)*m.qtyBuy,0);
 assert(total<=4000*.25+1e-6,'el extra agregado no supera el 25 % del profit');
 const text=shoppingListText(source(100000),id=>id);
 assert(text.includes('| 603 |'),'el texto copia el neto');
 assert(!text.includes('| 800 |'));
});
test('las tablas de planes muestran neto a comprar y bruto de referencia',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert(app.includes('<th>Material</th><th>Comprar en</th><th>A comprar (neto)</th><th>Bruto de la receta</th>'));
 assert(app.includes('<th>Ciudad de compra</th><th>Precio/u</th><th>Total a comprar</th>'));
 assert(app.includes('reutilizas ${fmt(reused)}'));
 assert(app.includes('fmt(m.qtyBuy)'));
 assert.equal(app.split('Math.min(Math.ceil(m.qtyGross),Math.ceil(m.qtyNet??m.qtyGross))').length,3);
});
