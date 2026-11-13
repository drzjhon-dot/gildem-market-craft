import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {specialType,blackMarketEligible,extractSpecialRecipes,GATHER_TOOL_PATTERN,TRACKING_KIT_PATTERN} from '../core/special-recipes.js';
import {BRANCHES,branchByKey,branchIsRoyalOnly,categoryForBranch,branchIconId,recipesForBranch} from '../core/branches.js';
import {selectUniversalRecipes,createUniversalCandidates} from '../core/opportunity-scan.js';
import {rowMap} from '../core/engine.js';

const toolIds=['T4_2H_TOOL_AXE','T5_2H_TOOL_PICK','T6_2H_TOOL_SICKLE_AVALON',
  'T7_2H_TOOL_KNIFE','T5_2H_TOOL_HAMMER_AVALON','T4_2H_TOOL_FISHINGROD',
  'T6_2H_TOOL_TRACKING'];
const sampleRecipes=Object.fromEntries(toolIds.map(id=>[id,{city:'Caerleon',materials:[{id:'T4_PLANKS',count:6,ret:true},{id:'T4_METALBAR',count:4,ret:true}],amountCrafted:1}]));
function fixture(){
  const items=toolIds.map(id=>({'@uniquename':id,craftingrequirements:{'@amountcrafted':'1',craftresource:[{'@uniquename':'T4_PLANKS','@count':'6'},{'@uniquename':'T4_METALBAR','@count':'4'}]}}));
  return {items:{equipmentitem:[...items,{'@uniquename':'T4_2H_TOOL_SIEGEHAMMER',craftingrequirements:{craftresource:{'@uniquename':'T4_PLANKS','@count':'1'}}}]}};
}

test('v8.4.2 reconoce herramientas reales, avalonianas y excluye asedio',()=>{
  for(const id of toolIds){assert(id.includes('TRACKING')?TRACKING_KIT_PATTERN.test(id):GATHER_TOOL_PATTERN.test(id));assert.equal(specialType(id),id==='T6_2H_TOOL_TRACKING'?'kit':'gather');assert.equal(blackMarketEligible(id),false);}
  assert.equal(specialType('T4_2H_TOOL_SIEGEHAMMER'),'siege');
  assert.equal(GATHER_TOOL_PATTERN.test('T4_2H_TOOL_SIEGEHAMMER'),false);
  assert.equal(blackMarketEligible('T4_MAIN_AXE'),true);
});

test('v8.4.2 extrae recetas oficiales sin inventar materiales o cantidades',()=>{
  const r=extractSpecialRecipes(fixture());
  assert.equal(Object.keys(r).length,toolIds.length+1);
  for(const id of toolIds){
    assert.deepEqual(r[id].materials.map(x=>[x.id,x.count]),[['T4_PLANKS',6],['T4_METALBAR',4]]);
    assert.equal(r[id].amountCrafted,1);assert.equal(r[id].city,'Caerleon');assert.equal(r[id].market,'royal');
  }
  assert.equal(r.T4_2H_TOOL_SIEGEHAMMER.kind,'siege');
});

test('v8.4.2 recoge cada herramienta bajo su profesión y permite elegir solo herramientas',()=>{
  const checks={gather_wood:'T4_2H_TOOL_AXE',gather_ore:'T5_2H_TOOL_PICK',gather_fiber:'T6_2H_TOOL_SICKLE_AVALON',
    gather_hide:'T7_2H_TOOL_KNIFE',gather_rock:'T5_2H_TOOL_HAMMER_AVALON',gather_fish:'T4_2H_TOOL_FISHINGROD',gather_tool_tracking:'T6_2H_TOOL_TRACKING'};
  for(const [key,id] of Object.entries(checks)){
    assert(branchByKey(key).test(id),key+' should include '+id);
    assert.equal(categoryForBranch(key),key==='gather_tool_tracking'?'kits':'gathering');assert(branchIsRoyalOnly(key));assert.match(branchIconId(key),/^T4_/);
  }
  assert(branchByKey('gather_tools').test('T5_2H_TOOL_PICK'));
  assert(!branchByKey('gather_tools').test('T5_ARMOR_GATHERER_ORE'));
  assert(branchByKey('gather_all').test('T5_2H_TOOL_PICK'));
  assert(branchByKey('gather_all').test('T5_ARMOR_GATHERER_ORE'));
  assert(!branchByKey('gather_tools').test('T6_2H_TOOL_SIEGEHAMMER'));
  assert.deepEqual(recipesForBranch(sampleRecipes,'gather_tool_pick',4,8,4,100),['T5_2H_TOOL_PICK']);
});

test('v8.4.2 Encontrar oportunidades respeta filtros de ramas y objetos de herramientas',()=>{
 const options={categories:['gathering','kits'],tierMin:4,tierMax:8,enchant:4,limit:200,categoryForBranch};
 const all=selectUniversalRecipes(sampleRecipes,BRANCHES,options);
 assert.equal(all.chosen.length,toolIds.length);
 const pick=selectUniversalRecipes(sampleRecipes,BRANCHES,{...options,branchKeys:['gather_tool_pick']});
 assert.deepEqual(pick.chosen.map(x=>x.id),['T5_2H_TOOL_PICK']);
 const av=selectUniversalRecipes(sampleRecipes,BRANCHES,{...options,branchKeys:['gather_tools'],itemFilter:{mode:'selected',stems:['2H_TOOL_SICKLE_AVALON']}});
 assert.deepEqual(av.chosen.map(x=>x.id),['T6_2H_TOOL_SICKLE_AVALON']);
 const none=selectUniversalRecipes(sampleRecipes,BRANCHES,{...options,branchKeys:['gather_tool_pick'],itemFilter:{mode:'selected',stems:['2H_TOOL_AXE']}});
 assert.equal(none.chosen.length,0);
});

test('v8.4.2 herramientas entran al cálculo de capital y profit con precios Royal recientes',()=>{
 const iso=new Date(Date.now()-5000).toISOString();
 const records=[['T4_PLANKS','Caerleon','sell_price_min',100],['T4_METALBAR','Caerleon','sell_price_min',100],
   ['T4_2H_TOOL_AXE','Bridgewatch','sell_price_min',3500]]
  .map(([item_id,city,side,p])=>({item_id,city,quality:1,[side]:p,[side+'_date']:iso}));
 const result=createUniversalCandidates({selected:[{id:'T4_2H_TOOL_AXE',branch:'gather_tool_axe'}],recipes:sampleRecipes,priceMap:rowMap(records),inputs:{market:'royal',cities:['Caerleon','Bridgewatch'],materialPurchase:'all',buyMode:'instant',refiningMode:'off',focus:false,daily:0,station:0,saleMode:'listed',listingFee:2.5,transport:0,materialShipping:0,bmTax:2.5,royalTax:4,riskBM:0,riskRoyal:0,priceStress:8,resourceStress:7}});
 const p=result.candidates.find(x=>x.city==='Bridgewatch');
 assert(p);assert(p.profit>0);assert(p.capitalPerUnit>0);assert.equal(p.recipeKind,'gather');assert.equal(p.craftCity,'Caerleon');
});

test('v8.4.2 frontend, backend y service worker renuevan versión de recetas',()=>{
 const catalog=readFileSync(new URL('../core/catalog.js',import.meta.url),'utf8');
 const netlify=readFileSync(new URL('../netlify/functions/recipes.mjs',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert(catalog.includes('special-recipes-v5-kits-siege-offhands'));
 assert(netlify.includes('special-recipes-v5-kits-siege-offhands'));
 assert(sw.includes('gildem-craft-pro-v9.11.0'));
});
