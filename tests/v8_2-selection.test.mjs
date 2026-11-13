import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {itemStem,itemMatches,filterIds,familyChoices} from '../core/item-selection.js';
import {BRANCHES,categoryForBranch,recipesForBranch,registerMountFamilies,branchIsRoyalOnly} from '../core/branches.js';
import {selectUniversalRecipes,createUniversalCandidates} from '../core/opportunity-scan.js';
import {rowMap} from '../core/engine.js';
import {rebuildPlan} from '../core/plan.js';

const mat=[{id:'T5_METALBAR',count:8,ret:true}];
const rec=(city,materials=mat)=>({city,materials,amountCrafted:1});
const sample={T4_MOUNT_HORSE:rec('Caerleon',[{id:'T4_LEATHER',count:18}]),T5_MOUNT_ARMORED_ELK:rec('Caerleon',[{id:'T5_LEATHER',count:20}]),T6_MOUNT_ARMORED_ELK:rec('Caerleon',[{id:'T6_LEATHER',count:24}]),T5_MOUNT_OX:rec('Caerleon',[{id:'T5_LEATHER',count:20}]),T5_SHOES_PLATE_SET1:rec('Martlock'),T5_SHOES_PLATE_SET2:rec('Martlock'),T6_SHOES_PLATE_SET1:rec('Martlock')};

test('v8.2 agrupa las variantes de tier y encantamiento pero mantiene las distintas monturas',()=>{
 assert.equal(itemStem('T6_MOUNT_ARMORED_ELK@2'),'MOUNT_ARMORED_ELK');
 assert.equal(itemStem('T4_MOUNT_HORSE'),'MOUNT_HORSE');
 const list=familyChoices(Object.keys(sample),id=>'Ítem '+id);
 assert.equal(list.filter(x=>x.stem==='MOUNT_ARMORED_ELK').length,1);
 assert.deepEqual(list.find(x=>x.stem==='MOUNT_ARMORED_ELK').tiers,[5,6]);
 assert.equal(list.filter(x=>x.stem.startsWith('MOUNT_')).length,3);
});
test('v8.2 selección exacta de objetos, tiers y encantamiento nunca añade otros objetos',()=>{
 const ids=['T5_SHOES_PLATE_SET1','T5_SHOES_PLATE_SET1@1','T5_SHOES_PLATE_SET2@1','T6_SHOES_PLATE_SET1@1'];
 const f={mode:'selected',stems:['SHOES_PLATE_SET1'],enchExact:'1'};
 assert.deepEqual(filterIds(ids,f),['T5_SHOES_PLATE_SET1@1','T6_SHOES_PLATE_SET1@1']);
 assert.deepEqual(filterIds(ids,{...f,tierExact:'5'}),['T5_SHOES_PLATE_SET1@1']);
 assert(!itemMatches('T5_SHOES_PLATE_SET1@1',{mode:'selected',stems:[]}));
});
test('v8.2 filtro manual se aplica ANTES del límite de recetas',()=>{
 const r={...sample};
 const ids=recipesForBranch(r,'boots_plate',4,8,4,1,'auto',id=>itemMatches(id,{mode:'selected',stems:['SHOES_PLATE_SET2']}));
 assert.deepEqual(ids,['T5_SHOES_PLATE_SET2']);
});
test('v8.2 descubre monturas nuevas fabricables según recetas, sin skins ni recetas inventadas',()=>{
 const added=registerMountFamilies({...sample,T5_MOUNT_RARE_SKIN:rec('Caerleon'),T8_MOUNT_DEMO:{city:'Caerleon',materials:[]}}, {'T5_MOUNT_ARMORED_ELK':'Alce blindado'});
 assert(added>=1);
 const b=BRANCHES.find(x=>x.key==='mount_auto_armored_elk');assert(b);
 assert(b.label.includes('Alce blindado'));assert(b.test('T6_MOUNT_ARMORED_ELK'));
 assert(!b.test('T6_MOUNT_HORSE'));assert(branchIsRoyalOnly(b.key));
 assert.equal(registerMountFamilies(sample,{}),0);
 assert(!BRANCHES.find(x=>x.key==='mount_auto_rare_skin'));
});
test('v8.2 escáner filtra por rama elegida y luego por familia de objeto',()=>{
 const b='mount_auto_armored_elk';
 const x=selectUniversalRecipes(sample,BRANCHES,{categories:['mounts','armor'],tierMin:4,tierMax:8,enchant:2,limit:100,categoryForBranch,branchKeys:[b],itemFilter:{mode:'all'}});
 assert.deepEqual(new Set(x.chosen.map(y=>y.id)),new Set(['T5_MOUNT_ARMORED_ELK','T6_MOUNT_ARMORED_ELK']));
 const y=selectUniversalRecipes(sample,BRANCHES,{categories:['mounts','armor'],tierMin:4,tierMax:8,enchant:2,limit:100,categoryForBranch,branchKeys:[b],itemFilter:{mode:'selected',stems:['MOUNT_ARMORED_ELK']}});
 assert.deepEqual(y.chosen.map(z=>z.id).sort(),x.chosen.map(z=>z.id).sort());
 const none=selectUniversalRecipes(sample,BRANCHES,{categories:['mounts','armor'],tierMin:4,tierMax:8,enchant:2,limit:100,categoryForBranch,branchKeys:[b],itemFilter:{mode:'selected',stems:['MOUNT_HORSE']}});
 assert.equal(none.chosen.length,0);
});
test('v8.2 el escáner realmente compara refinado con compra y expande la lista de insumos',()=>{
 const now=new Date(Date.now()-10000).toISOString();
 const quotes=[
 ['T5_METALBAR','Martlock','sell_price_min',230],
 ['T5_ORE','Thetford','sell_price_min',12],
 ['T4_METALBAR','Thetford','sell_price_min',48],
 ['T5_SHOES_PLATE_SET1','Lymhurst','sell_price_min',2100]
 ].map(([item_id,city,field,price])=>({item_id,city,quality:1,[field]:price,[field+'_date']:now}));
 const m=rowMap(quotes);const selected=[{id:'T5_SHOES_PLATE_SET1',branch:'boots_plate'}];
 const inp={market:'royal',cities:['Martlock','Lymhurst','Thetford'],focus:false,daily:0,station:0,transport:0,materialShipping:0,saleMode:'listed',buyMode:'instant',listingFee:2.5,bmTax:2.5,royalTax:4,riskBM:0,riskRoyal:0,priceStress:8,resourceStress:7,refiningFee:0,refiningDaily:0,refiningFocus:false,refiningFocusUnit:0};
 const direct=createUniversalCandidates({selected,recipes:sample,priceMap:m,inputs:{...inp,refiningMode:'off'}}).candidates;
 const refined=createUniversalCandidates({selected,recipes:sample,priceMap:m,inputs:{...inp,refiningMode:'auto'}}).candidates;
 const old=direct.find(x=>x.city==='Lymhurst'),a=refined.find(x=>x.city==='Lymhurst');
 assert(old&&a);assert(a.materials[0].refining);assert(a.capitalPerUnit<old.capitalPerUnit);
 const plan=rebuildPlan([{...a,qty:1,maxCrafts:4}],100000);
 assert(plan.ok);assert(plan.materials.some(x=>x.id==='T5_ORE'));
 assert(plan.materials.some(x=>x.id==='T4_METALBAR'));
 assert(!plan.materials.some(x=>x.id==='T5_METALBAR'));
});
test('v8.2 interfaz reduce pestañas y enseña los dos controles de refinado',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 assert(!/data-nav="(?:cartera|focuslab|alertas)"/.test(html));
 assert(html.includes('data-nav="crafting"')&&html.includes('data-nav="autocraft"'));
 assert(!app.includes("'craft-refining-mode'")&&!app.includes("'auto-refining-mode'")); assert(app.includes("['refining','Refinamiento'"));
 assert(app.includes('auto-branch-options')&&app.includes('craft-item-options'));
});
