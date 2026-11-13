import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {extractSpecialRecipes, specialType, blackMarketEligible, craftCityForSpecial} from '../core/special-recipes.js';
import {BRANCH_CATEGORIES,BRANCHES,branchByKey,categoryForBranch,branchIsRoyalOnly,recipesForBranch,sortedBranches} from '../core/branches.js';
import {craftCost,craftProfit,craftingReturnRate} from '../core/engine.js';
import {capacityFor} from '../core/allocator-v6.js';
import {createPortfolioFromPlan,recordSale,summarizePortfolio} from '../core/ledger.js';
import {fetchAndExtract,gameRevision} from '../netlify/functions/recipes.mjs';

function fixture(){
  const food=[
    {'@uniquename':'T1_MEAL_SOUP',craftingrequirements:{'@amountcrafted':'10',craftresource:[{'@uniquename':'T1_CARROT','@count':'16'}]}},
    {'@uniquename':'T4_MEAL_SALAD',craftingrequirements:{'@amountcrafted':'10',craftresource:[{'@uniquename':'T4_TURNIP','@count':'8'},{'@uniquename':'T4_HERB','@count':'4'}]},enchantments:{enchantment:{'@enchantmentlevel':'1',craftingrequirements:{'@amountcrafted':'10',craftresource:[{'@uniquename':'T4_TURNIP','@count':'8'},{'@uniquename':'T1_FISHSAUCE_LEVEL1','@count':'10'}]}}}},
    {'@uniquename':'T4_MEAL_SALAD_FISH',craftingrequirements:{'@amountcrafted':'1',craftresource:[{'@uniquename':'T4_FISH','@count':'1'},{'@uniquename':'T2_BEAN','@count':'2'}]}},
    {'@uniquename':'T6_MEAL_STEW_AVALON',craftingrequirements:{'@amountcrafted':'10',craftresource:[{'@uniquename':'T6_MUTTON','@count':'16'},{'@uniquename':'T6_AVALONIAN_BEEF','@count':'1','@maxreturnamount':'0'}]}},
    {'@uniquename':'T8_MEAL_STEW',craftingrequirements:{'@amountcrafted':'10',craftresource:[{'@uniquename':'T8_BEEF','@count':'16'}]}},
    {'@uniquename':'T6_MEAL_SANDWICH',craftingrequirements:{'@amountcrafted':'10',craftresource:[{'@uniquename':'T6_BREAD','@count':'12'}]}},
    {'@uniquename':'T7_MEAL_ROAST',craftingrequirements:{'@amountcrafted':'10',craftresource:[{'@uniquename':'T7_MEAT','@count':'12'}]}},
    {'@uniquename':'T5_MEAL_PIE',craftingrequirements:{'@amountcrafted':'10',craftresource:[{'@uniquename':'T5_FLOUR','@count':'12'}]}},
    {'@uniquename':'T3_MEAL_OMELETTE',craftingrequirements:{'@amountcrafted':'10',craftresource:[{'@uniquename':'T3_EGG','@count':'12'}]}},
    {'@uniquename':'T7_MEAL_PIE',craftingrequirements:{craftresource:[]}},
    {'@uniquename':'T5_MEAL_OMELETTE','@showinmarketplace':'false',craftingrequirements:{craftresource:{'@uniquename':'T5_EGG','@count':'2'}}}
  ];
  return {items:{consumableitem:[...food,{'@uniquename':'T4_POTION_HEAL',craftingrequirements:{'@amountcrafted':'5',craftresource:{'@uniquename':'T4_HERB','@count':'10'}}}],mount:[{'@uniquename':'T5_MOUNT_HORSE',craftingrequirements:{craftresource:{'@uniquename':'T5_FARM_HORSE_GROWN','@count':'1'}}}],equipmentitem:[{'@uniquename':'T4_ARMOR_GATHERER_WOOD',craftingrequirements:{craftresource:{'@uniquename':'T4_LEATHER','@count':'8'}}}]}};
}

test('v7.4 categoría comida, iconos y familias correctamente organizadas',()=>{
 assert.equal(BRANCH_CATEGORIES.find(x=>x.key==='foods').label,'Comidas');
 assert.equal(BRANCH_CATEGORIES.find(x=>x.key==='foods').iconId,'T4_MEAL_SALAD');
 assert.ok(BRANCHES.filter(b=>b.key.startsWith('food_')).every(x=>x.iconId&&x.city==='Caerleon'));
 assert.equal(categoryForBranch('food_stew'),'foods');
 assert.equal(branchIsRoyalOnly('food_all'),true);
 assert.equal(branchIsRoyalOnly('food_avalon'),true);
 assert.ok(sortedBranches('foods','Pescado').some(x=>x.key==='food_fish'));
});

test('v7.4 rechaza BM para comida; los otros mercados permanecen intactos',()=>{
 assert.equal(specialType('T4_MEAL_SALAD@1'),'food');
 assert.equal(blackMarketEligible('T4_MEAL_SALAD'),false);
 assert.equal(blackMarketEligible('T4_MEAL_SALAD_FISH'),false);
 assert.equal(blackMarketEligible('T5_SHOES_PLATE_SET1'),true);
 assert.equal(craftCityForSpecial('food'),'Caerleon');
});

test('v7.4 recetas de juego completas por lote, pescado, avalon y encantamiento',()=>{
 const recipes=extractSpecialRecipes(fixture());
 assert.equal(recipes.T1_MEAL_SOUP.amountCrafted,10);
 assert.equal(recipes.T4_MEAL_SALAD.amountCrafted,10);
 assert.equal(recipes['T4_MEAL_SALAD@1'].amountCrafted,10);
 assert.equal(recipes['T4_MEAL_SALAD@1'].materials[1].id,'T1_FISHSAUCE_LEVEL1');
 assert.equal(recipes.T4_MEAL_SALAD_FISH.amountCrafted,1);
 assert.equal(recipes.T6_MEAL_STEW_AVALON.materials[1].ret,false);
 assert.equal(recipes.T4_MEAL_SALAD.city,'Caerleon');
 assert.equal(recipes.T4_MEAL_SALAD.market,'royal');
 assert.equal(recipes.T4_MEAL_SALAD.specialtyEnabled,true);
 assert.equal(recipes.T4_MEAL_SALAD.dailyEnabled,true);
 assert.equal(recipes.T7_MEAL_PIE,undefined);
 assert.equal(recipes.T5_MEAL_OMELETTE,undefined);
 const ids=recipesForBranch(recipes,'food_all',1,8,3,260);
 assert.ok(ids.includes('T1_MEAL_SOUP'));
 assert.ok(ids.includes('T8_MEAL_STEW'));
 assert.deepEqual(recipesForBranch(recipes,'food_fish',1,8,3,260),['T4_MEAL_SALAD_FISH']);
 assert.deepEqual(recipesForBranch(recipes,'food_avalon',1,8,3,260),['T6_MEAL_STEW_AVALON']);
});

test('v7.4 presupuesto y beneficio de diez raciones, no 10 fabricaciones',()=>{
 const recipes=extractSpecialRecipes(fixture());const r=recipes.T4_MEAL_SALAD;
 const find=id=>({price:id==='T4_TURNIP'?100:250,city:'Caerleon',at:Date.now()});
 const c=craftCost(r,find,25,100);
 assert.equal(c.rawMaterials,8*100+4*250);
 assert.equal(c.total,8*.75*100+4*.75*250+100);
 const shippingPerPortion=4,transit=shippingPerPortion*r.amountCrafted;
 const sale=350;
 const p=craftProfit(c,sale*r.amountCrafted,{tax:.04,setup:.025,mode:'listed',transport:transit});
 assert.ok(p.profit>0);
 assert.ok(Math.abs(p.profit-(3500*.935-c.total-40))<1e-7);
 const cap=capacityFor({id:'T4_MEAL_SALAD',city:'Lymhurst',craftAmount:10,activity:{observations:5,observedDaily:200}},.1,2);
 assert.equal(cap,28); // 14 dias * 10% * 200 raciones/dia = 280 raciones = 28 lotes
 const route={id:'T4_MEAL_SALAD',qty:2,craftAmount:10,city:'Lymhurst',cost:c.total,capitalPerUnit:c.rawMaterials+100+40,sell:350,profit:p.profit};
 const portfolio=createPortfolioFromPlan({rows:[route]});
 assert.equal(portfolio.lots[0].qty,20);
 const sold=recordSale(portfolio,portfolio.lots[0].lotId,{qty:7,price:sale,fees:70});
 const summary=summarizePortfolio(sold);
 assert.equal(summary.unsold,13);
 assert.equal(summary.sold,7);
});

test('v7.4 compara Caerleon bonificado y otra ciudad sin bono',()=>{
 const ca=craftingReturnRate({specialty:true,dailyBonus:0,focus:false});
 const other=craftingReturnRate({specialty:false,dailyBonus:0,focus:false});
 assert.ok(ca.returnRate>other.returnRate);
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/kind==='food'\?'Bridgewatch':'Caerleon'/);
 assert.match(app,/input\.transport\*outputAmount/);
 assert.match(app,/\['mounts','potions','foods'\]\.includes/);
 assert.match(app,/recipeUniverse\.slice\(0,1800\)\.filter\(id=>qcVariantIncluded\('craft'/);
});

test('v7.4 backend verifica comida junto a las categorías existentes',async()=>{
 const data=await fetchAndExtract(async()=>({ok:true,json:async()=>fixture()}));
 assert.equal(data.version,3);
 assert.equal(data.recipes['T4_MEAL_SALAD@1'].kind,'food');
 assert.ok(data.count>=5);
 assert.ok(data.updatedAt);
});

test('v7.4 metadata del archivo items.json permite detectar nuevas revisiones',async()=>{
 const sha='b'.repeat(40),date='2026-11-02T12:00:00Z';
 const result=await gameRevision(async(url)=>({ok:true,json:async()=>[{sha,commit:{committer:{date}}}]}),true);
 assert.equal(result.sha,sha);assert.equal(result.date,date);
 const code=readFileSync(new URL('../netlify/functions/recipes.mjs',import.meta.url),'utf8');
 assert.match(code,/REVISION_URL/);
 assert.match(code,/v\.sourceRevision===rev\.sha/);
 assert.match(code,/refresh/);
});
