import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {visibleRoyalBranches,refiningBranchFamilies} from '../core/branches.js';
import {rowMap} from '../core/engine.js';
import {refinementScanIds,createRefiningCandidates} from '../core/refining-opportunities.js';
import {MARKET_REFERENCES,marketReferenceSnapshot} from '../core/market-references.js';
import {verifyMarketReferences} from '../netlify/functions/market-references.mjs';
import {evaluateCraftViability} from '../core/viability.js';

const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
test('Royal Craft muestra SOLO una rama de monturas, seis profesiones de recolección, y refinamiento',()=>{
 assert.deepEqual(visibleRoyalBranches('mounts').map(b=>b.key),['mount_all']);
 assert.deepEqual(visibleRoyalBranches('gathering').map(b=>b.key),['gather_wood','gather_hide','gather_ore','gather_fiber','gather_rock','gather_fish']);
 assert.equal(visibleRoyalBranches('refining').length,6);
 assert.deepEqual(refiningBranchFamilies('refining_METALBAR'),['METALBAR']);
 assert.deepEqual(refiningBranchFamilies('refining_all'),['METALBAR','PLANKS','CLOTH','LEATHER','STONEBLOCK']);
});
test('Las herramientas y equipos de profesiones visibles no se duplican entre secciones',()=>{
 const branches=visibleRoyalBranches('gathering');
 for(const id of ['T5_2H_TOOL_AXE','T5_2H_TOOL_AXE_AVALON','T5_ARMOR_GATHERER_WOOD','T5_BACKPACK_GATHERER_WOOD','T5_2H_TOOL_PICK','T5_HEAD_GATHERER_ORE','T5_2H_TOOL_SICKLE','T5_2H_TOOL_FISHINGROD']){
  assert.equal(branches.filter(b=>b.test(id)).length,1,id);
 }
});
test('Refinamiento permite T5 y usa bono diario de 20% y ciudad sin bono',()=>{
 const selected=refinementScanIds({families:['METALBAR'],tierMin:5,tierMax:5,enchant:0});
 assert.deepEqual(selected.map(x=>x.id),['T5_METALBAR']);
 const dt=new Date().toISOString();
 const quotes=[
  ['T5_ORE','Thetford',100],['T5_ORE','Caerleon',100],
  ['T4_METALBAR','Thetford',100],['T4_METALBAR','Caerleon',100],
  ['T5_METALBAR','Martlock',2000]
 ].map(([item_id,city,price])=>({item_id,city,quality:1,sell_price_min:price,sell_price_min_date:dt,buy_price_max:price,sell_price_max_date:dt}));
 const priceMap=rowMap(quotes);
 const common={selected,priceMap,market:'royal',mode:'listed',dailyBonus:20,maxAge:24,stationFee:10,royalTax:4,listingFee:2.5};
 const bonus=createRefiningCandidates({...common,bonusCity:true}).candidates;
 const noBonus=createRefiningCandidates({...common,bonusCity:false}).candidates;
 assert.equal(bonus.length,1);
 assert.equal(noBonus.length,1);
 assert.equal(bonus[0].craftCity,'Thetford');
 assert.equal(noBonus[0].craftCity,'Caerleon');
 assert.ok(bonus[0].returnRate>noBonus[0].returnRate);
 assert.equal(bonus[0].mode,'listed');
 assert.equal(bonus[0].referenceSide,'sell_price_min');
 assert.ok(bonus[0].setupRate>0);
});
test('BM acepta orden de venta con actividad suficiente, sin exigir profundidad instantánea',()=>{
 const row={id:'T5_MAIN_AXE',city:'Black Market',craftCity:'Martlock',mode:'listed',sell:100000,cost:75000,
  capitalPerUnit:85000,profit:25000,stressProfit:12000,roi:33,ageHours:2,referenceSide:'buy_price_max',
  activity:{activeDays:9,observedDaily:10,observations:9},stationCost:10,transportCost:3000,
  materials:[{id:'T5_METALBAR',city:'Martlock',shippingPerUnit:0}],saleTaxPercent:2.5,setupRate:.025,craftAmount:1};
 const listed=evaluateCraftViability(row,{budget:3000000,mode:'black'});
 assert.equal(listed.ok,true,listed.reasons.join('; '));
 const instant=evaluateCraftViability({...row,mode:'instant'},{budget:3000000,mode:'black'});
 assert.equal(instant.ok,false);
 assert.match(instant.reasons.join(' '),/Mercado Negro sin compras verificadas/);
});
test('modo AODP-only: no verifica otras webs ni importa otros precios',async()=>{
 assert.equal(MARKET_REFERENCES.length,0);
 let calls=0;
 const probe=await verifyMarketReferences(async()=>{calls++;throw Error('No debe consultar terceros');});
 assert.equal(calls,0);
 assert.equal(probe.region,'west');
 assert.equal(probe.usedForPrices,true);
 assert.equal(probe.usedForMarketVolume,true);
 assert.equal(probe.checks.length,0);
 assert.deepEqual(marketReferenceSnapshot(probe),[]);
});
test('El formulario y los resultados muestran órdenes y fuentes por plan',()=>{
 assert.ok(source.includes('marketReferencesPromise=Promise.resolve(null)'));
 assert.ok(!source.includes('marketReferencesPanel('));
 assert.ok(!source.includes('marketReferencesPanel(current.marketReferences)'), 'Las tarjetas de Fuentes y evidencia no deben renderizarse');
 assert.ok(source.includes('bmMode:\'listed\''));
 assert.ok(source.includes('refineDaily=daily'));
 assert.ok(source.includes("bonusCity:checked('auto-qc-bonus')"));
 assert.ok(source.includes('Royal Craft'));
});
