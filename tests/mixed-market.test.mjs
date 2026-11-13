import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateCraftPlan,selectCraftSaleRoutes} from '../core/engine.js';

const mk=(id,city,profit,capitalPerUnit=100,dailySales=null)=>({
  id,city,craftCity:'Martlock',mode:city==='Black Market'?'instant':'listed',
  profit,capitalPerUnit,cost:capitalPerUnit*.8,dailySales,
  materials:[{id:'T4_METALBAR',count:8,used:6,unitPrice:10,city:'Martlock'}]
});

test('el modo combinado selecciona una ruta BM y hasta tres Royal por objeto',()=>{
 const offers=[mk('A','Black Market',30),mk('A','Lymhurst',25),mk('A','Thetford',28),mk('A','Bridgewatch',21),mk('A','Martlock',18),mk('B','Fort Sterling',10)];
 const mixed=selectCraftSaleRoutes(offers,'mixed');
 assert.equal(mixed.filter(x=>x.id==='A'&&x.city==='Black Market').length,1);
 assert.equal(mixed.filter(x=>x.id==='A'&&x.city!=='Black Market').length,3);
 assert.equal(selectCraftSaleRoutes(offers,'black').every(x=>x.city==='Black Market'),true);
 assert.equal(selectCraftSaleRoutes(offers,'royal').every(x=>x.city!=='Black Market'),true);
});

test('un mismo objeto se divide en Royal y BM sin duplicar unidades ni capital',()=>{
 const a=mk('T4_SHOES_PLATE_SET1','Black Market',50,100,null);
 const b=mk('T4_SHOES_PLATE_SET1','Martlock',40,100,20);
 const p=allocateCraftPlan(selectCraftSaleRoutes([a,b],'mixed'),1000,{useAll:true,unknownCap:2,capFraction:.25,ensureBothMarkets:true});
 assert.ok(p.rows.some(x=>x.city==='Black Market'));
 assert.ok(p.rows.some(x=>x.city==='Martlock'));
 const totalUnits=p.rows.reduce((s,x)=>s+x.qty,0);
 assert.equal(totalUnits,7);
 assert.equal(p.totalCost,700);
 assert.equal(p.remaining,300);
 assert.equal(p.materials[0].qtyGross,totalUnits*8);
 assert.equal(p.totalProfit,p.rows.reduce((s,x)=>s+x.qty*x.profit,0));
 assert.equal(p.cities.reduce((s,x)=>s+x.qty,0),totalUnits);
});

test('combinado prioriza ambos mercados con capital limitado si las dos ventas son viables',()=>{
 const bm=mk('A','Black Market',10,70);
 const royal=mk('B','Lymhurst',100,90,40);
 const p=allocateCraftPlan([bm,royal],180,{useAll:true,unknownCap:2,capFraction:.2,ensureBothMarkets:true});
 assert.deepEqual(new Set(p.rows.map(x=>x.city)),new Set(['Black Market','Lymhurst']));
 assert.ok(p.totalCost<=180);
});

test('no inventa una venta BM cuando no hay beneficio o no existe cotización',()=>{
 const onlyRoyal=selectCraftSaleRoutes([mk('A','Black Market',-10),mk('A','Martlock',12)],'mixed');
 const p=allocateCraftPlan(onlyRoyal,1000,{useAll:true,ensureBothMarkets:true});
 assert.equal(p.rows.length,1);
 assert.equal(p.rows[0].city,'Martlock');
});

test('no fuerza ambos mercados si una unidad en cada uno no cabe en el presupuesto',()=>{
 const p=allocateCraftPlan([mk('A','Black Market',30,150),mk('B','Martlock',40,150)],200,{useAll:true,unknownCap:3,ensureBothMarkets:true});
 assert.equal(p.rows.reduce((n,x)=>n+x.qty,0),1);
 assert.ok(p.totalCost<=200);
});

test('en modo cautela aplica 30% de capital por objeto incluso dividido entre mercados',()=>{
 const p=allocateCraftPlan([mk('A','Black Market',70,100),mk('A','Martlock',50,100,100)],1000,{useAll:false,capFraction:1,unknownCap:10,ensureBothMarkets:true});
 assert.ok(p.rows.reduce((s,x)=>s+x.allocation,0)<=300);
 assert.ok(p.rows.some(x=>x.city==='Black Market'));
 assert.ok(p.rows.some(x=>x.city==='Martlock'));
});
