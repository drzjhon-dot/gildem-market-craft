import test from 'node:test';
import assert from 'node:assert/strict';
import {maxCraftByDemand,purchaseNeeded,DEFAULTS,allocatePlan} from '../src/planner.js';
import {batchCalculate} from '../src/batch-calculator.js';
const T=Date.parse('2026-11-12T12:00:00Z'),fresh=T-3600e3;
const hist=(daily,active=7)=>({quality1DailyUnits:daily,quality1ActiveDays:active,days:7,averageDailyUnits:daily*3});
const cfg=x=>({...DEFAULTS,...x});

test('v2.0.1 compras: un solo craft compra la receta completa, no el neto',()=>{
 // 16 barras, retorno 24,8 %: neto 12,03. Sin las 16 no se puede fabricar ni una vez.
 assert.equal(purchaseNeeded(16,16*.752,16*.248),16);
});
test('v2.0.1 compras: el lote se puede fabricar entero en cualquier orden',()=>{
 const rr=.248,crafts=[20,16,16,20,16,20,20,16,16];
 const gross=crafts.reduce((a,b)=>a+b,0),net=crafts.reduce((a,c)=>a+c*(1-rr),0);
 const buy=purchaseNeeded(gross,net,20*rr);
 for(const order of [crafts,[...crafts].sort((a,b)=>a-b),[...crafts].sort((a,b)=>b-a)]){
  let stock=buy;for(const c of order){assert(stock>=c-1e-9,`faltan recursos: ${stock} < ${c}`);stock+=c*rr-c;}
 }
 assert(buy<gross,'el retorno sí reduce la compra');
});
test('v2.0.1 Calculadora: comprar lo indicado alcanza para un craft T8',()=>{
 const recipes={T8_MAIN_MACE:{city:'Martlock',amountCrafted:1,materials:[{id:'T8_METALBAR',count:16},{id:'T8_CLOTH',count:8}]}};
 const quotes=new Map([['T8_METALBAR|Martlock',{id:'T8_METALBAR',city:'Martlock',ask:{price:20000,time:fresh}}],
  ['T8_CLOTH|Martlock',{id:'T8_CLOTH',city:'Martlock',ask:{price:21000,time:fresh}}],
  ['T8_MAIN_MACE|Black Market',{id:'T8_MAIN_MACE',city:'Black Market',bid:{price:600000,time:fresh}}]]);
 const out=batchCalculate({items:[{id:'T8_MAIN_MACE',qty:1}],recipes,quotes,config:cfg({purchaseMode:'craft-city'}),now:T});
 const buy=Object.fromEntries(out.materials.filter(m=>!m.journal).map(m=>[m.id,m.buy]));
 assert.deepEqual(buy,{T8_CLOTH:8,T8_METALBAR:16});
});
test('v2.0.1 Calculadora: el impacto de venta usa la actividad Q1, no todas las calidades',()=>{
 const recipes={T4_MAIN_MACE:{city:'Martlock',amountCrafted:1,materials:[{id:'T4_METALBAR',count:16}]}};
 const quotes=new Map([['T4_METALBAR|Martlock',{id:'T4_METALBAR',city:'Martlock',ask:{price:200,time:fresh}}],
  ['T4_MAIN_MACE|Black Market',{id:'T4_MAIN_MACE',city:'Black Market',bid:{price:5000,time:fresh}}]]);
 const history=[{id:'T4_MAIN_MACE',city:'Black Market',quality1DailyUnits:1,averageDailyUnits:20}];
 const out=batchCalculate({items:[{id:'T4_MAIN_MACE',qty:7}],recipes,quotes,history,config:cfg({purchaseMode:'craft-city',saleDays:7}),now:T});
 assert(Math.abs(out.rows[0].impactBM-75)<1e-6||out.rows[0].impactBM===33,`impacto ${out.rows[0].impactBM}`);
});
test('v2.0.1 lotes: el estilo prudente nunca cubre más del destino que el dinámico',()=>{
 for(const daily of [.3,.6,1,2,5,9,16,40]){
  const share=style=>maxCraftByDemand(hist(daily),1,cfg({style,diversify:true}))/(daily*7);
  assert(share('prudent')<=share('balanced')+1e-9&&share('balanced')<=share('dynamic')+1e-9,`diario ${daily}`);
  assert(share('prudent')<=.12+1e-9,`prudente satura con diario ${daily}: ${share('prudent')}`);
 }
});
test('v2.0.1 lotes: Mercado Negro con 58 ventas Q1/semana no queda en lotes de 1',()=>{
 const daily=58/7;
 assert(maxCraftByDemand(hist(daily),1,cfg({style:'balanced'}))>=6);
 assert(maxCraftByDemand(hist(daily),1,cfg({style:'dynamic'}))>=13);
});
test('v2.0.1 lotes: con diversidad, el mínimo de 1 craft no se fuerza en destinos casi vacíos',()=>{
 // 3 unidades Q1 por semana: 1 craft sería 33 % de la actividad.
 assert.equal(maxCraftByDemand(hist(3/7),1,cfg({style:'balanced',diversify:true})),0);
 // 8 por semana: 1 craft (12,5 %) es aceptable en equilibrado.
 assert.equal(maxCraftByDemand(hist(8/7),1,cfg({style:'balanced',diversify:true})),1);
});
test('v2.0.1 plan: la lista de compras del Planner también alcanza para todo el lote',()=>{
 const mats=n=>[{id:'T6_METALBAR',count:n,returned:n*.248,netCount:n*.752,price:2500,landedUnitPrice:2500,transportPerUnit:0,craftCity:'Martlock',city:'Martlock'}];
 const row=(id,n,q)=>({id,city:'Black Market',routeKey:id+'|Black Market',maxCrafts:q,craftAmount:1,history:{quality1DailyUnits:100,quality1ActiveDays:7,days:7},
  grossCapitalPerCraft:n*2500,expectedCostPerCraft:n*2500*.752,materials:mats(n),planningPrice:n*2500*1.3,marketFee:0,expectedFamePerCraft:0,estimatedProfitPerCraft:1,focusPerCraft:0,qty:0});
 const out=allocatePlan({candidates:[row('T6_MAIN_MACE',16,2),row('T6_2H_MACE',20,1)],config:cfg({goal:'silver',budget:1e6,diversify:false,stressGuard:false,minRoiPct:0,maxCapitalSharePct:100,tiers:[6],enchants:[0]})});
 const bar=out.materials.find(m=>m.id==='T6_METALBAR');let stock=bar.buy;
 for(const r of out.rows)for(let i=0;i<r.qty;i++){const n=r.materials[0].count;assert(stock>=n-1e-9);stock+=r.materials[0].returned-n;}
});
