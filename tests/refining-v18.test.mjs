import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {REFINING_TYPES,refinedId,refiningVariant,referenceRefiningRecipes,extractBinRecipes,fallbackRefiningRecipe} from '../src/refining.js';
import {returnRate,DEFAULTS,buildCandidates,allocatePlan} from '../src/planner.js';
import {quoteMap} from '../src/market.js';
import {markedItemsForPlanner} from '../src/planner-transfer.js';
const T=Date.parse('2026-11-11T19:00:00Z'),stamp=new Date(T-3600000).toISOString();
const q=(id,city,sell)=>({item_id:id,city,quality:1,sell_price_min:sell,sell_price_min_date:stamp});
test('refinamiento tiene 5 familias, ciudad especializada y 105 variantes declaradas',()=>{
 assert.equal(REFINING_TYPES.length,5);assert.equal(Object.keys(referenceRefiningRecipes()).length,105);
 assert.equal(REFINING_TYPES.find(t=>t.key==='CLOTH').city,'Lymhurst');
 assert.equal(refinedId(8,'METALBAR',3),'T8_METALBAR_LEVEL3@3');
 assert.deepEqual(refiningVariant('T6_LEATHER_LEVEL2@2'),{tier:6,kind:'LEATHER',ench:2});
 assert.equal(fallbackRefiningRecipe('STONEBLOCK',5,1),null);
});
test('recetas oficiales de referencia: material crudo por tier y previo refinado encantado',()=>{
 const t4=fallbackRefiningRecipe('METALBAR',4,1);
 assert.deepEqual(t4.materials.map(x=>[x.id,x.count]),[['T4_ORE_LEVEL1@1',2],['T3_METALBAR',1]]);
 const t8=fallbackRefiningRecipe('CLOTH',8,2);
 assert.deepEqual(t8.materials.map(x=>[x.id,x.count]),[['T8_FIBER_LEVEL2@2',5],['T7_CLOTH_LEVEL2@2',1]]);
 assert.equal(t8.verifiedFromDump,false);
});
test('parser de bin dumps sólo acepta materiales del archivo y marca su procedencia',()=>{
 const fixture={items:{resource:[{'@uniquename':'T4_METALBAR',craftingrequirements:{'@amountcrafted':'1',craftresource:[{'@uniquename':'T4_ORE','@count':'2'},{'@uniquename':'T3_METALBAR','@count':'1'}]},enchantments:{enchantment:{'@enchantmentlevel':'1',craftingrequirements:{'@amountcrafted':'1',craftresource:[{'@uniquename':'T4_ORE_LEVEL1','@count':'2','@enchantmentlevel':'1'},{'@uniquename':'T3_METALBAR','@count':'1'}]}}}},{'@uniquename':'T5_METALBAR',craftingrequirements:{'@amountcrafted':'1',craftresource:[{'@uniquename':'T5_ORE','@count':'3'},{'@uniquename':'T4_METALBAR','@count':'1'}]}}],weapon:[{'@uniquename':'T8_MAIN_MACE',craftingrequirements:{'@amountcrafted':'1',craftresource:[{'@uniquename':'T8_METALBAR','@count':'16'}]}}]}};
 const only=['T4_METALBAR','T4_METALBAR@1','T8_MAIN_MACE'];const data=extractBinRecipes(fixture,{onlyIds:only});
 assert.equal(Object.keys(data).length,3);assert.equal(data['T4_METALBAR@1'].materials[0].id,'T4_ORE_LEVEL1@1');
 assert.equal(data['T4_METALBAR'].city,'Thetford');
 assert.equal(data['T4_METALBAR'].verifiedFromDump,true);
 assert.equal(data['T8_MAIN_MACE'].materials[0].count,16);
 assert.equal(data.T5_METALBAR,undefined);
});
test('refinamiento utiliza el +40% de producción y NO el +15% del equipamiento',()=>{
 const recipe=fallbackRefiningRecipe('METALBAR',4);
 const r=returnRate({recipe,bonusCity:true});
 assert.equal(r.productionBonus,58);assert(Math.abs(r.returnPct-36.70886)<.002);
 assert(Math.abs(returnRate({recipe:{city:'Martlock'},bonusCity:true}).returnPct-24.81203)<.002);
});
test('nuevo motor aplica cap de presupuesto, cuota Q1, y no impone recetas a pérdida al refinar',()=>{
 const recipe=fallbackRefiningRecipe('METALBAR',4);
 const prices=quoteMap([q('T4_ORE','Martlock',50),q('T3_METALBAR','Fort Sterling',50),q('T4_METALBAR','Thetford',350)]);
 const h={id:'T4_METALBAR',city:'Thetford',quality1DailyUnits:45,quality1ActiveDays:7,averageDailyUnits:45,quality1AveragePrice:345,activeDays:7,days:7};
 const config={...DEFAULTS,budget:150000,tiers:[4],enchants:[0],minRoiPct:1,maxCapitalSharePct:40,style:'prudent',diversify:true};
 const found=buildCandidates({top:[h],recipes:{T4_METALBAR:recipe},quotes:prices,config,selectedMarkets:['Thetford'],now:T});
 assert.equal(found.candidates.length,1);
 const result=allocatePlan({...found,config});
 assert(result.rows.length===1);assert(result.rows[0].qty<=result.rows[0].maxCrafts);
 assert(result.summary.capitalReserved<=config.budget);assert(result.rows[0].totalProfit>0);
 assert(result.materials.some(m=>m.id==='T4_ORE'));
});
test('reservar tiers ya NO permite superar cuota de capital por artículo',()=>{
 const recipe=fallbackRefiningRecipe('METALBAR',8),prices=quoteMap([q('T8_ORE','Lymhurst',60000),q('T7_METALBAR','Fort Sterling',10000),q('T8_METALBAR','Thetford',900000)]);
 const h={id:'T8_METALBAR',city:'Thetford',quality1DailyUnits:20,quality1ActiveDays:7,averageDailyUnits:20,quality1AveragePrice:900000,activeDays:7,days:7};
 const config={...DEFAULTS,budget:500000,minRoiPct:0,maxCapitalSharePct:5,tiers:[8],enchants:[0]};
 const found=buildCandidates({top:[h],recipes:{T8_METALBAR:recipe},quotes:prices,config,selectedMarkets:['Thetford'],now:T});
 const plan=allocatePlan({...found,config});assert.equal(plan.rows.length,0);assert(plan.summary.capitalReserved<=500000);
});
test('Top conserva los objetos sin receta inicial para verificarlos en Planner',()=>{
 const rows=[{id:'T8_MAIN_MACE',city:'Black Market',averageDailyUnits:18,quality1DailyUnits:12,quality1ActiveDays:5,days:7}];
 const marks=new Set(['T8_MAIN_MACE|Black Market']);
 assert.equal(markedItemsForPlanner(rows,marks,{},[],150,[],false).items.length,0);
 const out=markedItemsForPlanner(rows,marks,{},[],150,[],true);
 assert.deepEqual(out.items,['T8_MAIN_MACE']);assert.equal(out.signals.length,1);
});
test('cuarta pestaña, imagen de portada por rama, controles y endpoint de recetas están enlazados',()=>{
 const html=readFileSync('index.html','utf8'),main=readFileSync('src/main.js','utf8'),server=readFileSync('netlify/functions/catalog.mjs','utf8');
 assert(html.includes('data-route="refine"'));assert(main.includes('function refinePage()'));
 assert(main.includes('data-refine-market'));assert(main.includes('group-art'));
 assert(main.includes('file=verify&items='));assert(server.includes("type==='refining'"));
 assert(server.includes("type==='verify'"));
});
