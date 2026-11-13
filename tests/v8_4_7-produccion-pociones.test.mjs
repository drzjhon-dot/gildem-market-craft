import test from 'node:test';
import assert from 'node:assert/strict';
import {groupProduction,groupSales} from '../core/production-view.js';

test('v8.4.7 grupos de pociones respetan múltiples unidades por fabricación',()=>{
 const rows=[
  {id:'T6_POTION_HEAL',qty:2,craftAmount:5,recipeKind:'potion',city:'Bridgewatch',mode:'listed',craftCity:'Brecilien',profit:100,totalProfit:200,allocation:1000,returnRate:33.5},
  {id:'T6_POTION_HEAL',qty:3,craftAmount:5,recipeKind:'potion',city:'Martlock',mode:'listed',craftCity:'Brecilien',profit:120,totalProfit:360,allocation:1500,returnRate:33.5}
 ];
 const production=groupProduction(rows);
 const sales=groupSales(rows,'royal');
 assert.equal(production.length,1);
 assert.equal(production[0].qty,5);
 assert.equal(production[0].units,25);
 assert.equal(production[0].capital,2500);
 assert.equal(production[0].profit,560);
 assert.deepEqual(sales.map(x=>x.units),[10,15]);
 assert.equal(sales.reduce((n,x)=>n+x.profit,0),560);
});
