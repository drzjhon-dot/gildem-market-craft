import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BRANCHES,branchByKey,categoryForBranch,sortedBranches,branchIsRoyalOnly} from '../core/branches.js';
import {specialType,extractSpecialRecipes,blackMarketEligible} from '../core/special-recipes.js';
import {selectUniversalRecipes,createUniversalCandidates} from '../core/opportunity-scan.js';
import {rowMap} from '../core/engine.js';

const kit='T4_2H_TOOL_TRACKING';
const hammer='T4_2H_TOOL_SIEGEHAMMER';
const ava='T4_2H_TOOL_SIEGEHAMMER_AVALON';
const banner='T4_SIEGE_BANNER';
const side='T4_OFF_SHIELD';
const bag='T4_BAG';
const sampleIds=[kit,hammer,ava,banner];
const req={craftresource:[{'@uniquename':'T4_PLANKS','@count':'2'},{'@uniquename':'T4_LEATHER','@count':'6'}]};
const mocked={items:{equipmentitem:sampleIds.map(id=>({'@uniquename':id,craftingrequirements:req}))}};
const special=extractSpecialRecipes(mocked);
const all={...special,[side]:{materials:[{id:'T4_PLANKS',count:2},{id:'T4_LEATHER',count:6}],city:'Martlock'},[bag]:{materials:[{id:'T4_PLANKS',count:2}],city:'Brecilien'}};
const baseOpts={tierMin:4,tierMax:8,enchant:4,limit:100,categoryForBranch};

test('v8.4.4: categorías completas y exclusivas en el árbol',()=>{
 assert.equal(categoryForBranch('offhand'),'offhands');
 assert.equal(categoryForBranch('bags'),'accessories');
 assert.equal(categoryForBranch('capes'),'accessories');
 assert.equal(categoryForBranch('gather_tool_tracking'),'kits');
 assert.equal(categoryForBranch('siege'),'siege');
 assert.equal(categoryForBranch('siege_banner'),'siege');
 assert.deepEqual(sortedBranches('siege').map(b=>b.key),['siege','siege_banner']);
 assert.deepEqual(sortedBranches('offhands').map(b=>b.key),['offhand']);
 assert.deepEqual(sortedBranches('kits').map(b=>b.key),['gather_tool_tracking']);
 assert(!branchByKey('gather_all').test(kit));
 assert(!branchByKey('gather_tools').test(kit));
 assert(!branchByKey('weapons_all').test(hammer));
 assert(!branchByKey('weapons_all').test(kit));
 assert(branchIsRoyalOnly('siege_banner'));
});

test('v8.4.4: captura todos los tipos reales de asedio y kits',()=>{
 assert.equal(specialType(kit),'kit');
 for(const id of [hammer,ava,banner])assert.equal(specialType(id),'siege');
 assert.equal(specialType('T5_2H_TOOL_SIEGEHAMMER_AVALON'),'siege');
 assert.equal(specialType('T5_SIEGE_BANNER'),'siege');
 assert.equal(specialType('T4_2H_TOOL_AXE'),'gather');
 for(const id of sampleIds)assert.deepEqual(special[id].materials.map(m=>[m.id,m.count]),[['T4_PLANKS',2],['T4_LEATHER',6]]);
 assert.equal(special[banner].kind,'siege');
 assert.equal(special[ava].kind,'siege');
 assert.equal(special[kit].kind,'kit');
 assert.equal(blackMarketEligible(kit),false);
 assert.equal(blackMarketEligible(hammer),false);
});

test('v8.4.4: escáner respeta las categorías nuevas sin mezclar armas',()=>{
 const choose=categories=>selectUniversalRecipes(all,BRANCHES,{...baseOpts,categories}).chosen.map(x=>x.id);
 assert.deepEqual(choose(['kits']),[kit]);
 assert.deepEqual(choose(['siege']).sort(),[hammer,ava,banner].sort());
 assert.deepEqual(choose(['offhands']),[side]);
 assert.deepEqual(choose(['accessories']),[bag]);
 assert.deepEqual(choose(['gathering']),[]);
 assert.deepEqual(choose(['weapons']),[]);
});

test('v8.4.4: planes de asedio y kits pasan por cálculo económico Royal',()=>{
 const now=new Date(Date.now()-4000).toISOString();
 const raw=[
 ['T4_PLANKS','Caerleon',100,'sell_price_min'],
 ['T4_LEATHER','Caerleon',100,'sell_price_min'],
 [kit,'Lymhurst',3000,'sell_price_min'],
 [hammer,'Lymhurst',3000,'sell_price_min'],
 [ava,'Lymhurst',3000,'sell_price_min'],
 [banner,'Lymhurst',3000,'sell_price_min']
 ].map(([item_id,city,price,side])=>({item_id,city,quality:1,[side]:price,[side+'_date']:now}));
 const selected=selectUniversalRecipes(all,BRANCHES,{...baseOpts,categories:['kits','siege']}).chosen;
 const actual=createUniversalCandidates({selected,recipes:all,priceMap:rowMap(raw),inputs:{market:'royal',cities:['Caerleon','Lymhurst'],materialPurchase:'all',buyMode:'instant',refiningMode:'off',focus:false,daily:0,station:0,saleMode:'listed',listingFee:2.5,transport:0,materialShipping:0,bmTax:2.5,royalTax:4,riskBM:0,riskRoyal:0,priceStress:8,resourceStress:7}});
 for(const id of sampleIds){
  const x=actual.candidates.find(v=>v.id===id && v.city==='Lymhurst');
  assert(x,`${id} no pasa a profit`);
  assert(x.profit>0);
  assert(x.capitalPerUnit>0);
  assert(['kit','siege'].includes(x.recipeKind));
 }
});

test('v8.4.5: kits y asedio solo aparecen en Encontrar oportunidades, no en Plan BM',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const catalog=readFileSync(new URL('../core/catalog.js',import.meta.url),'utf8');
 const backend=readFileSync(new URL('../netlify/functions/recipes.mjs',import.meta.url),'utf8');
 assert(app.includes("const BM_CATEGORIES=['armor','weapons','accessories','offhands']"));
 assert(app.includes("['kits','Kits'"));
 assert(app.includes("['siege','Asedio'"));
 assert.equal((app.match(/\['gathering','potions','mounts','foods','kits','siege'\]\.includes\(x\)/g)||[]).length,2);
 assert(catalog.includes('special-recipes-v5-kits-siege-offhands'));
 assert(backend.includes('special-recipes-v5-kits-siege-offhands'));
});
