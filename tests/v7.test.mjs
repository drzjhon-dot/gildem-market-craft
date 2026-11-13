import test from 'node:test';
import assert from 'node:assert/strict';
import {BRANCHES,BRANCH_CATEGORIES,branchByKey,branchIsRoyalOnly,categoryForBranch,recipesForBranch,sortedBranches} from '../core/branches.js';
import {extractSpecialRecipes,specialType,blackMarketEligible} from '../core/special-recipes.js';
import {craftCost,craftProfit,craftingReturnRate} from '../core/engine.js';
import {capacityFor} from '../core/allocator-v6.js';
import {breakEvenPrice} from '../core/verify.js';
import {createPortfolioFromPlan,summarizePortfolio,recordSale} from '../core/ledger.js';

const raw={items:{
 consumableitem:[{'@uniquename':'T4_POTION_HEAL','craftingrequirements':{'@amountcrafted':'5',craftresource:[{'@uniquename':'T4_HERB','@count':'10'},{'@uniquename':'T4_FOOD','@count':'2','@maxreturnamount':'0'}]},enchantments:{enchantment:{'@enchantmentlevel':'1',craftingrequirements:{'@amountcrafted':'10',craftresource:{'@uniquename':'T4_HERB_LEVEL1','@enchantmentlevel':'1','@count':'12'}}}}}],
 mount:[{'@uniquename':'T5_MOUNT_HORSE',craftingrequirements:{craftresource:[{'@uniquename':'T5_FARM_HORSE_GROWN','@count':'1','@maxreturnamount':'0'},{'@uniquename':'T5_LEATHER','@count':'20'}]}}],
 equipmentitem:[{'@uniquename':'T6_HEAD_GATHERER_WOOD',craftingrequirements:{craftresource:[{'@uniquename':'T6_LEATHER','@count':'8'}]}}]
}};
const recipes=extractSpecialRecipes(raw);

test('v7 selector presenta categorías lógicas con subramas específicas',()=>{
 assert.deepEqual(BRANCH_CATEGORIES.map(x=>x.key),['armor','weapons','accessories','offhands','kits','siege','gathering','potions','mounts','foods','refining']);
 assert.equal(categoryForBranch('gather_hide'),'gathering');
 assert.equal(categoryForBranch('potion_all'),'potions');
 assert.equal(categoryForBranch('mount_all'),'mounts');
 assert.ok(sortedBranches('weapons','Espadas').some(x=>x.key==='sword'));
 assert.ok(sortedBranches('gathering','Leñador').some(x=>x.key==='gather_wood'));
});
test('v7 categorías especiales solo Royal, BM sigue permitido para botas',()=>{
 assert.equal(branchIsRoyalOnly('mount_all'),true);
 assert.equal(branchIsRoyalOnly('potion_all'),true);
 assert.equal(branchIsRoyalOnly('gather_hide'),true);
 assert.equal(branchIsRoyalOnly('boots_plate'),false);
 for(const id of ['T4_POTION_HEAL','T5_MOUNT_HORSE','T6_HEAD_GATHERER_WOOD','T5_BACKPACK_GATHERER_ORE'])assert.equal(blackMarketEligible(id),false);
 assert.equal(blackMarketEligible('T5_SHOES_PLATE_SET1'),true);
});
test('v7 extracta solo recetas verificadas y entiende cantidades reales de pociones',()=>{
 assert.equal(recipes.T4_POTION_HEAL.amountCrafted,5);
 assert.equal(recipes['T4_POTION_HEAL@1'].amountCrafted,10);
 assert.equal(recipes['T4_POTION_HEAL@1'].materials[0].id,'T4_HERB_LEVEL1@1');
 assert.equal(recipes.T4_POTION_HEAL.materials[1].ret,false);
 assert.equal(recipes.T5_MOUNT_HORSE.specialtyEnabled,false);
 assert.equal(recipes.T5_MOUNT_HORSE.dailyEnabled,false);
 assert.equal(recipes.T6_HEAD_GATHERER_WOOD.city,'Caerleon');
 assert.equal(recipes.T4_POTION_HEAL.city,'Brecilien');
 assert.equal(recipes.T5_MOUNT_HORSE.city,'Caerleon');
});
test('v7 filtra recetas especiales por profesión y tier',()=>{
 assert.deepEqual(recipesForBranch(recipes,'potion_all',4,5,1,10).sort(),['T4_POTION_HEAL','T4_POTION_HEAL@1']);
 assert.deepEqual(recipesForBranch(recipes,'gather_wood',4,8,1,10),['T6_HEAD_GATHERER_WOOD']);
 assert.deepEqual(recipesForBranch(recipes,'mount_horse',4,7,1,10),['T5_MOUNT_HORSE']);
});
test('v7 negocio de 5 pociones calcula coste por fabricación y 5 productos',()=>{
 const recipe=recipes.T4_POTION_HEAL;
 const find=id=>({price:id==='T4_HERB'?100:200,city:'Brecilien',at:Date.now()});
 const cost=craftCost(recipe,find,25,20);
 assert.equal(cost.rawMaterials,1400);
 assert.equal(cost.materialCost,1150); // 10 hierbas: 25% de retorno; ingrediente no retornable entero
 const calc=craftProfit(cost,400*recipe.amountCrafted,{tax:.04,setup:.025,mode:'listed'});
 assert.ok(Math.abs(calc.profit-(2000*(1-.065)-1170))<.000001);
 const route={id:'T4_POTION_HEAL',qty:2,craftAmount:5,city:'Lymhurst',craftCity:'Brecilien',cost:1170,capitalPerUnit:1420,sell:400,profit:calc.profit,taxRate:.04};
 const ledger=createPortfolioFromPlan({rows:[route]});
 assert.equal(ledger.lots[0].qty,10);
 assert.equal(ledger.lots[0].unitCost,234);
 const sold=recordSale(ledger,ledger.lots[0].lotId,{qty:3,price:400,fees:48});
 const summary=summarizePortfolio(sold);
 assert.equal(summary.sold,3);assert.equal(summary.unsold,7);
 assert.equal(summary.realizedProfit,3*400-48-3*234);
});
test('v7 límites de actividad convierten unidades observadas a fabricaciones',()=>{
 const item={id:'T4_POTION_HEAL',city:'Lymhurst',craftAmount:5,activity:{observations:7,observedDaily:50}};
 assert.equal(capacityFor(item,.2,2),28); // 14 dias * 20% * 50 unidades/dia = 140 unidades = 28 lotes
 assert.equal(capacityFor({...item,activity:null},.2,2),2);
});
test('v7 precio de equilibrio es por unidad, no por fabricación',()=>{
 assert.equal(breakEvenPrice({cost:500,journalBonus:0,taxRate:0,setupRate:0,craftAmount:5}),100);
});
test('v7 monturas no reciben la especialidad de 15%; pociones sí',()=>{
 assert.ok(craftingReturnRate({specialty:true}).returnRate>craftingReturnRate({specialty:false}).returnRate);
 assert.equal(specialType('T5_MOUNT_HORSE'),'mount');
 assert.equal(specialType('T4_POTION_HEAL@1'),'potion');
});
test('v7 no inventa recetas sin craftingrequirements',()=>{
 const x=extractSpecialRecipes({items:{mount:[{'@uniquename':'T8_MOUNT_MAMMOTH'}],consumableitem:[{'@uniquename':'T4_POTION_HEAL','craftingrequirements':{}}]}});
 assert.deepEqual(x,{});
});

import {learnFromSales} from '../core/personal-learning.js';
test('v7 aprendizaje usa solo ventas cobradas e iniciadas; no predice ventas con AODP',()=>{
 const sample=[{id:'plan',started:true,startedAt:'2026-11-01T00:00:00Z',lots:[{id:'T4_POTION_HEAL',market:'Lymhurst',unitCost:100,expectedProfit:50,sales:[{qty:4,price:160,fees:20,transport:0,at:'2026-11-03T00:00:00Z'}]}]}];
 const data=learnFromSales(sample),x=data.get('T4_POTION_HEAL|Lymhurst');
 assert.equal(x.qtySold,4);assert.equal(x.realizedProfit,220);assert.equal(x.averageDays,2);assert.equal(x.profitPerUnit,55);
 assert.equal(learnFromSales([{...sample[0],started:false}]).size,0);
 assert.ok(x.adjustment>=.75&&x.adjustment<=1.12);
});

import {checkMaterialSupply} from '../core/material-supply.js';
test('v7 verificación de compras avisa cuando los materiales a mejor precio no alcanzan',()=>{
 const supply=new Map([['T4_METALBAR|Martlock',[{price:100,amount:8},{price:125,amount:100}]]]);
 const result=checkMaterialSupply([{id:'T4_METALBAR',city:'Martlock',qtyGross:30,originalPrice:100}],supply);
 assert.equal(result.insufficient,1);assert.equal(result.checked[0].available,8);
 assert.ok(result.warnings[0].includes('necesitas 30'));
});
