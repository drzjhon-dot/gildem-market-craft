import test from 'node:test';
import assert from 'node:assert/strict';
import {calcBatch,quoteIndex} from '../core/craft-calc.js';

const now=new Date(Date.now()-3600e3).toISOString();
const q=(id,city,ask)=>({item_id:id,city,quality:1,sell_price_min:ask,sell_price_min_date:now,buy_price_max:0,buy_price_max_date:now});
test('v9.10 · Calculadora: la salida por craft del juego (pociones ×5) cuenta en el ingreso',()=>{
 const recipes={T4_POTION_HEAL:{materials:[{id:'T4_BURDOCK',count:24,ret:true}],amountCrafted:5,city:'Brecilien',kind:'potion',specialtyEnabled:true}};
 const quotes=quoteIndex([q('T4_POTION_HEAL','Lymhurst',200),q('T4_BURDOCK','Lymhurst',10)]);
 const r=calcBatch([{id:'T4_POTION_HEAL',qty:2}],{recipes,quotes,tax:4,setup:2.5});
 const row=r.rows[0];assert.equal(row.amount,5);
 // ingreso = 2 crafts × 5 pociones × 200 × (1 − 6,5 %)
 assert(Math.abs((row.profitRoyal+row.totalCost)-2*5*200*(1-.065))<1e-6);
});
test('v9.10 · Calculadora: se compra el neto + el retorno de un craft (no falta material al final)',()=>{
 const recipes={T4_MAIN_SWORD:{materials:[{id:'T4_METALBAR',count:16,ret:true},{id:'T4_LEATHER',count:8,ret:true}],city:'Lymhurst'}};
 const quotes=quoteIndex([q('T4_MAIN_SWORD','Lymhurst',9000),q('T4_METALBAR','Lymhurst',150),q('T4_LEATHER','Lymhurst',150)]);
 const r=calcBatch([{id:'T4_MAIN_SWORD',qty:10}],{recipes,quotes});
 const bars=r.materials.find(m=>m.id==='T4_METALBAR');const rr=.248120;
 assert.equal(bars.buy,Math.ceil(160*(1-rr)+16*rr-1e-9));
 // Simulación de fabricación en orden: nunca falta material.
 let stock=bars.buy;for(let i=0;i<10;i++){assert(stock>=16-1e-9,`craft ${i+1}`);stock-=16;stock+=16*rr;}
});
import {gameFocusCost,focusAfterEfficiency,FAMILY_FOCUS_T40} from '../core/game-focus.js';
import {RECIPE_SUPPLEMENT} from '../core/recipe-supplement.js';
import {createRefiningCandidates,refinementScanIds} from '../core/refining-opportunities.js';
import {extractSpecialRecipes} from '../core/special-recipes.js';
test('v9.10 · Focus del juego: espada T4 1.286, ×1,75 por nivel; FCE 10.000 lo divide entre 2',()=>{
 assert.equal(gameFocusCost('T4_MAIN_SWORD'),1286);
 assert.equal(gameFocusCost('T5_MAIN_SWORD'),Math.round(1286*1.75));
 assert.equal(gameFocusCost('T4_CLOTH'),54);assert.equal(gameFocusCost('T5_CLOTH_LEVEL1@1'),164);
 assert.equal(focusAfterEfficiency(1000,10000),500);assert.equal(gameFocusCost('T4_NO_EXISTE'),null);
 assert(Object.keys(FAMILY_FOCUS_T40).length>200);
});
test('v9.10 · Recetas nuevas del juego (set de cuero dragón) con ciudad de bono y artefacto sin retorno',()=>{
 const r=RECIPE_SUPPLEMENT.T4_HEAD_LEATHER_DRAGON;assert(r);assert.equal(r.city,'Lymhurst');
 assert.deepEqual(r.materials.find(m=>m.id==='T4_LEATHER'),{id:'T4_LEATHER',count:8,ret:true});
 assert.equal(r.materials.find(m=>/ARTEFACT/.test(m.id)).ret,false);
 assert.equal(RECIPE_SUPPLEMENT.T5_ARMOR_LEATHER_DRAGON.city,'Thetford');
});
test('v9.10 · Refinado con Focus: 53,9 % de retorno en la ciudad de bono y coste de Focus del juego',()=>{
 const now=new Date(Date.now()-3600e3).toISOString(),rows=[];
 for(const c of ['Lymhurst','Fort Sterling','Thetford','Martlock','Bridgewatch'])rows.push(
  {item_id:'T4_FIBER',city:c,quality:1,sell_price_min:100,sell_price_min_date:now,buy_price_max:0,buy_price_max_date:now},
  {item_id:'T3_CLOTH',city:c,quality:1,sell_price_min:160,sell_price_min_date:now,buy_price_max:0,buy_price_max_date:now},
  {item_id:'T4_CLOTH',city:c,quality:1,sell_price_min:300,sell_price_min_date:now,buy_price_max:0,buy_price_max_date:now});
 const map=new Map();for(const r of rows){const k=r.item_id;const a=map.get(k)||[];a.push(r);map.set(k,a);}
 const selected=refinementScanIds({families:['CLOTH'],tierMin:4,tierMax:4,enchant:0});
 return import('../core/engine.js').then(({rowMap})=>{const pm=rowMap(rows);
  const off=createRefiningCandidates({selected,priceMap:pm,market:'royal',saleCities:['Lymhurst']});
  const on=createRefiningCandidates({selected,priceMap:pm,market:'royal',saleCities:['Lymhurst'],focus:true});
  assert(Math.abs(off.candidates[0].returnRate-36.71)<.01);assert(Math.abs(on.candidates[0].returnRate-53.92)<.01);
  assert.equal(on.candidates[0].focusPerUnit,54);assert(on.candidates[0].profit>off.candidates[0].profit);
 });
});
test('v9.10 · Recetas especiales guardan el coste de Focus del juego',()=>{
 const dump={items:{consumableitem:[{'@uniquename':'T4_POTION_HEAL',craftingrequirements:{'@craftingfocus':'120','@amountcrafted':'5',craftresource:[{'@uniquename':'T4_BURDOCK','@count':'24'}]}}]}};
 const r=extractSpecialRecipes(dump).T4_POTION_HEAL;assert.equal(r.focusPerCraft,120);assert.equal(r.amountCrafted,5);
});
