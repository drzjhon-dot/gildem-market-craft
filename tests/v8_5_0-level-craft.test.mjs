import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {specFameGoal,specFameTotal,craftingFameFromRecipe,planLevelCraft,createStudyOnlyCandidates,eligibleToStudy} from '../core/level-craft.js';
import {createUniversalCandidates} from '../core/opportunity-scan.js';
import {rowMap} from '../core/engine.js';

const sword='T4_MAIN_SWORD', sword6='T6_MAIN_SWORD';
const recipe={city:'Lymhurst',materials:[{id:'T4_METALBAR',count:16,ret:true},{id:'T4_LEATHER',count:8,ret:true}],amountCrafted:1};
const recipes={[sword]:recipe,[sword6]:{...recipe,materials:[{id:'T6_METALBAR',count:16,ret:true},{id:'T6_LEATHER',count:8,ret:true}]}};
const now=new Date().toISOString();
const quotes=()=>rowMap([
 ...['T4_METALBAR','T4_LEATHER'].map(item_id=>({item_id,city:'Lymhurst',quality:1,sell_price_min:50,sell_price_min_date:now})),
 {item_id:sword,city:'Martlock',quality:1,sell_price_min:800,sell_price_min_date:now},
 {item_id:sword,city:'Black Market',quality:1,buy_price_max:100,sell_price_min_date:now,buy_price_max_date:now}
]);
const route=(id=sword,city='Martlock',profit=100,capacity=20,observedDaily=500)=>({id,craftCity:'Lymhurst',city,profit,capitalPerUnit:900,cost:850,sell:1500,mode:city==='Black Market'?'instant':'listed',
 materials:recipe.materials.map(m=>({...m,unitPrice:50,used:m.count*.75,city:'Lymhurst'})),craftAmount:1,stationCost:0,
 activity:observedDaily===null?null:{observations:14,activeDays:14,observedDaily},ageHours:.5,stressProfit:profit*.6,confidence:{score:86},depthVerified:city==='Black Market',marketCapacity:capacity,focusPerUnit:0,saleTaxPercent:0,setupRate:0,orderLevels:city==='Black Market'?[{price:1500,amount:capacity}]:undefined});

test('Destiny total references distinguish weapons, armor, shoes, bags and siege',()=>{
 assert.equal(specFameTotal(sword),25758944);
 assert.equal(specFameTotal('T5_ARMOR_LEATHER_SET1'),12879472);
 assert.equal(specFameTotal('T5_SHOES_CLOTH_SET1'),6439736);
 assert.equal(specFameTotal('T5_BAG'),19319208);
 assert.equal(specFameTotal('T5_SIEGE_BANNER'),38638416);
 assert.equal(specFameTotal('T5_MEAL_SOUP'),null);
 assert.equal(specFameGoal({itemId:sword,spec:0}).required,25758944);
 assert.equal(specFameGoal({itemId:sword,spec:40,exactRemaining:110000}).required,110000);
 assert.equal(specFameGoal({itemId:sword,spec:100}).required,0);
 assert.equal(specFameGoal({itemId:sword,spec:40}).estimate,true);
 assert.throws(()=>specFameGoal({itemId:'T4_MEAL_SOUP',spec:50}),/fama pendiente exacta/);
});

test('real materials determine fame, including enchanted LEVEL1 and Premium; artifacts flagged estimates',()=>{
 assert.equal(craftingFameFromRecipe(sword,recipe,{premium:false}).value,540);
 assert.equal(craftingFameFromRecipe(sword,recipe,{premium:true}).value,810);
 assert.equal(craftingFameFromRecipe('T4_MAIN_SWORD@1',{...recipe,materials:[{id:'T4_METALBAR_LEVEL1@1',count:24}]},{premium:true}).value,1620);
 assert.equal(craftingFameFromRecipe(sword,{...recipe,materials:[...recipe.materials,{id:'T4_ARTIFACT',count:1}]},{premium:true}).estimated,true);
 assert.equal(craftingFameFromRecipe(sword,recipe,{manualFame:1000,premium:true}).value,1500);
});

test('Level Craft sells first and does not duplicate selected units across cities',()=>{
 const plan=planLevelCraft({routes:[route(),route(sword,'Thetford',85)],recipes,goalFame:15000,budget:18000,maxStages:3});
 assert(plan.stages.length>0);
 assert.equal(plan.studyCount,0);
 assert(plan.stages.every(s=>s.investment<=18000));
 assert.equal(plan.items.reduce((s,r)=>s+r.qty,0),plan.sales.reduce((s,r)=>s+r.qty,0));
 assert.equal(plan.earnedFame,plan.items.reduce((s,r)=>s+r.fame,0));
 assert.equal(plan.sales.every(s=>['Martlock','Thetford'].includes(s.city)),true);
});

test('unconfirmed BM depth is rejected, even when a positive bid quote exists',()=>{
 const b={...route(sword,'Black Market',80),depthVerified:false,marketCapacity:1};
 const plan=planLevelCraft({routes:[b],recipes,goalFame:10000,budget:20000,maxStages:12});
 assert.equal(plan.sales.reduce((s,r)=>s+r.qty,0),0);
 assert.equal(plan.stages.length,0);
 assert.equal(plan.completed,false);
});

test('unobserved Royal activity cannot be treated as repeated confirmed sales',()=>{
 const a=route(sword,'Martlock',90,50,null);
 const plan=planLevelCraft({routes:[a],recipes,goalFame:20000,budget:20000,maxStages:12});
 assert.equal(plan.sales.reduce((s,r)=>s+r.qty,0),0);
 assert.equal(plan.stages.length,0);
});

test('optional study consumes products and earns craft plus study fame with fee, never sells',()=>{
 const studyRoute={...route(),sell:0,city:null,studyOnly:true,profit:-500,capitalPerUnit:500,cost:450,materials:recipe.materials.map(m=>({...m,used:m.count*.75,unitPrice:25,upfrontUnitPrice:25}))};
 const plan=planLevelCraft({routes:[studyRoute],recipes,goalFame:3100,budget:7000,study:true,studyFee:100,maxStages:2});
 assert(plan.studyCount>0);
 assert.equal(plan.sales.length,0);
 assert(plan.items.every(r=>r.method==='study'));
 assert(plan.netProfit<0);
 assert(plan.earnedFame>=3100);
});

test('study not allowed for mounts, and study-only candidates use real material quotes',()=>{
 assert.equal(eligibleToStudy('T4_MOUNT_HORSE',{kind:'mount'}),false);
 const standalone=createStudyOnlyCandidates({ids:[sword],recipes,priceMap:quotes(),inputs:{cities:['Lymhurst','Martlock'],city:'auto',focus:false,materialPurchase:'all',station:200}});
 assert.equal(standalone.length,1);assert.equal(standalone[0].studyOnly,true);
 assert.equal(standalone[0].city,null);
 assert.equal(standalone[0].craftCity,'Lymhurst');
 assert(standalone[0].capitalPerUnit>standalone[0].cost);
});

test('Focus available is a hard cap across all rounds',()=>{
 const f={...route(),focusPerUnit:1000};
 const plan=planLevelCraft({routes:[f],recipes,goalFame:10000,budget:20000,maxStages:12,focusBudget:2000});
 assert.equal(plan.items.reduce((sum,x)=>sum+x.qty,0),2);
 assert.equal(plan.focusUsed,2000);
});

test('Level Craft loss routes allowed only when explicitly enabled, preserving Royal regular scans',()=>{
 const input={market:'royal',cities:['Martlock','Lymhurst'],city:'auto',focus:false,buyMode:'instant',refiningMode:'off',materialPurchase:'all',station:0,transport:0,materialShipping:0,royalTax:4,listingFee:2.5,saleMode:'listed',riskRoyal:0,priceStress:8,resourceStress:7};
 const a=createUniversalCandidates({selected:[{id:sword,branch:'sword'}],recipes,priceMap:quotes(),inputs:input});
 const b=createUniversalCandidates({selected:[{id:sword,branch:'sword'}],recipes,priceMap:quotes(),inputs:{...input,allowLoss:true}});
 assert.equal(a.candidates.length,0);
 assert.equal(b.candidates.length,1);
 assert(b.candidates[0].profit<0);
});

test('navigational tabs renamed, Royal solo Royal, Level no se muestra al usuario',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert(!html.includes('data-nav="levelcraft"'));
 assert(html.includes('>Black Craft<'));
 assert(html.includes('>Royal Craft<'));
 assert(!html.includes('>Plan de crafting<'));
 assert(!html.includes('>Encontrar oportunidades<'));
 for(const id of ['level-spec','level-fame','level-budget','level-market','level-study','level-item-search','level-city','level-tiermax','level-ench'])assert(app.includes(id));
 // Royal Craft now has a fixed Royal destination; Level Craft retains the
 // independent mixed-market choice requested for spec progression.
 assert(app.includes("qcSetValue('auto-market','royal')"));
 assert(app.includes("['mixed','Royal + Mercado Negro']"));
 assert(app.includes("if(id==='level-form')runLevelCraft()"));
});


test('Black Market deeper bid levels causing a loss are excluded from the craft batch',()=>{
 const b={...route(sword,'Black Market',100,2),depthVerified:true,marketCapacity:2,saleTaxPercent:0,sell:1000,
  orderLevels:[{price:1000,amount:1},{price:400,amount:1}]};
 const p=planLevelCraft({routes:[b],recipes,goalFame:1700,budget:10000,maxStages:2});
 assert.equal(p.sales[0].qty,1);
 assert(p.netProfit>0);
 assert.equal(p.stages[0].investment,900);
});
