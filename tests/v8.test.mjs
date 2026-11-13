import test from 'node:test';import assert from 'node:assert/strict';
import {selectUniversalRecipes,createUniversalCandidates,verifiedRotation} from '../core/opportunity-scan.js';
import {validateEntry,availableInventory,procurementPlan,consumeAllocations} from '../core/inventory.js';
import {planLogistics} from '../core/logistics.js';
import {recipeSnapshot,compareSnapshot,flagChangedPortfolios} from '../core/patch-watch.js';
import {newSyncCode,syncId,encryptPayload,decryptPayload,fromBase64Url} from '../core/sync-crypto.js';
import {rebuildPlan} from '../core/plan.js';
import {cashPosition,startPortfolio} from '../core/cashflow.js';
import {gameFocusCost} from '../core/game-focus.js';
const now=new Date(Date.now()-1800000).toISOString();
const recipes={T4_MAIN_AXE:{city:'Martlock',materials:[{id:'T4_METALBAR',count:8,ret:true}],amountCrafted:1},T5_MAIN_AXE:{city:'Martlock',materials:[{id:'T5_METALBAR',count:8,ret:true}]},T4_MEAL_SALAD:{city:'Caerleon',materials:[{id:'T4_CARROT',count:6,ret:true}],amountCrafted:10,kind:'food'},T4_SHOES_PLATE_SET1:{city:'Martlock',materials:[{id:'T4_METALBAR',count:8,ret:true}]}};
const branches=[{key:'axe',test:id=>id.includes('MAIN_AXE')},{key:'foods_all',test:id=>id.includes('MEAL_')},{key:'boots_plate',test:id=>id.includes('SHOES_PLATE')}];
const categoryForBranch=key=>key==='axe'?'weapons':key==='foods_all'?'foods':'armor';
const names=Object.keys(recipes);
function rows(names,city,side,price){return names.map(id=>({item_id:id,city,quality:1,[side]:price,[side+'_date']:now}));}
const quoteRows=[...rows(names,'Martlock','sell_price_min',2500),...rows(names,'Lymhurst','sell_price_min',2600),...rows(names,'Caerleon','sell_price_min',2400),...rows(['T4_METALBAR','T5_METALBAR','T4_CARROT'],'Martlock','sell_price_min',100),...rows(['T4_METALBAR','T5_METALBAR','T4_CARROT'],'Caerleon','sell_price_min',100),...rows(['T4_METALBAR','T5_METALBAR','T4_CARROT'],'Lymhurst','sell_price_min',110),...rows(names,'Black Market','buy_price_max',3000),...rows(names,'Lymhurst','buy_price_max',2500)];
const map=new Map();for(const r of quoteRows){const k=r.item_id+'|'+r.city+'|'+r.quality;map.set(k,{...(map.get(k)||{}),...r});}
const inputs={market:'mixed',cities:['Martlock','Lymhurst','Caerleon'],focus:false,daily:0,station:40,transport:50,materialShipping:5,saleMode:'listed',buyMode:'instant',listingFee:2.5,bmTax:2.5,royalTax:4,riskBM:0,riskRoyal:0,priceStress:8,resourceStress:7};
test('v8 scanner round robin: cubre familias distintas y nunca dice cobertura completa si es parcial',()=>{
 const x=selectUniversalRecipes(recipes,branches,{categoryForBranch,limit:2});assert.equal(x.scanned,2);assert.equal(x.partial,true);
 assert.equal(new Set(x.chosen.map(y=>y.branch)).size,2);
 const full=selectUniversalRecipes(recipes,branches,{categoryForBranch,limit:50});assert.equal(full.scanned,4);assert.equal(full.partial,false);
});
test('v8 scan aplica restricciones de mercado: comidas solo Royal y equipo con BM',()=>{
 const selected=selectUniversalRecipes(recipes,branches,{categoryForBranch,limit:10}).chosen;
 const result=createUniversalCandidates({selected,recipes,priceMap:map,inputs});
 assert(result.candidates.some(x=>x.id==='T4_MAIN_AXE'&&x.city==='Black Market'));
 assert(result.candidates.some(x=>x.id==='T4_MEAL_SALAD'&&x.city==='Lymhurst'&&x.craftAmount===10));
 assert(!result.candidates.some(x=>x.id==='T4_MEAL_SALAD'&&x.city==='Black Market'));
});
test('v8 food batch profit uses 10 outputs, 10x transport, 1x inputs',()=>{
 const x=createUniversalCandidates({selected:[{id:'T4_MEAL_SALAD',branch:'foods_all'}],recipes,priceMap:map,inputs});
 const y=x.candidates.find(r=>r.city==='Lymhurst');assert(y);
 assert.equal(y.craftAmount,10);assert.equal(y.transportCost,500);assert.equal(y.materials[0].count,6);
});
test('v8 Focus auto: coste verificado del juego (ao-bin-dumps) o ninguno; nunca se adivina',()=>{
 // v9.10: el hacha T4 tiene coste de Focus publicado en el juego → se usa.
 const x=createUniversalCandidates({selected:[{id:'T4_MAIN_AXE',branch:'axe'}],recipes,priceMap:map,inputs:{...inputs,focus:true},profile:{}});
 assert.equal(x.missing.focus,0);assert(x.candidates.every(c=>c.focusPerUnit===gameFocusCost('T4_MAIN_AXE')));
 // Un objeto sin coste conocido sigue sin Focus inventado.
 const y=createUniversalCandidates({selected:[{id:'T4_MAIN_UNKNOWNTHING',branch:'axe'}],recipes:{T4_MAIN_UNKNOWNTHING:recipes.T4_MAIN_AXE},priceMap:map,inputs:{...inputs,focus:true},profile:{}});
 assert.equal(y.candidates.length,0);assert.equal(y.missing.focus,1);
});
test('v8 personal rotation needs 3 sold units, AODP history alone is insufficient',()=>{
 assert.equal(verifiedRotation({profit:1200,personalLearning:null}),null);
 assert.equal(verifiedRotation({profit:1200,personalLearning:{qtySold:2,averageDays:1}}),null);
 assert.equal(verifiedRotation({profit:1200,personalLearning:{qtySold:4,averageDays:2}}).silverPerDay,600);
});
test('v8 inventory avoids double reservation across pending plans',()=>{
 const entries=[{id:'T4_METALBAR',city:'Martlock',qty:20,unitCost:90}];
 const old=[{started:false,inventoryAllocations:[{id:'T4_METALBAR',city:'Martlock',qty:8}]}];
 const x=procurementPlan([{id:'T4_METALBAR',city:'Martlock',qtyGross:17,unitPrice:100}],entries,old);
 assert.equal(x.needed[0].stock,12);assert.equal(x.needed[0].buy,5);assert.equal(x.cashSaved,1200);
 assert.equal(availableInventory(entries,old)[0].reserved,8);
 assert.equal(consumeAllocations(entries,[{id:'T4_METALBAR',city:'Martlock',qty:12}])[0].qty,8);
});
test('v8 inventory detects invalid qty and insufficient stock on consume',()=>{
 assert.throws(()=>validateEntry({id:'INVALID',city:'Martlock',qty:2,unitCost:5}));
 assert.throws(()=>validateEntry({id:'T4_METALBAR',city:'Martlock',qty:-1,unitCost:5}));
 assert.throws(()=>consumeAllocations([{id:'T4_METALBAR',city:'Martlock',qty:2,unitCost:4}],[{id:'T4_METALBAR',city:'Martlock',qty:3}]));
});
test('v8 cash only deducts material purchases not owned inventory twice',()=>{
 const p={id:'plan1',started:false,inventoryCredit:200,lots:[{qty:1,capitalPerUnit:1000,sales:[]}]};
 const wallet={initial:1000,adjustments:[]};
 const started=startPortfolio([p],'plan1',wallet);
 assert.equal(cashPosition(wallet,started).available,200);
});
test('v8 logistics aggregate stages and costs without fabricated route times',()=>{
 const l=planLogistics({materials:[{id:'T4_METALBAR',city:'Martlock',qtyGross:8,unitPrice:100}],rows:[{id:'T4_MAIN_AXE',craftCity:'Martlock',city:'Black Market',qty:2,craftAmount:1,transportCost:500,mode:'instant'}]});
 assert.equal(l.steps.length,3);assert.equal(l.transportEstimated,1000);assert(l.steps.some(x=>x.city==='Caerleon · Mercado Negro'));assert(!('duration' in l));
});
test('v8 changed crafting recipe flags saved plan and ignores irrelevant variants',()=>{
 const snapshot=recipeSnapshot([{id:'T4_MAIN_AXE'}],recipes);
 const changed={...recipes,T4_MAIN_AXE:{...recipes.T4_MAIN_AXE,materials:[{id:'T4_METALBAR',count:7,ret:true}]}};
 const p=flagChangedPortfolios([{recipeSnapshot:snapshot}],changed,'rev123');
 assert.deepEqual(p[0].patchChanges,['T4_MAIN_AXE']);assert.equal(compareSnapshot(snapshot,recipes).length,0);
});
test('v8 encrypted sync roundtrip and authentication rejects wrong code',async()=>{
 const code=newSyncCode();assert.equal(fromBase64Url(code).length,32);
 const other=newSyncCode();assert.notEqual(await syncId(code),await syncId(other));
 const data={version:8,portfolios:[{id:'example'}],inventory:[]};
 const cipher=await encryptPayload(data,code);assert(!JSON.stringify(cipher).includes('example'));
 assert.deepEqual(await decryptPayload(cipher,code),data);
 await assert.rejects(()=>decryptPayload(cipher,other),/Clave incorrecta/);
});
