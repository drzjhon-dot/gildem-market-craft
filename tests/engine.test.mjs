import test from 'node:test';
import assert from 'node:assert/strict';
import {qualityQuote,rowMap,topTrades,craftCost,craftProfit,allocatePlan,historyDaily} from '../core/engine.js';
const now=Date.now();
const ts=(h)=>new Date(now-h*3600000).toISOString();
const make=(city,id,ask,bid,age=0.2)=>({city,item_id:id,quality:1,sell_price_min:ask,sell_price_min_date:ts(age),buy_price_max:bid,buy_price_max_date:ts(age)});
test('cotizaciones con precio cero o antiguas nunca son válidas para oportunidades',()=>{
 assert.equal(qualityQuote(make('Martlock','T4_BAG',0,10),'sell_price_min'),null);
 assert.equal(qualityQuote(make('Martlock','T4_BAG',10,11,48),'sell_price_min',24).fresh,false);
});
test('arbitraje descontando impuestos y transporte, BM solo instantáneo',()=>{
 const m=rowMap([make('Martlock','T4_BAG',100,90),make('Black Market','T4_BAG',0,150)]);
 const arr=topTrades(m,['T4_BAG'],{tax:.04,setup:.025,transport:5,destinations:['Black Market']});
 assert.equal(arr.length,1);assert.equal(arr[0].profit,39);assert.equal(arr[0].mode,'instant');
});
test('crafting no devuelve artefactos y devuelve materiales corrientes',()=>{
 const c=craftCost({materials:[{id:'T4_METALBAR',count:8,ret:true},{id:'ARTIFACT',count:1,ret:false}]},id=>({price:id==='ARTIFACT'?1000:100,city:'Martlock'}),25,20);
 assert.equal(c.materialCost,8*100*.75+1000);assert.equal(c.total,1620);
 const p=craftProfit(c,2000,{tax:.04,setup:.025,mode:'instant'});assert.equal(p.profit,300);
});
test('diversificación no excede presupuesto, limita unidades sin historial',()=>{
 const candidates=[{id:'a',cost:100,profit:70,dailySales:null,materials:[{id:'raw',count:8,used:6,unitPrice:10}]},{id:'b',cost:200,profit:100,dailySales:50,materials:[]}];
 const p=allocatePlan(candidates,1000,.1,2);
 assert.equal(p.rows.find(x=>x.id==='a').qty,2);
 assert.ok(p.totalCost<=1000);assert.equal(p.materials.find(x=>x.id==='raw').qtyGross,16);
});
test('volumen de historial solo cuenta días UTC completos',()=>{
 const day=Date.UTC(2026,10,7,12,0);const entries=[{timestamp:'2026-11-06T02:00:00Z',item_count:70},{timestamp:'2026-11-07T02:00:00Z',item_count:5000},{timestamp:'2026-10-23T02:00:00Z',item_count:1000}];
 const res=historyDaily(entries,14,day);
 assert.equal(res.count,70);assert.equal(res.daily,5);
});

import {craftingReturnRate,allocateCraftPlan} from '../core/engine.js';
import {recipesForBranch,branchByKey} from '../core/branches.js';
test('bonos diarios no son directamente retorno de recursos',()=>{
 assert.ok(Math.abs(craftingReturnRate({specialty:true}).returnRate-24.8120)<.01);
 assert.ok(Math.abs(craftingReturnRate({specialty:true,dailyBonus:10}).returnRate-30.0699)<.01);
 assert.ok(Math.abs(craftingReturnRate({specialty:true,dailyBonus:20,focus:true}).returnRate-52.8302)<.02);
 assert.ok(Math.abs(craftingReturnRate({specialty:false}).returnRate-15.254)<.01);
 assert.throws(()=>craftingReturnRate({dailyBonus:25}));
});
test('ramas exactas y filtro de ciudad no mezclan bonos distintos',()=>{
 const mock={
  'T4_SHOES_PLATE_SET1':{city:'Martlock',materials:[{id:'T4_METALBAR',count:8}]},
  'T4_SHOES_CLOTH_SET1':{city:'Bridgewatch',materials:[{id:'T4_CLOTH',count:8}]},
  'T4_SHOES_LEATHER_SET1':{city:'Lymhurst',materials:[{id:'T4_LEATHER',count:8}]},
  'T4_SHOES_PLATE_SET1@1':{city:'Martlock',materials:[{id:'T4_METALBAR_LEVEL1@1',count:8}]},
 };
 assert.equal(branchByKey('boots_plate').city,'Martlock');
 assert.deepEqual(recipesForBranch(mock,'boots_plate',4,4,1,20,'Martlock'),['T4_SHOES_PLATE_SET1','T4_SHOES_PLATE_SET1@1']);
 assert.equal(recipesForBranch(mock,'boots_plate',4,4,1,20,'Bridgewatch').length,0);
 assert.deepEqual(recipesForBranch(mock,'boots_all',4,4,0,20,'Lymhurst'),['T4_SHOES_LEATHER_SET1']);
});
test('modo usar todo respeta presupuesto BRUTO y demanda Royal',()=>{
 const c=[
  {id:'T4_SHOES_PLATE_SET1',city:'Martlock',cost:70,capitalPerUnit:100,profit:40,dailySales:100,materials:[{id:'T4_METALBAR',city:'Fort Sterling',count:8,used:6,unitPrice:10}]},
  {id:'T4_SHOES_PLATE_SET2',city:'Lymhurst',cost:140,capitalPerUnit:200,profit:50,dailySales:100,materials:[]}
 ];
 const v=allocateCraftPlan(c,1500,{useAll:true,capFraction:.20});
 assert.equal(v.totalCost,1500);assert.equal(v.remaining,0);
 assert.equal(v.rows[0].qty,15);
 assert.equal(v.materials[0].qtyGross,120);
 const safe=allocateCraftPlan(c,1500,{useAll:false,capFraction:.05});
 assert.ok(safe.totalCost<=1500);assert.ok(safe.remaining>0);
});
test('sin historial, el modo intensivo no inventa demanda',()=>{
 const p=allocateCraftPlan([{id:'x',city:'Black Market',cost:40,capitalPerUnit:100,profit:20,dailySales:null,materials:[]}],10000,{useAll:true,unknownCap:4});
 assert.equal(p.totalCost,400);assert.equal(p.remaining,9600);assert.equal(p.rows[0].qty,4);
});
test('la lista de compras incluye diarios vacíos cuando se calculan',()=>{
 const p=allocateCraftPlan([{id:'x',city:'Martlock',cost:90,capitalPerUnit:100,profit:40,dailySales:20,materials:[{id:'T4_LEATHER',city:'Martlock',count:2,used:1.5,unitPrice:30}],journal:{prices:true,empty:'T4_JOURNAL_EMPTY',full:'T4_JOURNAL_FULL',ratio:.5,price:60,buyCity:'Lymhurst'}}],1000,{useAll:true,capFraction:.2});
 const journal=p.materials.find(x=>x.id==='T4_JOURNAL_EMPTY');
 assert.equal(journal.qtyGross,2);
 assert.equal(journal.city,'Lymhurst');
});
