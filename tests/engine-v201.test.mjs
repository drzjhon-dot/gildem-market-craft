import test from 'node:test';
import assert from 'node:assert/strict';
import {purchaseNeeded,DEFAULTS} from '../src/planner.js';
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
