import test from 'node:test';
import assert from 'node:assert/strict';
import {resultsSummary,budgetGroups,shoppingWithCeilings,preflightOverview,shoppingListText} from '../core/results-view.js';
const sample={budget:10000,plan:{totalCost:9000,totalProfit:1200,focusUsed:500,rows:[
 {id:'T5_MAIN_AXE',city:'Black Market',mode:'instant',qty:2,craftAmount:1,capitalPerUnit:1500,confidence:{score:80},activity:{activeDays:12},ageHours:1,depthVerified:true},
 {id:'T6_MAIN_AXE',city:'Black Market',mode:'instant',qty:1,craftAmount:2,capitalPerUnit:1500,confidence:{score:40},activity:{activeDays:5},ageHours:3,depthVerified:false}],
 materials:[{id:'T5_METALBAR',qtyGross:10,unitPrice:100,city:'Thetford'},{id:'T5_PLANKS',qtyGross:5,unitPrice:200,city:'Fort Sterling'}],
 journalSummary:{items:[{empty:'T5_JOURNAL',name:'Diario',qty:3,buyCity:'Caerleon',purchaseCost:40}]}}};
test('tarjetas KPI dependen del plan y no de cantidades de una maqueta',()=>{
 const x=resultsSummary(sample);assert.equal(x.capital,9000);assert.equal(x.profit,1200);assert.equal(x.roi,1200/9000*100);assert.equal(x.units,4);assert.equal(x.focus,500);assert.equal(x.blackTotal,2);assert.equal(x.blackVerified,1);assert.equal(x.ageHours,3);
});
test('distribución proporcional suma capital planificado',()=>{
 const groups=budgetGroups(sample,r=>r.id.includes('AXE')?'Armas':'Otros');assert.equal(groups.length,1);assert.equal(groups[0].capital,9000);
});
test('techo prudente colectivo no gasta más de 25% profit ni excede presupuesto',()=>{
 const mats=shoppingWithCeilings(sample),extra=mats.reduce((a,m)=>a+(m.suggestedCeiling-m.unitPrice)*m.qtyGross,0);assert(Math.abs(extra-300)<.00001);
 const locked={...sample,plan:{...sample.plan,totalCost:10000}};assert(shoppingWithCeilings(locked).every(m=>m.suggestedCeiling===m.unitPrice));
});
test('estado previo no se presenta como verificado',()=>{
 const s=resultsSummary(sample);assert.equal(preflightOverview(null,s).status,'pending');
 assert.equal(preflightOverview({ok:true,blockers:[],notes:[],at:'2026-11-09T10:00:00Z'},s).status,'verified');
 assert.equal(preflightOverview({ok:true,blockers:['Falta profundidad'],notes:[]},s).status,'warning');
});
test('copiar lista incluye materiales, diarios y advertencia',()=>{
 const s=shoppingListText(sample,id=>id);assert(s.includes('T5_METALBAR'));assert(s.includes('T5_JOURNAL')||s.includes('Diario'));assert(s.includes('Confirmar en el juego'));
});

test('integración: tab, iconos oficiales y acciones principales',async()=>{
 const {readFileSync}=await import('node:fs');
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 assert(!html.includes('data-nav="resultados"'));
 assert(html.includes('>Calculadora de Craft</span>'));
 assert(app.includes("sendPlanToCalculator('crafting')"));
 assert(app.includes("sendPlanToCalculator('autocraft')"));
 assert(app.includes("if(state.page==='resultados')resultsPage()"));
 assert(!app.includes("state.resultSource='crafting';changePage('resultados')"));
 assert(!app.includes("state.resultSource='autocraft';changePage('resultados')"));
 assert(app.includes("currentPlan(){return (state.page==='autocraft'"));
 assert(app.includes('copyableItemCell(m.id)')); // Ahora incluye copia de nombres sin tocar cálculos
 assert(app.includes('data-action="preflight"'));
 assert(app.includes('data-action="results-copy"'));
 assert(css.includes('.gcp-result-grid'));
});


test('no inventa fechas, actividad o confianza de datos ausentes',()=>{
 const source={budget:100,plan:{rows:[{qty:1,craftAmount:1,ageHours:null,confidence:{score:null},activity:{activeDays:null}}]}};
 const x=resultsSummary(source);assert.equal(x.ageHours,null);assert.equal(x.confidence,null);assert.equal(x.activityDays,null);
});


test('la confianza del plan usa su ruta menos fiable y los avisos producen estado parcial',()=>{
 const summary=resultsSummary(sample);assert.equal(summary.confidence,40);
 assert.equal(preflightOverview({ok:true,blockers:[],notes:['Sin profundidad de materiales']},summary).status,'partial');
});
