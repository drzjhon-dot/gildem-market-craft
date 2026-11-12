import test from 'node:test';
import assert from 'node:assert/strict';
import {walkBids,walkAsks,loadOrderbook,bookEntry,offersAnyQuality} from '../src/orderbook.js';
import {grossSale} from '../src/portfolio-engine.js';
import {buildCandidates,allocatePlan,DEFAULTS} from '../src/planner.js';
import {purchaseAssessment} from '../src/economics.js';
import {batchCalculate} from '../src/batch-calculator.js';
const T=Date.parse('2026-11-12T12:00:00Z'),fresh=T-3600e3,sec=Math.round((T-2*3600e3)/1000);
const Q=(entries)=>new Map(entries.map(([id,city,ask,bid])=>[id+'|'+city,{id,city,...(ask?{ask:{price:ask,time:fresh}}:{}),...(bid?{bid:{price:bid,time:fresh}}:{})}]));
const cfg=x=>({...DEFAULTS,goal:'silver',purchaseMode:'craft-city',diversify:false,stressGuard:false,minRoiPct:0,journalProfit:false,...x});
const OB=(books)=>({available:true,books:new Map(Object.entries(books)),meta:{generatedAt:new Date(T).toISOString()}});

test('v2.6 libro: recorrer pujas y ofertas',()=>{
 assert.deepEqual(walkBids([[100,2],[90,3]],4),{units:4,revenue:2*100+2*90,remaining:0});
 assert.equal(walkBids([[100,2],[90,3]],4,95).revenue,2*95+2*90,'nunca por encima del precio de planificación');
 const a=walkAsks([[10,5],[12,5]],8);assert.equal(a.cost,5*10+3*12);assert.equal(a.remaining,0);
 assert.equal(walkAsks([[10,5]],8).remaining,3);
});
test('v2.6 venta al Mercado Negro: pujas reales primero, después el modelo de impacto',()=>{
 const r={planningPrice:100,history:{quality1DailyUnits:100},bookBids:[[100,2],[80,2]]};
 const s=grossSale(r,6,{saleDays:7});
 const rest=100*2*(1-Math.min(.33,2/700*.75));
 assert(Math.abs(s.gross-(200+160+rest))<1e-9);assert.equal(s.bookUnits,4);
 assert(grossSale({planningPrice:100,history:{quality1DailyUnits:100}},6,{saleDays:7}).gross>s.gross,'pujas bajas reducen el ingreso');
});
test('v2.6 libro en entradas: se ignoran las de más de 24 h; competencia de cualquier calidad',()=>{
 const ob=OB({'X|Black Market|1':{r:[[5,1]],s:sec},'Y|Black Market|1':{r:[[5,1]],s:sec-30*3600},'Z|Lymhurst|1':{o:[[50,3]],s:sec},'Z|Lymhurst|2':{o:[[40,2]],s:sec}});
 assert(bookEntry(ob,'X','Black Market',1,T));assert.equal(bookEntry(ob,'Y','Black Market',1,T),null);
 assert.deepEqual(offersAnyQuality(ob,'Z','Lymhurst',T),[[40,2],[50,3]]);
});
const recipes={T6_MAIN_MACE:{city:'Martlock',amountCrafted:1,materials:[{id:'T6_METALBAR',count:16},{id:'T6_CLOTH',count:8}]}};
const quotes=Q([['T6_METALBAR','Martlock',2500],['T6_CLOTH','Martlock',2600],['T6_MAIN_MACE','Black Market',0,70000],['T6_MAIN_MACE','Lymhurst',72000]]);
const hist=(city,daily)=>({id:'T6_MAIN_MACE',city,days:7,quality1DailyUnits:daily,quality1ActiveDays:7,quality1AveragePrice:71000});
test('v2.6 Planner: pujas rentables del Mercado Negro amplían el lote; sin libro, se usa la estimación',()=>{
 const base=buildCandidates({top:[hist('Black Market',2)],recipes,quotes,config:cfg({}),selectedMarkets:['Black Market'],now:T}).candidates[0];
 const ob=OB({'T6_MAIN_MACE|Black Market|1':{r:[[70000,20],[40000,50]],s:sec,f:{r:9,o:0,d:3}}});
 const withBook=buildCandidates({top:[hist('Black Market',2)],recipes,quotes,config:cfg({}),selectedMarkets:['Black Market'],orderbook:ob,now:T}).candidates[0];
 assert(withBook.maxCrafts>base.maxCrafts,`${withBook.maxCrafts} > ${base.maxCrafts}`);
 assert.equal(withBook.maxCrafts,16,'Equilibrado: 80 % de las 20 pujas por encima del equilibrio; las de 40.000 no son rentables');
 const prudent=buildCandidates({top:[hist('Black Market',2)],recipes,quotes,config:cfg({style:'prudent'}),selectedMarkets:['Black Market'],orderbook:ob,now:T}).candidates[0];
 assert.equal(prudent.maxCrafts,10,'Prudente: 50 %');
 assert.deepEqual(withBook.bookFills,{r:9,o:0,d:3});
 const plan=allocatePlan({candidates:[withBook],config:cfg({budget:5e6,useBudget:true,maxCapitalSharePct:100,style:'dynamic'})});
 assert(plan.rows[0].totalProfit>0);assert(plan.rows[0].bookUnitsSold>0);
});
test('v2.6 Planner: la competencia publicada en una ciudad Royal reduce o bloquea el lote',()=>{
 const c=cfg({style:'dynamic'});
 const free=buildCandidates({top:[hist('Lymhurst',10)],recipes,quotes,config:c,selectedMarkets:['Lymhurst'],orderbook:OB({}),now:T}).candidates[0];
 const some=buildCandidates({top:[hist('Lymhurst',10)],recipes,quotes,config:c,selectedMarkets:['Lymhurst'],orderbook:OB({'T6_MAIN_MACE|Lymhurst|1':{o:[[71000,30]],s:sec}}),now:T}).candidates[0];
 assert(some.maxCrafts<free.maxCrafts);assert.equal(some.competitionUnits,30);
 const blocked=buildCandidates({top:[hist('Lymhurst',10)],recipes,quotes,config:c,selectedMarkets:['Lymhurst'],orderbook:OB({'T6_MAIN_MACE|Lymhurst|1':{o:[[60000,500]],s:sec}}),now:T});
 assert.equal(blocked.candidates.length,0);assert.match(blocked.rejectedSamples[0].reason,/Competencia/);
});
test('v2.6 compras: con libro, coste exacto recorriendo ofertas',()=>{
 const a=purchaseAssessment({buy:800,unitPrice:2500,history:{averageDailyUnits:100,averageUnitPrice:2500},book:[[2500,300],[2600,300],[2800,1000]],now:T});
 assert.equal(a.book.covered,800);assert.equal(a.level,'ok');assert.equal(a.extraCost,300*100+200*300);
 const b=purchaseAssessment({buy:800,unitPrice:2500,history:{averageDailyUnits:100,averageUnitPrice:2500},book:[[2500,300]],now:T});
 assert.equal(b.book.remaining,500);assert(b.extraCost>0);assert.notEqual(b.level,'ok');
});
test('v2.6 carga del resumen publicado por el recolector',async()=>{
 const files={'/orderbook.config.json':{base:'https://raw.example/ob'},'https://raw.example/ob/ob/meta.json':{generatedAt:new Date(T-3600e3).toISOString(),shards:{T6:1}},
  'https://raw.example/ob/ob/T6.json':{'T6_MAIN_MACE|Black Market|1':{r:[[70000,3]],s:sec}}};
 const fetcher=async url=>({ok:!!files[url],status:files[url]?200:404,json:async()=>files[url]});
 const ob=await loadOrderbook(['T6_MAIN_MACE','T4_BAG'],{fetcher,now:T});
 assert(ob.available);assert.equal(Math.round(ob.ageHours),1);assert.deepEqual(bookEntry(ob,'T6_MAIN_MACE','Black Market',1,T).r,[[70000,3]]);
});
test('v2.6 Calculadora: profit del Mercado Negro con pujas reales',()=>{
 const ob=OB({'T6_MAIN_MACE|Black Market|1':{r:[[70000,1],[50000,10]],s:sec}});
 const without=batchCalculate({items:[{id:'T6_MAIN_MACE',qty:4}],recipes,quotes,config:cfg({}),now:T});
 const withBook=batchCalculate({items:[{id:'T6_MAIN_MACE',qty:4}],recipes,quotes,config:cfg({}),orderbook:ob,now:T});
 assert.equal(withBook.rows[0].bmBookUnits,4);assert(withBook.rows[0].profitBM<without.rows[0].profitBM);
});

import {githubRawBase,orderbookConfig} from '../scripts/orderbook-config.mjs';
test('v2.6 compilación: dirección del resumen a partir del repositorio',()=>{
 assert.equal(githubRawBase('https://github.com/drz/gildem'),'https://raw.githubusercontent.com/drz/gildem/orderbook-data');
 assert.equal(githubRawBase('git@github.com:drz/gildem.git'),'https://raw.githubusercontent.com/drz/gildem/orderbook-data');
 assert.deepEqual(orderbookConfig({env:{}}),{});
 assert.equal(orderbookConfig({fileConfig:{repo:'a/b'},env:{REPOSITORY_URL:'https://github.com/x/y'}}).base,'https://raw.githubusercontent.com/a/b/orderbook-data');
 assert.equal(orderbookConfig({env:{REPOSITORY_URL:'https://github.com/x/y'}}).source,'REPOSITORY_URL (Netlify)');
});
