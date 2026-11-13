import test from 'node:test';
import assert from 'node:assert/strict';
import {rowMap} from '../core/engine.js';
import {marketQuoteSignals,attachMarketIntelligence,evaluateListingSpread} from '../core/market-intelligence.js';
import {historyMetrics} from '../core/optimizer.js';
import {evaluateCraftViability} from '../core/viability.js';
import {readFileSync} from 'node:fs';
const t=new Date(Date.now()-60000).toISOString();
const map=rowMap([{item_id:'T6_SHOES_LEATHER_SET2',city:'Lymhurst',quality:1,sell_price_min:100000,sell_price_min_date:t,buy_price_max:20000,buy_price_max_date:t}]);
const route={id:'T6_SHOES_LEATHER_SET2',city:'Lymhurst',craftCity:'Martlock',mode:'listed',sell:100000,profit:25000,stressProfit:15000,capitalPerUnit:65000,cost:70000,ageHours:1,activity:{activeDays:8,observations:12,observedDaily:15,medianPrice:90000,avgPrice:90000},competition:{known:true,unitsAhead:2},confidence:{score:85},craftAmount:1,stationCost:1000,transportCost:1000,materials:[],saleTaxPercent:4,setupRate:.025};
test('price signals distinguish quick sell from posting; keep timestamps',()=>{
 const s=marketQuoteSignals(map,route.id,route.city,24);
 assert.equal(s.bid,20000);assert.equal(s.ask,100000);assert.equal(s.spreadPercent,80);
 assert(s.askAgeHours>=0);assert(s.bidAt>0);
 const copy=structuredClone(route);attachMarketIntelligence([copy],map,24);
 assert.equal(copy.marketSignals.spreadPercent,80);
});
test('illiquid expensive listing rejected in crafting, Royal and leveling',()=>{
 const r=structuredClone(route);attachMarketIntelligence([r],map,24);
 assert.equal(evaluateListingSpread(r).ok,false);
 assert(evaluateCraftViability(r,{budget:500000,mode:'royal'}).reasons.includes('diferencial Royal demasiado grande entre publicar y vender ahora'));
 assert(evaluateCraftViability(r,{budget:500000,mode:'level'}).ok===false);
});
test('verified personal execution may override spread warning, not overall economics',()=>{
 const r=structuredClone(route);r.personalLearning={qtySold:5};attachMarketIntelligence([r],map,24);
 assert.equal(evaluateListingSpread(r,{strict:true}).ok,true);
});
test('median of daily history resists one extreme quote',()=>{
 const now=new Date('2026-11-09T13:00:00Z').getTime();
 const records=[100,110,120,115,10000].map((price,i)=>({timestamp:new Date(Date.UTC(2026,10,3+i,12)).toISOString(),item_count:10,avg_price:price}));
 const h=historyMetrics(records,14,now);
 assert.equal(h.medianPrice,115);assert(h.avgPrice>1000);assert.equal(h.priceDays,5);assert.equal(h.isSalesData,false);
});
test('stale quote never treated as current sell/buy',()=>{
 const old=new Date(Date.now()-72*3600000).toISOString();
 const stale=rowMap([{item_id:route.id,city:route.city,quality:1,sell_price_min:200000,sell_price_min_date:old,buy_price_max:120000,buy_price_max_date:old}]);
 const s=marketQuoteSignals(stale,route.id,route.city,24);assert.equal(s.bid,null);assert.equal(s.ask,null);
});
test('all three planning pages attach independent market signals',()=>{
 const a=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert(a.includes('attachMarketIntelligence(routes,levelPriceMap,prefs.maxAge)'));
 assert(a.includes('attachMarketIntelligence(candidates,priceMap,prefs.maxAge)'));
 assert(a.includes('attachMarketIntelligence(candidates,map,prefs.maxAge)'));
 assert(a.includes('Verificar señales del mercado'));
});

import {chooseCraftingCities} from '../core/city-consolidation.js';
test('one-city consolidation keeps only the strongest viable production city',()=>{
 const routes=[
 {id:'A',craftCity:'Martlock',city:'Lymhurst',profit:200,capitalPerUnit:1000,marketCapacity:2},
 {id:'B',craftCity:'Martlock',city:'Thetford',profit:100,capitalPerUnit:500,marketCapacity:5},
 {id:'C',craftCity:'Fort Sterling',city:'Lymhurst',profit:300,capitalPerUnit:1500,marketCapacity:1},
 ];
 const one=chooseCraftingCities(routes,{maxCities:1,budget:100000});
 assert.deepEqual(one.cities,['Martlock']);assert.equal(one.routes.length,2);
 const two=chooseCraftingCities(routes,{maxCities:2,budget:100000});
 assert.equal(two.routes.length,3);
 assert.equal(chooseCraftingCities(routes,{maxCities:'all',budget:100000}).routes.length,3);
});
test('consolidation cannot recreate a route with no market capacity',()=>{
 const routes=[{id:'A',craftCity:'Martlock',profit:9000,capitalPerUnit:50000,marketCapacity:0},
 {id:'B',craftCity:'Lymhurst',profit:300,capitalPerUnit:2000,marketCapacity:8}];
 const r=chooseCraftingCities(routes,{maxCities:1,budget:50000});
 assert.deepEqual(r.cities,['Lymhurst']);assert.deepEqual(r.routes.map(x=>x.id),['B']);
});
test('Royal Craft exposes a real city limit persisted in scan configuration',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert(app.includes("'auto-max-cities'"));
 assert(app.includes('chooseCraftingCities(strictRoutes,{maxCities:maxCraftCities,budget})')&&app.includes('chooseCraftingCities(selected,{maxCities:maxCraftCities,budget})'));
 assert(app.includes('idFilter:id=>qcVariantIncluded('));
 assert(app.includes('craftCities:cityChoice.cities'));
});

test('Royal routes without an orderbook cap use historical activity for city selection',()=>{
 const routes=[{id:'A',craftCity:'Martlock',profit:1000,capitalPerUnit:10000,marketCapacity:null,activity:{observations:12,observedDaily:80}},
 {id:'B',craftCity:'Lymhurst',profit:200,capitalPerUnit:10000,marketCapacity:null,activity:{observations:12,observedDaily:20}}];
 const choice=chooseCraftingCities(routes,{maxCities:1,budget:200000});
 assert.deepEqual(choice.cities,['Martlock']);assert.equal(choice.routes.length,1);
});
