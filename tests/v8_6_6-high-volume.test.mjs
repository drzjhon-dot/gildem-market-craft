import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bulkMarketCandidates,observedWeeklyActivity,MIN_WEEKLY_ACTIVITY,bulkItemExposureFraction,portfolioFillSummary} from '../core/high-volume.js';
import {allocatePortfolioV6} from '../core/allocator-v6.js';
import {investmentBudget,validateIntelligentEdits} from '../core/intelligent-portfolio.js';
import {listingCapacity} from '../core/demand-first.js';
const route=(i,opts={})=>({id:`T${4+i%4}_SHOES_PLATE_SET${i}`,city:'Black Market',craftCity:'Martlock',mode:'listed',
 cost:40000,capitalPerUnit:50000,profit:8500,stressProfit:3900,sell:60000,
 activity:{observations:14,count:1200,observedDaily:85,activeDays:14},
 activity7:{observations:7,count:560,observedDaily:80,activeDays:7},
 demandDaily:85,ageHours:2,confidence:{score:85},competition:{known:false,penalty:.92},craftAmount:1,
 ...opts});

test('umbral >50 por semana: admite rotación de volumen; excluye objetos sin actividad o estrés positivo',()=>{
 const data=[route(0,{activity7:{observations:7,count:51}}),route(1,{activity7:{observations:7,count:50}}),
  route(2,{activity7:{observations:7,count:1},profit:220000}),route(3,{stressProfit:-1}),
  route(4,{demandDaily:null,activity7:{observations:0},activity:{observations:0}})];
 const out=bulkMarketCandidates(data);
 assert.equal(MIN_WEEKLY_ACTIVITY,50);
 assert.deepEqual(out.accepted.map(x=>x.id),[data[0].id]);
 assert.equal(out.rejected.length,4);
 assert.equal(out.accepted[0].weeklyObserved,51);
});

test('actividad semanal usa siete días recientes y mantiene importación West como señal provisional',()=>{
 const recent=observedWeeklyActivity(route(0,{demandDaily:500,activity7:{observations:7,count:60}}));
 assert.equal(recent.units,60);
 const external=observedWeeklyActivity(route(1,{externalDemand:true,demandDaily:100,demandSource:'Hub · West confirmado'}));
 assert.equal(external.units,700);
 assert.equal(external.provisional,true);
 const backup=observedWeeklyActivity(route(2,{activity7:{observations:0},demandDaily:12}));
 assert.equal(backup.units,84);
 assert.equal(observedWeeklyActivity(route(3,{activity7:{observations:0},demandDaily:null,activity:{observations:0}})),null);
});

test('sin reserva, más rutas y beneficio positivo permiten asignar casi todo un presupuesto de 10M',()=>{
 const raw=Array.from({length:32},(_,i)=>route(i,{city:i%2?'Martlock':'Black Market'}));
 const screened=bulkMarketCandidates(raw).accepted;
 const budget=investmentBudget(10_000_000);
 assert.equal(budget.spendable,10_000_000);
 const r=allocatePortfolioV6(screened,budget.spendable,{intelligent:true,bulkMode:true,useAll:true,
  maxPerItemFraction:bulkItemExposureFraction(screened),maxVariants:65,targetDifferentItems:28,
  capFraction:.10,horizonDays:14});
 assert(r.rows.length>=18,`rutas: ${r.rows.length}`);
 assert(r.totalCost>=9_300_000,`inversión insuficiente: ${r.totalCost}`);
 assert(r.totalCost<=10_000_000);
 assert(r.totalProfit>0);
 assert(r.rows.every(x=>x.qty>0&&x.totalProfit>0));
 assert(portfolioFillSummary({totalCost:r.totalCost},10_000_000).percent>=93);
});

test('con solo 3 objetos activos permite lotes considerables sin saltarse exposición ni saturación',()=>{
 const routes=[route(0),route(1),route(2)];
 const fraction=bulkItemExposureFraction(routes);
 assert.equal(fraction,.38);
 const r=allocatePortfolioV6(routes,3_000_000,{intelligent:true,bulkMode:true,useAll:true,
  maxPerItemFraction:fraction,maxVariants:65,targetDifferentItems:28,capFraction:.15,horizonDays:14});
 assert(r.totalCost>2_500_000,`inversión: ${r.totalCost}`);
 assert(r.rows.every(x=>x.qty*x.capitalPerUnit<=3_000_000*fraction+1e-7));
});

test('poca rotación y pocos objetos: deja dinero sin invertir, no fabrica para quemarlo',()=>{
 const one=route(0,{activity7:{observations:5,count:56},demandDaily:8});
 const qty=listingCapacity(one,{horizonDays:14,share:.10});
 assert(qty<=16,'debe ser una fracción de la actividad observada');
 const r=allocatePortfolioV6(bulkMarketCandidates([one]).accepted,10_000_000,{intelligent:true,bulkMode:true,useAll:true,
  maxPerItemFraction:.50,capFraction:.10,horizonDays:14,maxVariants:65});
 assert(r.totalCost<1_000_000);
 assert(r.remaining>9_000_000);
 const bad=bulkMarketCandidates([route(1,{activity7:{observations:7,count:2}})]);
 assert.equal(bad.accepted.length,0);
});

test('edición posterior respeta los mismos topes de producción de volumen',()=>{
 const rows=[{id:'T4_A',city:'Martlock',qty:50,capitalPerUnit:1000},
             {id:'T5_B',city:'Thetford',qty:50,capitalPerUnit:1000},
             {id:'T6_C',city:'Thetford',qty:50,capitalPerUnit:1000}];
 assert(validateIntelligentEdits(rows,150000,{itemFraction:.34,bulkMode:true}).ok);
 assert(!validateIntelligentEdits([{...rows[0],qty:120}],150000,{itemFraction:.34,bulkMode:true}).ok);
 assert(!validateIntelligentEdits([{...rows[0],qty:151}],150000,{itemFraction:.50,bulkMode:true}).ok);
});

test('UI elimina el checkbox 15%; usa todo no tiene parada de 10 productos; resultados enseñan porcentaje invertido',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert(!app.includes('qc-reserve'));
 assert(!app.includes('Reservar 15%'));
 assert(app.includes("reservePercent:0"));
 assert(app.includes('maxVariants:80'));
 assert(app.includes("invest:autoPrefs.invest||'all'"));
 assert(!app.includes('safeUnits>=10'));
 assert(app.includes('patientFunds>safeFunds*1.15'));
 assert(app.includes('current.fill?.percent'));
 assert(app.includes('bulkMarketCandidates(eligible'));
});
