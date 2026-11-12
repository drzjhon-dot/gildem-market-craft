import test from 'node:test';import assert from 'node:assert/strict';
import {batchCalculate,variantChoices} from '../src/batch-calculator.js';
const t=Date.parse('2026-11-11T15:00:00Z');
const recipes={T6_MAIN_AXE:{city:'Martlock',amountCrafted:1,materials:[{id:'T6_METALBAR',count:12,ret:true}]},'T6_MAIN_AXE@1':{city:'Martlock',materials:[{id:'T6_METALBAR',count:12,ret:true}]},'T7_MAIN_AXE':{city:'Martlock',materials:[{id:'T6_METALBAR',count:16,ret:true}]}};
const quote=(id,city,ask,bid)=>[id+'|'+city,{id,city,ask:ask?{price:ask,time:t}:undefined,bid:bid?{price:bid,time:t}:undefined}];
const quotes=new Map([quote('T6_METALBAR','Martlock',100),quote('T6_MAIN_AXE','Black Market',0,4000),quote('T6_MAIN_AXE','Bridgewatch',5400)]);
const base={items:[{id:'T6_MAIN_AXE',qty:2}],recipes,quotes,now:t+50000,config:{bonusCity:true,dailyBonus:0,focus:false,stationFee:0,tax:4,listingFee:2.5,maxQuoteHours:48,saleDays:7,style:'balanced'}};
test('variantes conservan el objeto y cambian Tier/encantamiento solo si hay receta',()=>{
 assert.deepEqual(variantChoices(Object.keys(recipes),'T6_MAIN_AXE').sort(),['T6_MAIN_AXE','T6_MAIN_AXE@1','T7_MAIN_AXE'].sort());
});
test('calculadora por lote con compra bruta, retorno y mejor comparación BM/Royal',()=>{
 const r=batchCalculate(base);assert.equal(r.rows.length,1);assert.equal(r.rows[0].units,2);
 assert.ok(Math.abs(r.rows[0].returnPct-24.81203007518797)<.001);assert.equal(r.rows[0].capital,2400);
 assert.ok(r.rows[0].cost<2400);assert.ok(r.rows[0].profitRoyal>r.rows[0].profitBM);assert.ok(r.totals.profitBM!==null);assert.equal(r.totals.crafts,2);
 assert.ok(r.materials[0].buy<=24&&r.materials[0].buy>0);
});
test('precios manuales sustituyen cotizaciones, no compiten con precio más alto de la API',()=>{
 const r=batchCalculate({...base,overrides:{buy:{T6_METALBAR:250},sellBM:{T6_MAIN_AXE:1200},sellRoyal:{T6_MAIN_AXE:1000}}});
 assert.equal(r.rows[0].bmPrice,1200);assert.equal(r.rows[0].royalPrice,1000);assert.equal(r.rows[0].royalManual,true);
 assert.equal(r.materials[0].unitPrice,250);assert.equal(r.rows[0].profitRoyal<0,true);
});
test('sin cotización no se inventan precios ni profit',()=>{
 const r=batchCalculate({...base,quotes:new Map()});assert.equal(r.rows[0].reason.includes('Sin precios'),true);
 assert.equal(r.totals.profitBM,null);assert.equal(r.totals.profitRoyal,null);assert.equal(r.totals.capital,0);
});
test('Focus no verificado se rechaza, aunque la vista de calculadora permita activarlo',()=>{
 assert.throws(()=>batchCalculate({...base,config:{...base.config,focus:true,focusAvailable:0,focusPerCraft:0}}),/Focus activado/);
});
test('sin historial no se simula impacto; con historial sí aplica el volumen',()=>{
 const without=batchCalculate(base);
 const withHistory=batchCalculate({...base,history:[{id:'T6_MAIN_AXE',city:'Black Market',averageDailyUnits:4}]});
 assert.equal(without.rows[0].impactBM,0);assert.ok(withHistory.rows[0].impactBM>0);
 assert.ok(withHistory.rows[0].profitBM<without.rows[0].profitBM);
});

test('Focus insuficiente para la cantidad del lote se rechaza, sin descuento ficticio',()=>{
 assert.throws(()=>batchCalculate({...base,config:{...base.config,focus:true,focusPerCraft:500,focusAvailable:600}}),/Focus insuficiente/);
});
