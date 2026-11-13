import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeOrderbook,executeLevels,profitableBookCapacity,enrichWithDepth,routeProfitAtQuantity} from '../core/depth.js';
import {journalInfo,journalSummary} from '../core/journals.js';
import {rebuildPlan,fitPlan} from '../core/plan.js';
import {allocateSmartPortfolio} from '../core/optimizer.js';
const now=Date.now();const stamp=new Date(now-60000).toISOString();
const row=(id,city,opts={})=>({id,city,craftCity:'Martlock',profit:3000,cost:1500,capitalPerUnit:1800,returnRate:30,
 focusPerUnit:0,activity:{observations:12,observedDaily:100,coverage:.8},confidence:{score:80,label:'Alta'},
 mode:'instant',sell:5000,saleTaxPercent:2.5,materials:[{id:'T4_METALBAR',city:'Martlock',count:8,used:5.6,unitPrice:200}],
 qty:1, ...opts});
const fakeLevels=(amount=10)=>[{item_id:'T4_SHOES_PLATE_SET1',city:'Black Market',quality:1,buy_orders:[{amount,price:5000,updated_at:stamp},{amount:5,price:4000,updated_at:stamp}]}];
test('mercado: normaliza niveles, ordena y evita cantidades sin profundidad',()=>{
 const map=normalizeOrderbook(fakeLevels(),['T4_SHOES_PLATE_SET1'],['Black Market'],24,now);
 const levels=map.get('T4_SHOES_PLATE_SET1|Black Market');
 assert.equal(levels.length,2);assert.equal(levels[0].amount,10);
 assert.equal(executeLevels(levels,12,2.5).gross,10*5000+2*4000);
 assert.equal(executeLevels(levels,16,2.5).complete,false);
 assert.equal(profitableBookCapacity(levels,{costPerItem:4500,taxPercent:2.5}),10);
});
test('mercado: rechaza órdenes sin fecha o antiguas, no finge 50 ventas',()=>{
 const raw=[{item_id:'T4_SHOES_PLATE_SET1',city:'Black Market',quality:1,buy_orders:[{amount:40,price:5000},{amount:10,price:4500,updated_at:new Date(now-72*3600000).toISOString()}]}];
 assert.equal(normalizeOrderbook(raw,['T4_SHOES_PLATE_SET1'],['Black Market'],24,now).size,0);
 const capped=enrichWithDepth(row('T4_SHOES_PLATE_SET1','Black Market'),null);
 assert.equal(capped.marketCapacity,1);assert.equal(capped.depthVerified,false);
});
test('mercado: profit de lote sigue precios decrecientes y topes',()=>{
 const levels=normalizeOrderbook(fakeLevels(),['T4_SHOES_PLATE_SET1'],['Black Market'],24,now).get('T4_SHOES_PLATE_SET1|Black Market');
 const enriched=enrichWithDepth(row('T4_SHOES_PLATE_SET1','Black Market'),levels);
 assert.equal(enriched.marketCapacity,15);
 assert.ok(routeProfitAtQuantity(enriched,12)<12*enriched.profit);
 assert.equal(routeProfitAtQuantity(enriched,16),null);
});
test('diarios: clasificación por profesión y agrupación de dos recetas',()=>{
 const id='T4_SHOES_PLATE_SET1';
 const recipe={materials:[{id:'T4_METALBAR',count:8,ret:true}]};
 const j=journalInfo(id,recipe,'boots_plate',null);
 assert.equal(j.code,'WARRIOR');assert.equal(j.exact,false);assert.ok(j.ratio>0);
 const j2=journalInfo('T4_SHOES_PLATE_SET2',recipe,'boots_plate',null);
 const totals=journalSummary([{id,qty:10,journal:j},{id:'T4_SHOES_PLATE_SET2',qty:20,journal:j2}]);
 assert.equal(totals.items.length,1);assert.equal(totals.items[0].crafts,30);
 assert.equal(totals.items[0].qty,Math.ceil((j.ratio*30)-1e-9));
});
test('diarios: usa correspondencia exacta del dump cuando existe',()=>{
 const j=journalInfo('T5_SHOES_PLATE_SET1',{},'boots_plate',{journal:'T5_JOURNAL_WARRIOR',max:7200,per:900});
 assert.equal(j.exact,true);assert.equal(j.ratio,.125);assert.equal(j.empty,'T5_JOURNAL_WARRIOR_EMPTY');
});
test('presupuesto único: BM y Royal comparten materiales sin duplicar cada unidad',()=>{
 const bm=row('T4_SHOES_PLATE_SET1','Black Market',{qty:3});
 const royal=row('T4_SHOES_PLATE_SET1','Lymhurst',{qty:2});
 const p=rebuildPlan([bm,royal],20000);
 assert.equal(p.ok,true);assert.equal(p.rows.length,2);
 assert.equal(p.totalCost,9000);assert.equal(p.materials[0].qtyGross,8*5);
 assert.equal(p.cities.reduce((s,c)=>s+c.qty,0),5);assert.equal(p.totalProfit,15000);
});
test('presupuesto: rechaza cantidad excesiva y Focus duplicado',()=>{
 assert.equal(rebuildPlan([row('A','Black Market',{qty:7})],10000).ok,false);
 assert.equal(rebuildPlan([row('A','Black Market',{qty:3,focusPerUnit:300})],10000,500).ok,false);
 assert.equal(rebuildPlan([row('A','Black Market',{qty:3,marketCapacity:2,maxCrafts:2})],10000).ok,false);
});
test('diarios: reservar diarios completos reduce capital y profit, sin vender parciales',()=>{
 const journal={empty:'T4_JOURNAL_WARRIOR_EMPTY',full:'T4_JOURNAL_WARRIOR_FULL',tier:4,code:'WARRIOR',name:'Diario herrero',ratio:.2,price:2000,fullPrice:6000,fullTaxRate:4};
 const r=row('T4_SHOES_PLATE_SET1','Black Market',{qty:1,profit:3800,capitalPerUnit:2000,journal});
 const p=rebuildPlan([r],6000);
 assert.equal(p.ok,true);assert.equal(p.journalSummary.items[0].qty,1);
 assert.equal(p.journalSummary.items[0].full,0);
 assert.equal(p.totalCost,3600);
 // Reference profit includes fractional full-journal revenue, which must be removed.
 assert.ok(p.totalProfit<r.profit);
});
test('ajuste: un plan demasiado grande se reduce hasta caber',()=>{
 const p=fitPlan([row('A','Black Market',{qty:4}),row('B','Lymhurst',{qty:4})],5500);
 assert.equal(p.ok,true);assert.ok(p.totalCost<=5500);assert.ok(p.rows.reduce((s,r)=>s+r.qty,0)<=3);
});
test('optimizador: no recomienda mayor volumen BM que el libro observado',()=>{
 const bm=row('T4_SHOES_PLATE_SET1','Black Market',{marketCapacity:3});
 const result=allocateSmartPortfolio([bm],20000,{goal:'profit',useAll:true,capFraction:.3,unknownCap:2});
 assert.equal(result.rows[0].qty,3);
});
