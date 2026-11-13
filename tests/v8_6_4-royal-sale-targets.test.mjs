import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CITIES,rowMap} from '../core/engine.js';
import {chooseRoyalSaleCities,normalizeRoyalSaleCities,filterRoyalSaleRoutes} from '../core/royal-sale-markets.js';
import {createUniversalCandidates} from '../core/opportunity-scan.js';
import {createRefiningCandidates,refinementScanIds} from '../core/refining-opportunities.js';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const now='2026-11-10T00:00:00.000Z';
const quote=(id,city,price)=>({item_id:id,city,quality:1,sell_price_min:price,sell_price_min_date:new Date().toISOString(),buy_price_max:price,buy_price_max_date:new Date().toISOString()});

test('selección Royal por defecto abarca las 7 ciudades, sin destinos externos o duplicados',()=>{
 assert.deepEqual(chooseRoyalSaleCities(undefined),CITIES);
 assert.deepEqual(chooseRoyalSaleCities([]),CITIES);
 assert.deepEqual(normalizeRoyalSaleCities(['Lymhurst','Martlock','Martlock','Black Market','Europe']),['Lymhurst','Martlock']);
 assert.deepEqual(filterRoyalSaleRoutes([{city:'Thetford'},{city:'Martlock'},{city:'Black Market'}],['Martlock']).map(x=>x.city),['Martlock']);
});

test('crafting solo propone las ciudades de VENTA elegidas, pero compara materiales en toda América',()=>{
 const recipes={T5_SHOES_PLATE_SET1:{city:'Martlock',materials:[{id:'T5_METALBAR',count:2,ret:true}]}};
 const priceMap=rowMap([
  quote('T5_METALBAR','Thetford',100),quote('T5_METALBAR','Lymhurst',500),
  quote('T5_SHOES_PLATE_SET1','Lymhurst',3000),quote('T5_SHOES_PLATE_SET1','Martlock',2700),
  quote('T5_SHOES_PLATE_SET1','Thetford',9000)
 ]);
 const inputs={market:'royal',cities:CITIES,saleCities:['Martlock','Lymhurst'],city:'auto',buyMode:'instant',materialPurchase:'all',focus:false,
  daily:0,station:0,transport:0,riskRoyal:0,royalTax:4,listingFee:2.5,saleMode:'listed',materialShipping:0,
  priceStress:8,resourceStress:7,refiningMode:'off',allowLoss:false};
 const candidates=createUniversalCandidates({selected:[{id:'T5_SHOES_PLATE_SET1',branch:'boots_plate'}],recipes,priceMap,inputs,maxAge:48}).candidates;
 assert.equal(candidates.length,2);
 assert.deepEqual(candidates.map(x=>x.city).sort(),['Lymhurst','Martlock']);
 assert(candidates.every(x=>x.materials[0].city==='Thetford'), 'Las compras deben seguir encontrando la materia prima más barata en Thetford');
});

test('refinamiento solo propone venta en ciudades elegidas y compra materias primas fuera de ellas',()=>{
 const selected=refinementScanIds({families:['METALBAR'],tierMin:5,tierMax:5,enchant:0});
 const priceMap=rowMap([
  quote('T5_ORE','Bridgewatch',100),quote('T4_METALBAR','Bridgewatch',100),
  quote('T5_METALBAR','Martlock',2400),quote('T5_METALBAR','Lymhurst',2600),quote('T5_METALBAR','Thetford',5000)
 ]);
 const out=createRefiningCandidates({selected,priceMap,market:'royal',mode:'listed',saleCities:['Martlock','Lymhurst'],maxAge:48,stationFee:0,bonusCity:true,royalTax:4,listingFee:2.5}).candidates;
 assert.deepEqual(out.map(x=>x.city).sort(),['Lymhurst','Martlock']);
 assert(out.every(x=>x.materials.every(m=>m.city==='Bridgewatch')),'Las compras no deben restringirse a las ciudades de venta');
});

test('interfaz Royal guarda selección y solo usa destinos elegidos',()=>{
 assert.match(app,/\$\{royalSaleCitiesHtml\(\)\}/);
 assert.match(app,/data-royal-sale-city/);
 assert.match(app,/selectedRoyalSaleCities\(\)/);
 assert.match(app,/saveRoyalSaleCities\(\)/);
 assert.match(app,/saleCities,mode:refineSale/);
 assert.match(app,/filterRoyalSaleRoutes\(\[\.\.\.result\.candidates,\.\.\.refinery\.candidates\],saleCities\)/);
 assert.match(app,/marketCoverage=coverageByMarket\(ids,priceMap,\{cities:saleCities/);
 assert(!app.includes('researchPlanHtml('));
 assert(!app.includes('researchPlan:')); 
 assert.match(app,/saleCities,branch:craftCats/);
});

test('los cinco paneles solicitados están ocultos en Resultados pero las comprobaciones permanecen operativas',()=>{
 for(const selector of ['.gcp-market-audit','.gcp-market-references','.gcp-market-proof','.gcp-panel-preflight','.gcp-panel-budget','#preflight-results'])
  assert(css.includes('.gcp-results '+selector), selector);
 assert.match(css,/display:none !important/);
 assert.match(app,/data-action="preflight"/);
 assert.match(app,/Lista de fabricación/);
 assert.match(app,/Lista de compras/);
});
