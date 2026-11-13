import test from 'node:test';
import assert from 'node:assert/strict';
import {allocatePortfolioV6,capacityFor} from '../core/allocator-v6.js';
import {normalizeSellBook,listingPressure} from '../core/competition.js';
import {cashPosition,startPortfolio,adjustWallet} from '../core/cashflow.js';
import {verifyPlannedPrices,breakEvenPrice} from '../core/verify.js';

const now=Date.now(),stamp=new Date(now-360000).toISOString();
const base={id:'T4_MAIN_AXE',city:'Black Market',craftCity:'Martlock',mode:'instant',cost:600,capitalPerUnit:1100,sell:1400,profit:600,
 returnRate:30,confidence:{score:86},activity:{observations:12,observedDaily:15},focusPerUnit:100,focusGain:200,stationCost:0,
 saleTaxPercent:4,taxRate:.04,setupRate:0,transportCost:0,rawMaterials:1000,
 materials:[{id:'T4_METALBAR',city:'Martlock',count:10,used:7,unitPrice:100,at:now,ret:true}],
 journal:null,journalBonus:0,buyMode:'instant',qualityMode:'normal',craftAmount:1,depthVerified:false};
function candidate(p={}){return {...base,...p};}

test('v6 conserva presupuesto, focus y topes de demanda incluso repartiendo mercados',()=>{
 const rows=[candidate({id:'T4_MAIN_AXE',city:'Black Market',profit:220,capitalPerUnit:1200,marketCapacity:2,depthVerified:true}),
   candidate({id:'T4_2H_AXE',city:'Martlock',profit:200,capitalPerUnit:1100}),
   candidate({id:'T4_2H_AXE',city:'Lymhurst',profit:170,capitalPerUnit:1100})];
 const a=allocatePortfolioV6(rows,5500,{useAll:true,focusLimit:300,capFraction:1,ensureBothMarkets:true});
 assert.ok(a.totalCost<=5500);assert.ok(a.focusUsed<=300);assert.ok(a.rows.some(x=>x.city==='Black Market'));assert.ok(a.rows.some(x=>x.city!=='Black Market'));
 assert.equal(a.totalCost,a.rows.reduce((s,r)=>s+r.qty*r.capitalPerUnit,0));
});
test('v6 no duplica libros de orden al comparar ciudades de fabricación',()=>{
 const x=candidate({marketCapacity:3,depthVerified:true});
 const a=allocatePortfolioV6([x,{...x,craftCity:'Caerleon',profit:500}],1e7,{useAll:true,unknownCap:4,capFraction:1});
 assert.equal(a.rows.length,1);assert.equal(a.rows[0].qty,3);
});
test('v8.6.2 admite un craft prudente de venta lenta, y BM instant requiere libro comprobado',()=>{
 assert.equal(capacityFor(candidate({activity:{observations:8,observedDaily:0.1},city:'Lymhurst',mode:'listed'}),.1,2),1);
 assert.equal(capacityFor(candidate({activity:null,city:'Black Market',mode:'instant'}),.1,2),0);
});
test('v6 competencia Royal cuenta solo órdenes al mismo precio o inferior',()=>{
 const raw=[{item_id:'T4_MAIN_AXE',city:'Martlock',quality:1,sell_orders:[{price:1000,amount:12,updated_at:stamp},{price:1100,amount:9,updated_at:stamp},{price:2000,amount:80,updated_at:stamp}]}];
 const book=normalizeSellBook(raw,['T4_MAIN_AXE'],['Martlock'],24,now);
 const x=listingPressure(book.get('T4_MAIN_AXE|Martlock'),1100);
 assert.equal(x.unitsAhead,21);assert.equal(x.risk,'competencia media');
 assert.equal(listingPressure(undefined,1000).known,false);
});
test('v6 caja descuenta solo compras confirmadas y suma cobros netos',()=>{
 const p={id:'a',started:false,lots:[{qty:5,capitalPerUnit:1000,sales:[{qty:2,price:1500,fees:120,transport:50}]}]};
 const wallet={initial:6000,adjustments:[]};
 assert.equal(cashPosition(wallet,[p]).available,6000);
 const started=startPortfolio([p],'a',wallet);
 assert.equal(cashPosition(wallet,started).available,6000-5000+3000-120-50);
 assert.equal(cashPosition(wallet,started).unsoldGross,3000);
 assert.throws(()=>startPortfolio([p],'a',{initial:4000,adjustments:[]}),/Capital insuficiente/);
 assert.equal(cashPosition(adjustWallet(wallet,900,'deposito'),[]).available,6900);
});
test('v6 preflight reprices sale and materials with fresh quotes and rejects lost margins',()=>{
 const rows=[candidate({id:'T4_MAIN_AXE',city:'Martlock',mode:'listed',saleTaxPercent:4,taxRate:.04,setupRate:.025,profit:400,capitalPerUnit:1000,qty:1,maxCrafts:2,
  materials:[{id:'T4_METALBAR',city:'Martlock',count:10,used:7,unitPrice:100,at:now,ret:true}],sell:1500,rawMaterials:1000,allocation:1000,totalProfit:400,depthVerified:false})];
 const prices=(price)=>[
  {item_id:'T4_MAIN_AXE',city:'Martlock',quality:1,sell_price_min:price,sell_price_min_date:stamp,buy_price_max:1100,buy_price_max_date:stamp},
  {item_id:'T4_METALBAR',city:'Martlock',quality:1,sell_price_min:100,sell_price_min_date:stamp,buy_price_max:80,buy_price_max_date:stamp}];
 const good=verifyPlannedPrices(rows,prices(1700),{budget:10000,maxAgeHours:24});
 assert.equal(good.ok,true);assert.ok(good.newTotal>0);
 const bad=verifyPlannedPrices(rows,prices(400),{budget:10000,maxAgeHours:24});
 assert.equal(bad.ok,false);assert.ok(bad.blockers.some(s=>s.includes('margen cayó')));
 assert.ok(breakEvenPrice(rows[0])>0);
});
test('v6 rechaza presupuestos y ordenes por encima del capital inicial',()=>{
 const p={id:'b',lots:[{qty:2,capitalPerUnit:2000,sales:[]}]};
 const w={initial:3500,adjustments:[]};
 assert.throws(()=>startPortfolio([p],'b',w),/Capital insuficiente/);
 const full=startPortfolio([p],'b',{initial:6000,adjustments:[]});
 assert.equal(cashPosition({initial:6000,adjustments:[]},full).available,2000);
});
