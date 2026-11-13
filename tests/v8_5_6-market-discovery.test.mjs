import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rowMap} from '../core/engine.js';
import {coverageByMarket,diagnoseScan,marketResearchIds,marketAuditIds} from '../core/market-discovery.js';
import {selectUniversalRecipes,createUniversalCandidates} from '../core/opportunity-scan.js';
import {limitRowsByMaterialBook} from '../core/procurement-liquidity.js';
import {filterViableCraftRoutes} from '../core/viability.js';

const now=new Date(Date.now()-120_000).toISOString();
const q=(id,city,ask,bid)=>({item_id:id,city,quality:1,sell_price_min:ask,sell_price_min_date:now,buy_price_max:bid,buy_price_max_date:now});
const crafted='T5_MAIN_AXE',metal='T5_METALBAR';
const recipes={[crafted]:{city:'Martlock',materials:[{id:metal,count:8,ret:true}],amountCrafted:1}};
const map=rowMap([q(crafted,'Martlock',3200,2800),q(crafted,'Thetford',4200,3550),q(metal,'Thetford',110,98),q(metal,'Martlock',140,130)]);
const inputs={market:'royal',cities:['Martlock','Thetford'],includeInstantRoyal:true,materialPurchase:'all',city:'auto',focus:false,buyMode:'instant',refiningMode:'off',daily:0,station:0,saleMode:'listed',listingFee:2.5,transport:0,materialShipping:0,bmTax:2.5,royalTax:4,riskBM:0,riskRoyal:0,priceStress:8,resourceStress:7};

test('Royal: encuentra venta inmediata y publicación en las ciudades examinadas',()=>{
 const {candidates}=createUniversalCandidates({selected:[{id:crafted,branch:'axe'}],recipes,priceMap:map,inputs});
 assert(candidates.some(x=>x.city==='Thetford'&&x.mode==='instant'));
 assert(candidates.some(x=>x.city==='Thetford'&&x.mode==='listed'));
 assert(candidates.every(x=>x.materials[0].city==='Thetford'), 'compra el metal barato en Thetford, no fuerza Martlock');
 assert(!candidates.some(x=>x.city==='Black Market'));
});
test('Pre-filtrado por tier/encantamiento antes de tomar una muestra',()=>{
 const data={};for(let e=0;e<=4;e++)for(let t=4;t<=8;t++)data[`T${t}_MAIN_AXE${e?'@'+e:''}`]={city:'Martlock',materials:[{id:metal,count:1}]};
 const branches=[{key:'axe',test:id=>id.includes('MAIN_AXE')}];
 const opts={categories:['weapons'],tierMin:4,tierMax:8,enchant:4,categoryForBranch:()=> 'weapons',branchKeys:['axe'],limit:2};
 const selected=selectUniversalRecipes(data,branches,{...opts,idFilter:id=>id.endsWith('@4')});
 assert.equal(selected.eligible,5);assert.equal(selected.scanned,2);assert(selected.chosen.every(x=>x.id.endsWith('@4')));
});
test('Actividad observada por ciudad no se inventa donde no hay historial',()=>{
 const series=[{timestamp:new Date(Date.now()-86400000).toISOString(),item_count:10,avg_price:3200}];
 const hist=new Map([[crafted+'|Martlock',series]]);
 const coverage=coverageByMarket([crafted],map,{cities:['Martlock','Thetford','Lymhurst'],history:hist,maxAge:24});
 assert.equal(coverage.markets.length,3);
 assert.equal(coverage.markets[0].activeItems,1);
 assert.equal(coverage.markets[0].observedQty14,10);
 assert.equal(coverage.markets[1].activeItems,0);
 assert.equal(coverage.markets[2].bidItems,0);
 assert.equal(coverage.markets[0].leaders[0].id,crafted);
});
test('Libro de compra compartido limita materiales para varios objetos sin usar precios superiores',()=>{
 const material={id:metal,city:'Thetford',count:10,originalPrice:100,unitPrice:100};
 const rows=[{id:'A',city:'Martlock',qty:8,profit:400,capitalPerUnit:1000,materials:[material]},{id:'B',city:'Thetford',qty:8,profit:700,capitalPerUnit:1000,materials:[material]}];
 const book=new Map([[metal+'|Thetford',[{price:100,amount:100},{price:108,amount:10000}]]]);
 const out=limitRowsByMaterialBook(rows,book,{fraction:.60});
 assert.equal(out.rows.reduce((sum,r)=>sum+r.qty,0),6); // 60 recursos al precio cotizado / 10 por fabricación
 assert.equal(out.rows.find(x=>x.id==='B').qty,6);
 assert.equal(out.rows.find(x=>x.id==='A').qty,0);
 const lost=limitRowsByMaterialBook(rows,new Map(),{unknownCraftCap:1});
 assert(lost.rows.every(x=>x.qty===1));
});
test('Selección para investigar reparte atención por tiers y encantamientos',()=>{
 const routes=[];for(let t=4;t<=8;t++)for(let e=0;e<=4;e++){
  routes.push({id:`T${t}_MAIN_AXE${e?'@'+e:''}`,profit:t===4?1000:300,capitalPerUnit:1000});
 }
 const selected=marketResearchIds(routes,{maxItems:5});
 assert.equal(selected.length,5);
 assert.equal(new Set(selected.map(x=>x.match(/^T\d/)[0])).size,5);
});
test('Diagnóstico conserva causas de rechazo y conteos de datos faltantes',()=>{
 const d=diagnoseScan({recipes:20,candidates:9,viable:{accepted:[{}],reasons:[{reason:'sin demanda',count:7}]},recommendations:0,missing:{sale:10,material:2}});
 assert.equal(d.missingSales,10);assert.equal(d.viable,1);assert.equal(d.reasons[0].reason,'sin demanda');
});
test('Nuevo escáner protege el margen y conserva el filtro de seguridad del motor',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert(app.includes("includeInstantRoyal:false"));assert(app.includes("materialPurchase:'all'"));
 assert(app.includes('marketCoverageHtml(p)'));
 assert(app.includes('filterViableCraftRoutes(candidates,{budget,mode:'));
 assert(app.includes("<input type=\"hidden\" id=\"auto-max-cities\" value=\"all\">"));
});

test('investiga ventas observadas aunque NO haya candidatos rentables',()=>{
 const all=['T4_MAIN_AXE','T5_MAIN_AXE','T6_MAIN_AXE','T7_MAIN_AXE','T8_MAIN_AXE'];
 assert.deepEqual(new Set(marketAuditIds(all,[],{maxItems:5,maxExtra:5})),new Set(all));
 assert(marketAuditIds(all,['T5_MAIN_AXE'],{maxItems:3,maxExtra:2}).includes('T5_MAIN_AXE'));
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert(app.includes('const marketHistoryIds=chosenDemandIds(marketHistoryUniverse,deep?320:200)'));
 assert(app.includes('const marketHistoryIds=chosenDemandIds(ids,450)'));
 assert(app.includes('marketCoverage.historySample=marketHistoryIds.length'));
 assert(app.includes('marketCoverage.historyObserved='));
});
