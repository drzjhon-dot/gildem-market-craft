import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {groupProduction, groupSales, distributeProductionQuantity} from '../core/production-view.js';
import {rebuildPlan} from '../core/plan.js';

const material={id:'T5_LEATHER',city:'Martlock',count:3,used:2.4,unitPrice:100,ret:true};
const make=(id,city,qty,price,craft='Lymhurst')=>({
 id, city, craftCity:craft, mode:'listed', recipeKind:'equipo', qty, craftAmount:1,
 profit:price, totalProfit:price*qty, capitalPerUnit:200, cost:150,
 returnRate:24.8, maxCrafts:25, materials:[material], sell:price+1000,
 focusPerUnit:0, taxRate:.04, setupRate:.025
});
const source=[
 make('T5_SHOES_LEATHER_SET2@1','Lymhurst',4,550),
 make('T5_SHOES_LEATHER_SET2@1','Martlock',3,450),
 make('T5_SHOES_LEATHER_SET2@2','Thetford',2,800),
 make('T6_SHOES_LEATHER_SET2@1','Lymhurst',1,900),
 {...make('T5_SHOES_LEATHER_SET2@1','Black Market',1,600,'Caerleon'),mode:'instant'}
];

test('v8.4.7 agrupa el mismo objeto y encantamiento aunque se venda en varias ciudades',()=>{
 const groups=groupProduction(source);
 assert.equal(groups.length,3);
 const boots=groups.find(x=>x.id==='T5_SHOES_LEATHER_SET2@1');
 assert.equal(boots.qty,8);
 assert.equal(boots.units,8);
 assert.equal(boots.profit,4*550+3*450+600);
 assert.equal(boots.capital,8*200);
 assert.deepEqual(boots.craftCities,[{city:'Lymhurst',qty:7},{city:'Caerleon',qty:1}]);
 assert.notEqual(boots.key,groups.find(x=>x.id==='T5_SHOES_LEATHER_SET2@2').key);
});

test('v8.4.7 las ventas Royal y BM se desglosan por objeto y ciudad sin duplicaciones',()=>{
 const royal=groupSales(source,'royal'),black=groupSales(source,'black');
 assert.equal(royal.length,4);
 assert.equal(black.length,1);
 assert.equal(royal.filter(x=>x.id==='T5_SHOES_LEATHER_SET2@1').reduce((s,x)=>s+x.units,0),7);
 assert.equal(black[0].units,1);
 assert.equal(royal.reduce((s,x)=>s+x.units,0)+black.reduce((s,x)=>s+x.units,0),groupProduction(source).reduce((s,x)=>s+x.units,0));
 assert.equal(royal.reduce((s,x)=>s+x.profit,0)+black.reduce((s,x)=>s+x.profit,0),groupProduction(source).reduce((s,x)=>s+x.profit,0));
});

test('v8.4.7 editar cantidad agrupada recalcula materiales y respeta el presupuesto',()=>{
 const input=source.slice(0,2);
 const initial=rebuildPlan(input,20000);
 assert(initial.ok);
 const key=groupProduction(input)[0].key;
 const edit=distributeProductionQuantity(initial.rows,key,5);
 assert(edit.ok);
 assert.equal(edit.rows.reduce((s,r)=>s+r.qty,0),5);
 assert.equal(edit.rows[0].qty,4); // se reduce la ruta menos rentable primero
 const updated=rebuildPlan(edit.rows,20000);
 assert(updated.ok);
 assert.equal(updated.materials[0].qtyGross,15);
 assert.equal(updated.totalCost,1000);
 assert.equal(groupProduction(updated.rows)[0].units,5);
});

test('v8.4.7 una edición no puede sobrepasar la capacidad ni inventar rutas',()=>{
 const small=[{...make('T5_HEAD_LEATHER_SET1','Bridgewatch',2,100),maxCrafts:2}];
 const key=groupProduction(small)[0].key;
 const fail=distributeProductionQuantity(small,key,3);
 assert.equal(fail.ok,false);
 assert.equal(small[0].qty,2);
});

test('v8.4.7 presenta fabricación agrupada solo en Encontrar oportunidades',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/p\.autoMeta\?groupProduction\(b\.rows\)/);
 assert.match(app,/Lista exacta: qué fabricar'/);
 assert.match(app,/Distribución de ventas Royal/);
 assert.match(app,/data-plan-group/);
 assert.match(app,/changePlanGroup\(/);
 assert.match(app,/data-plan-qty/); // el plan manual conserva su edición original
});
