import test from 'node:test';
import assert from 'node:assert/strict';
import {refiningRecipeFor,refiningReturnRate,refiningInputsFor,compareRefining,purchaseComponents,plannedRefining} from '../core/refining-integration.js';
import {craftCost} from '../core/engine.js';
import {rebuildPlan} from '../core/plan.js';
import {verifyPlannedPrices} from '../core/verify.js';
import {BRANCHES,branchIsRoyalOnly,registerPotionFamilies,sortedBranches} from '../core/branches.js';
const now=new Date(Date.now()-90000).toISOString();
function row(id,city,price){return {item_id:id,city,quality:1,sell_price_min:price,sell_price_min_date:now,buy_price_max:price,buy_price_max_date:now};}
function sample(){
 const quote={T5_ORE:{price:10,city:'Thetford',at:Date.now()-90000},T4_METALBAR:{price:15,city:'Thetford',at:Date.now()-90000}};
 return compareRefining({id:'T5_METALBAR',craftCity:'Martlock',buyRefined:{price:100,city:'Martlock',at:Date.now()-90000},findMarket:id=>quote[id]||null,stationFee:5,transferFee:2,mode:'auto'});
}
test('v8.1 refiner reconoce cinco familias, recetas escalonadas y encantamiento de tier anterior',()=>{
 assert.deepEqual(refiningRecipeFor('T4_METALBAR_LEVEL1@1'),{id:'T4_METALBAR_LEVEL1@1',tier:4,level:1,family:'METALBAR',city:'Thetford',label:'Lingotes',rawId:'T4_ORE_LEVEL1@1',rawCount:2,previousId:'T3_METALBAR'});
 assert.equal(refiningRecipeFor('T5_CLOTH_LEVEL2@2').previousId,'T4_CLOTH_LEVEL2@2');
 assert.equal(refiningRecipeFor('T8_LEATHER').rawCount,5);
 assert.equal(refiningRecipeFor('T4_STONEBLOCK_LEVEL1@1'),null);
 assert.equal(refiningRecipeFor('T4_POTION_HEAL'),null);
 assert.deepEqual(new Set(refiningInputsFor(['T5_METALBAR','T4_PLANKS','T4_POTION_HEAL'])),new Set(['T5_ORE','T4_METALBAR','T4_WOOD','T3_PLANKS']));
});
test('v8.1 bono de refino 40% no se confunde con bono de crafting 15%',()=>{
 assert(Math.abs(refiningReturnRate()-36.708860759)<.01);
 assert(Math.abs(refiningReturnRate({focus:true})-53.917050691)<.1);
 assert(Math.abs(refiningReturnRate({dailyBonus:10})-40.476190476)<.1);
 assert.throws(()=>refiningReturnRate({dailyBonus:17}));
});
test('v8.1 comparación elige refinado rentable y cuantifica capital bruto',()=>{
 const x=sample();assert(x.comparison.possible);assert(x.source.refining);
 assert.equal(x.source.refining.city,'Thetford');
 assert.equal(x.source.upfrontUnitPrice,52);
 assert(Math.abs(x.source.price-(45*(1-58/158)+7))<.1);
 assert(x.source.price<100);
 const y=compareRefining({id:'T5_METALBAR',craftCity:'Martlock',buyRefined:{price:20,city:'Martlock'},findMarket:id=>({T5_ORE:10,T4_METALBAR:15}[id]?{price:{T5_ORE:10,T4_METALBAR:15}[id],city:'Thetford'}:null),mode:'auto',stationFee:5,transferFee:2});
 assert(!y.source.refining);
});
test('v8.1 si faltan precios de crudos no inventa costos y conserva compra directa',()=>{
 const x=compareRefining({id:'T5_METALBAR',craftCity:'Martlock',buyRefined:{price:100,city:'Martlock'},findMarket:()=>null,mode:'always'});
 assert.equal(x.source.price,100);assert.equal(x.comparison.possible,false);
});
test('v8.1 crafting incorpora capital y costo neto sin inventar refinado gratuito',()=>{
 const x=sample().source;
 const rec={materials:[{id:'T5_METALBAR',count:4,ret:true}]};
 const calc=craftCost(rec,()=>x,20,8);
 assert(calc);
 assert.equal(calc.rawMaterials,208);
 assert(Math.abs(calc.materialCost-4*.8*x.price)<.001);
 assert.equal(calc.materials[0].refining.inputs.length,2);
 const mats=purchaseComponents(calc.materials[0]);
 assert.deepEqual(mats.map(m=>[m.id,m.count]),[['T5_ORE',12],['T4_METALBAR',4]]);
 const route={id:'T5_SHOES_PLATE_SET1',city:'Black Market',craftCity:'Martlock',qty:2,maxCrafts:2,
    profit:500,cost:calc.total,capitalPerUnit:calc.rawMaterials+8,focusPerUnit:0,materials:calc.materials,
    sell:3000,saleTaxPercent:2.5,mode:'instant',depthVerified:false,craftAmount:1};
 const plan=rebuildPlan([route],10000);
 assert(plan.ok);
 assert.deepEqual(plan.materials.map(m=>[m.id,m.qtyGross]).sort((a,b)=>a[0].localeCompare(b[0])),[['T4_METALBAR',8],['T5_ORE',24]]);
 assert.equal(plan.totalCost,432);
 assert.equal(plannedRefining(plan.rows)[0].crafts,8);
});
test('v8.1 verificación actualiza crudos y predecesores; rechaza cotización faltante',()=>{
 const src=sample().source;
 const c=craftCost({materials:[{id:'T5_METALBAR',count:4,ret:true}]},()=>src,20,8);
 const route={id:'T5_SHOES_PLATE_SET1',city:'Martlock',craftCity:'Martlock',qty:1,maxCrafts:2,
   profit:500,cost:c.total,capitalPerUnit:c.rawMaterials+8,focusPerUnit:0,materials:c.materials,
   sell:1000,returnRate:20,saleTaxPercent:4,mode:'instant',taxRate:.04,setupRate:0,stationCost:8,transportCost:0};
 const data=[row('T5_SHOES_PLATE_SET1','Martlock',1000),row('T5_ORE','Thetford',10),row('T4_METALBAR','Thetford',15)];
 const ok=verifyPlannedPrices([route],data,{budget:5000,book:new Map()});
 assert(ok.ok);assert(ok.plan?.materials.some(m=>m.id==='T5_ORE'));
 const bad=verifyPlannedPrices([route],data.slice(0,-1),{budget:5000});
 assert(!bad.ok);assert(bad.blockers.some(x=>x.includes('T4_METALBAR')));
});
test('v8.1 cubre 14 familias de pociones, incluidas tornado y recolección',()=>{
 const keys=['potion_all','potion_heal','potion_energy','potion_poison','potion_gigant','potion_resist','potion_sticky','potion_invis','potion_calm','potion_cleanse','potion_acid','potion_berserk','potion_fire','potion_gather','potion_tornado'];
 const groups=sortedBranches('potions');assert.equal(groups.length,15);
 for(const k of keys){const b=BRANCHES.find(x=>x.key===k);assert(b,`${k} falta`);assert(branchIsRoyalOnly(k));}
 assert(BRANCHES.find(x=>x.key==='potion_tornado').test('T8_POTION_TORNADO@3'));
 assert(!BRANCHES.find(x=>x.key==='potion_tornado').test('T6_POTION_HEAL'));
});
test('v8.1 detecta familias de pociones introducidas por parches futuros',()=>{
 const id='T7_POTION_FUTURE_PATCH';
 const n=registerPotionFamilies({[id]:{materials:[{id:'T7_HERB',count:2}]}},{[id]:'Poción experimental'});
 assert.equal(n,1);const newBranch=sortedBranches('potions').find(b=>b.key==='potion_auto_future_patch');
 assert(newBranch);assert(newBranch.test(id));assert(newBranch.test(id+'@1'));
 assert.equal(registerPotionFamilies({[id]:{materials:[{id:'T7_HERB',count:2}]}},{}),0);
});
test('v8.1 logística añade refinado entre compra y fabricación sin crear etapas extras si se compra refinado',async()=>{
 const {planLogistics}=await import('../core/logistics.js');
 const source=sample().source;
 const cost=craftCost({materials:[{id:'T5_METALBAR',count:3,ret:true}]},()=>source,20,0);
 const plan={materials:[{id:'T5_ORE',city:'Thetford',qtyGross:9,unitPrice:10},{id:'T4_METALBAR',city:'Thetford',qtyGross:3,unitPrice:15}],
  rows:[{id:'T5_SHOES_PLATE_SET1',city:'Martlock',craftCity:'Martlock',qty:1,materials:cost.materials,transportCost:0,craftAmount:1,mode:'listed'}]};
 const logistics=planLogistics(plan);
 assert.deepEqual(logistics.steps.map(x=>x.stage),['Comprar materiales','Refinar materiales','Fabricar','Vender']);
 assert.equal(logistics.steps[1].city,'Thetford');
 assert.equal(logistics.steps[1].units,3);
});
