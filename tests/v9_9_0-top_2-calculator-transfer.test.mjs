import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareCalculatorHandoff,CALCULATOR_ITEM_LIMIT} from '../core/calculator-handoff.js';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const app=read('app.js'),html=read('index.html'),css=read('styles.css');

test('navegacion muestra exactamente las cinco pestañas pedidas y en su orden',()=>{
 const got=[...html.matchAll(/data-nav="(craftcal|crafting|autocraft|topmercado|ajustes|resultados)" class="nav-item/g)].map(x=>x[1]);
 assert.deepEqual(got,['craftcal','crafting','autocraft','topmercado','ajustes']);
 const labels=['Calculadora de Craft','Black Craft','Royal Craft','Top Mercado','Ajustes y Datos'];
 for(const s of labels)assert(html.includes('>'+s+'</span>'));
 assert(!html.includes('data-nav="resultados"'));
 assert(app.includes("if(page==='resultados')page='craftcal'"));
});

test('transferencia agrega cantidades del MISMO ID entre ciudades sin cambiar tier ni enchant',()=>{
 const rows=[{id:'T4_MAIN_MACE',qty:199,city:'Black Market',craftAmount:1},
  {id:'T4_MAIN_MACE',qty:21,city:'Thetford',craftAmount:1},
  {id:'T5_MAIN_MACE@1',qty:19,city:'Black Market',craftAmount:1},
  {id:'T4_2H_MACE',qty:137,city:'Black Market'},
  {id:'T6_METALBAR',qty:3,recipeKind:'refining',craftAmount:2}];
 const p=prepareCalculatorHandoff(rows);
 assert.deepEqual(p.items,[{id:'T4_MAIN_MACE',qty:220},{id:'T5_MAIN_MACE@1',qty:19},{id:'T4_2H_MACE',qty:137},{id:'T6_METALBAR',qty:3}]);
 assert.equal(p.crafts,379);assert.equal(p.units,382);assert.equal(p.refining,3);
 assert.equal(rows[0].qty,199,'No debe mutar el plan económico');
});

test('no altera la cantidad de fabricaciones en recetas de varias unidades',()=>{
 const p=prepareCalculatorHandoff([{id:'T4_POTION_HEAL',qty:6,craftAmount:5}]);
 assert.equal(p.items[0].qty,6);assert.equal(p.units,30);
});

test('no trunca silenciosamente planes amplios ni permite IDs y cantidades incorrectos',()=>{
 const rows=Array.from({length:CALCULATOR_ITEM_LIMIT+1},(_,i)=>({id:`T4_TEST_${i}`,qty:1}));
 assert.throws(()=>prepareCalculatorHandoff(rows),/objetos distintos/);
 assert.throws(()=>prepareCalculatorHandoff([{id:'T4_X@1',qty:3.5}]),/cantidades/);
 assert.throws(()=>prepareCalculatorHandoff([{id:'T4_X',qty:-2}]),/cantidades/);
 assert.throws(()=>prepareCalculatorHandoff([{id:'<script>',qty:1}]),/ID invalido/);
 assert.throws(()=>prepareCalculatorHandoff([{id:'T4_X',qty:99999},{id:'T4_X',qty:1}]),/99.999/);
});

test('transferencia genera un listado vacio para planes sin items validos',()=>{
 assert.deepEqual(prepareCalculatorHandoff([{id:'T4_X',qty:0}]).items,[]);
});

test('Black y Royal envian su plan a la calculadora y se puede reeditar y agregar',()=>{
 assert(app.includes("state.resultSource='crafting';sendPlanToCalculator('crafting')"));
 assert(app.includes("state.resultSource='autocraft';sendPlanToCalculator('autocraft')"));
 assert(app.includes("calcPrefs.items=moved.items"));
 assert(app.includes("changePage('craftcal')"));
 assert(app.includes('data-action="send-to-calc"'));
 assert(app.includes('data-cal-qty')&&app.includes('data-cal-ench')&&app.includes('data-cal-tier'));
 assert(app.includes('data-cal-add')&&app.includes('data-cal-remove'));
 assert(app.includes('gildem-calc-origin-v1'));
 assert(app.includes('totals.buyCapital+totals.journalCost>calcOrigin.budget'));
});

test('Fuentes y evidencia de mercado no aparece en ninguna vista',()=>{
 assert(!app.includes('marketReferencesPanel(current.marketReferences)'));
 assert(!app.includes('marketReferencesPanel(p.marketReferences)'));
 assert(css.includes('.gcp-market-references{display:none !important}'));
});

// Ejecuta la funcion REAL con un estado de sesion simulado, sin AODP ni navegador.
import vm from 'node:vm';
test('Black Craft envia su cartera real a Calculadora y guarda presupuesto, focus, diario',()=>{
 const begin=app.indexOf('function sendPlanToCalculator(source){');
 const end=app.indexOf('function calcAddItem(id,qty=1){',begin);
 assert(begin>0&&end>begin);
 const sample={budget:10000000,focus:true,daily:10,plan:{rows:[
  {id:'T4_MAIN_MACE',qty:199,city:'Black Market'},
  {id:'T4_MAIN_MACE',qty:15,city:'Thetford'},
  {id:'T4_2H_FLAIL',qty:21,city:'Black Market'},
  {id:'T5_MAIN_MACE@1',qty:19,city:'Black Market'}
 ]}};
 const target={items:[{id:'T8_SOMETHING',qty:2}],focus:false,dailyBonus:0};
 const changes=[],messages=[];
 const ctx={state:{plan:sample,autoPlan:null,resultSource:'autocraft'},calcPrefs:target,calcOrigin:null,prepareCalculatorHandoff,CALCULATOR_ITEM_LIMIT,Date,Number,Error,
  saveCalcPrefs:()=>changes.push('save-items'),saveCalcOrigin:()=>changes.push('save-origin'),
  changePage:page=>changes.push('page:'+page),showToast:(msg,err)=>messages.push({msg,err})};
 vm.runInNewContext(app.slice(begin,end)+';this.sendPlanToCalculator=sendPlanToCalculator;',ctx);
 assert.equal(ctx.sendPlanToCalculator('crafting'),true);
 assert.deepEqual(target.items,[{id:'T4_MAIN_MACE',qty:214},{id:'T4_2H_FLAIL',qty:21},{id:'T5_MAIN_MACE@1',qty:19}]);
 assert.equal(target.focus,true);assert.equal(target.dailyBonus,10);
 assert.equal(ctx.calcOrigin.budget,10000000);assert.equal(ctx.calcOrigin.crafts,254);
 assert.equal(ctx.state.resultSource,'crafting');
 assert.deepEqual(changes,['save-items','save-origin','page:craftcal']);
 assert.match(messages[0].msg,/3 objetos transferidos/);
});

test('Royal Craft usa sus rutas propias, sin duplicar las de Black Craft',()=>{
 const begin=app.indexOf('function sendPlanToCalculator(source){');
 const end=app.indexOf('function calcAddItem(id,qty=1){',begin);
 const target={items:[],focus:true,dailyBonus:20};
 const ctx={state:{plan:{plan:{rows:[{id:'T4_WRONG',qty:100}]}},autoPlan:{budget:5000000,focus:false,daily:0,plan:{rows:[{id:'T5_MAIN_MACE',qty:3,city:'Martlock'}]}},resultSource:'crafting'},calcPrefs:target,calcOrigin:null,prepareCalculatorHandoff,Date,Number,Error,saveCalcPrefs:()=>{},saveCalcOrigin:()=>{},changePage:()=>{},showToast:()=>{}};
 vm.runInNewContext(app.slice(begin,end)+';this.sendPlanToCalculator=sendPlanToCalculator;',ctx);
 assert.equal(ctx.sendPlanToCalculator('autocraft'),true);
 assert.deepEqual(target.items,[{id:'T5_MAIN_MACE',qty:3}]);
 assert.equal(target.focus,false);assert.equal(target.dailyBonus,0);
 assert.equal(ctx.state.resultSource,'autocraft');
});

test('calculadora conserva lista de compras y diarios exportable tras editar',()=>{
 for(const x of ['function exportCalcShopping(){','function copyCalcShopping(){','data-cal-export','data-cal-copy','result.materials','result.journals','data-cal-qty'])assert(app.includes(x),x);
 assert(app.includes('state.craftCalc=null;setBusy'), 'No debe exportarse un calculo obsoleto mientras recalcule');
});
