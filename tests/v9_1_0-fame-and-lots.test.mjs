import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {allocatePortfolioV6,minUsefulLot,fameFactorFor} from '../core/allocator-v6.js';
import {bulkMarketCandidates,bulkItemExposureFraction} from '../core/high-volume.js';
import {limitRowsByMaterialVolume} from '../core/procurement-liquidity.js';
const mk=(i,d,o={})=>({id:`T${4+i%4}_ITEM${i}`,city:'Black Market',craftCity:'Martlock',mode:'listed',
 cost:40000,capitalPerUnit:50000,profit:8000,stressProfit:3500,sell:60000,saleTaxPercent:4,craftFame:540,
 activity:{observations:14,count:d*14,observedDaily:d,activeDays:14,coverage:1},
 activity7:{observations:7,count:d*7,observedDaily:d,activeDays:7},
 demandDaily:d,ageHours:2,confidence:{score:85},competition:{known:false,penalty:.92},craftAmount:1,...o});
const plan=(routes,budget,extra={})=>allocatePortfolioV6(bulkMarketCandidates(routes).accepted,budget,{intelligent:true,bulkMode:true,useAll:true,
 maxPerItemFraction:bulkItemExposureFraction(routes),maxVariants:65,targetDifferentItems:28,capFraction:.22,horizonDays:14,saturation:2,...extra});

test('lote mínimo útil: 3-5 unidades en Mercado Negro por orden; 1 basta en Royal, con libro verificado o si el objeto es caro',()=>{
 assert.equal(minUsefulLot({city:'Black Market',capitalPerUnit:50000},25),4);
 assert.equal(minUsefulLot({city:'Black Market',capitalPerUnit:50000},200),5);
 assert.equal(minUsefulLot({city:'Black Market',capitalPerUnit:50000},2),2);
 assert.equal(minUsefulLot({city:'Black Market',capitalPerUnit:900000},40),1);
 assert.equal(minUsefulLot({city:'Black Market',capitalPerUnit:50000,depthVerified:true},40),1);
 assert.equal(minUsefulLot({city:'Lymhurst',capitalPerUnit:50000},40),1);
});
test('con demanda de 58 por semana el Mercado Negro ya no recibe un lote de 1',()=>{
 const routes=[mk(0,58/7),mk(1,400),mk(2,900),mk(3,150),mk(4,58/7)];
 for(const budget of [1_500_000,6_000_000,40_000_000]){
  const r=plan(routes,budget);
  assert(r.rows.length>0);
  for(const x of r.rows){
   assert(x.qty>=minUsefulLot(x,x.maxCrafts),`${x.id}: ${x.qty} con presupuesto ${budget}`);
   assert(x.qty<=x.maxCrafts);assert(x.totalProfit>0);
  }
  assert(r.totalCost<=budget);
 }
 const rich=plan(routes,40_000_000).rows.find(x=>x.id==='T4_ITEM0');
 assert(rich&&rich.qty>=3,'con presupuesto suficiente el objeto de 58/semana recibe un lote real');
});
test('presupuesto escaso: las rutas que no llegan al lote mínimo salen y su capital pasa a las demás',()=>{
 const r=plan([mk(0,2000),mk(1,2000),mk(2,9),mk(3,9)],1_000_000);
 assert(r.rows.every(x=>x.demandDaily===2000));
 assert(r.totalCost>=900_000);
});
test('objetivo de fama: prioriza fama por silver sin pasar de la capacidad ni aceptar pérdidas',()=>{
 const routes=[mk(0,300,{craftFame:270}),mk(1,300,{craftFame:2160}),mk(2,300,{craftFame:540}),mk(3,300,{craftFame:1080})];
 const silver=plan(routes,6_000_000,{fameWeight:0}),fame=plan(routes,6_000_000,{fameWeight:1});
 assert(fame.totalFame>silver.totalFame*1.15,`${fame.totalFame} vs ${silver.totalFame}`);
 const q=(p,id)=>p.rows.find(x=>x.id===id)?.qty||0;
 assert(q(fame,'T5_ITEM1')>q(silver,'T5_ITEM1'));
 assert(q(fame,'T4_ITEM0')<=q(silver,'T4_ITEM0'));
 for(const x of fame.rows){assert(x.qty<=x.maxCrafts);assert(x.totalProfit>0);assert.equal(x.fameTotal,x.qty*x.craftFame);}
 const mid=plan(routes,6_000_000,{fameWeight:.5});
 assert(mid.totalFame>=silver.totalFame&&mid.totalFame<=fame.totalFame);
});
test('el factor de fama es neutro sin objetivo y acotado entre 0,25 y 4',()=>{
 const routes=[{craftFame:100,capitalPerUnit:1000},{craftFame:100000,capitalPerUnit:1000},{craftFame:1000,capitalPerUnit:1000},{craftFame:0,capitalPerUnit:1000}];
 assert.equal(fameFactorFor(routes,0)(routes[1]),1);
 const one=fameFactorFor(routes,1);
 assert.equal(one(routes[1]),4);assert.equal(one(routes[0]),.25);assert.equal(one(routes[2]),1);assert.equal(one(routes[3]),.5);
 assert.equal(fameFactorFor(routes,.5)(routes[1]),2);
});
test('materiales: la compra se reparte en la ventana de venta y un material sin historial ya no recorta a 1',()=>{
 const rows=[{id:'A',city:'Black Market',qty:20,profit:10,capitalPerUnit:100,materials:[{id:'T5_METALBAR',city:'Thetford',count:8,used:6,unitPrice:100}]},
  {id:'B',city:'Black Market',qty:20,profit:10,capitalPerUnit:100,materials:[{id:'T5_UNKNOWN',city:'Thetford',count:8,used:6,unitPrice:100}]}];
 const hist=new Map([['T5_METALBAR|Thetford',{d14:{observations:14,observedDaily:200,activeDays:14,medianPrice:100},d7:{observations:7,observedDaily:200}}]]);
 const oneDay=limitRowsByMaterialVolume(rows,hist,{fraction:.08,unknownCraftCap:1});
 assert.deepEqual(oneDay.rows.map(r=>r.qty),[2,1],'comportamiento antiguo: recorta a 2 y a 1');
 const window=limitRowsByMaterialVolume(rows,hist,{fraction:.10,days:14,unknownCraftCap:Infinity,cutOnPriceAlert:false});
 assert.deepEqual(window.rows.map(r=>r.qty),[20,20]);
 assert.equal(window.unverified.length,1,'el material sin historial queda señalado para verificar');
 const scarce=new Map([['T5_METALBAR|Thetford',{d14:{observations:14,observedDaily:20,activeDays:14,medianPrice:100},d7:{observations:7,observedDaily:20}}]]);
 assert.equal(limitRowsByMaterialVolume(rows,scarce,{fraction:.10,days:14,unknownCraftCap:Infinity,cutOnPriceAlert:false}).rows[0].qty,3,'el tope real sigue aplicando');
});
test('la app ofrece «Objetivo del plan», calcula fama por ruta y ya no recorta fabricación por compras',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 for(const t of ["mk('fame','Objetivo del plan'",'Silver y fama','fameWeight,','x.craftFame=fame?.value||0','Fama de crafteo estimada','const strictChecked=await polish(strict);','filterRowsByFinalLot(checked.plan.rows,{diversityPriority})'])assert(app.includes(t),t);
 assert(!app.includes('await guardMaterialPurchases(strict.plan,region,force);'));
});
