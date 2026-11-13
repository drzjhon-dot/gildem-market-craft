import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calcBatch,calcPriceIds,quoteIndex,variantId,availableTiers,availableEnchants} from '../core/craft-calc.js';
import {craftingReturnRate} from '../core/engine.js';
const now=Date.now(),at=new Date(now-3600000).toISOString();
const recipes={
 T5_SHOES_PLATE_SET1:{city:'Fort Sterling',materials:[{id:'T5_METALBAR',count:8}]},
 'T5_SHOES_PLATE_SET1@1':{city:'Fort Sterling',materials:[{id:'T5_METALBAR_LEVEL1@1',count:8}]},
 T4_SHOES_PLATE_SET1:{city:'Fort Sterling',materials:[{id:'T4_METALBAR',count:8}]},
};
const price=(id,city,ask,bid=0)=>({item_id:id,city,quality:1,sell_price_min:ask,sell_price_min_date:at,buy_price_max:bid,buy_price_max_date:at});
const rows=[
 price('T5_METALBAR','Thetford',3600),price('T5_METALBAR','Martlock',3900),
 price('T4_METALBAR','Fort Sterling',1100),
 price('T5_SHOES_PLATE_SET1','Lymhurst',52000),price('T5_SHOES_PLATE_SET1','Martlock',56000),
 price('T5_SHOES_PLATE_SET1','Black Market',0,64000),
 price('T4_SHOES_PLATE_SET1','Martlock',11000),
 price('T5_JOURNAL_WARRIOR_EMPTY','Fort Sterling',2500),
 price('T4_JOURNAL_WARRIOR_EMPTY','Fort Sterling',900),
];
const quotes=quoteIndex(rows,{now});
const opts={recipes,quotes,journalLookup:()=>null,premium:true,focus:false,tax:4,setup:2.5,stationFee:0};

test('cotizaciones: material al precio más barato Royal, venta Royal a la mejor orden y puja del Mercado Negro',()=>{
 const r=calcBatch([{id:'T5_SHOES_PLATE_SET1',qty:10}],opts).rows[0];
 assert.equal(r.ok,true);
 assert.equal(r.royalCity,'Martlock');assert.equal(r.royalAsk,56000);assert.equal(r.bmBid,64000);
 const rate=craftingReturnRate({specialty:true,focus:false}).returnRate;
 const used=8*(1-rate/100);
 assert(Math.abs(r.unitCost-used*3600)<1e-6,'coste neto con retorno de ciudad y material de Thetford');
 assert(Math.abs(r.profitBM-(64000*.96-r.unitCost)*10)<1e-6,'Mercado Negro: venta inmediata, solo impuesto');
 assert(Math.abs(r.profitRoyal-(56000*.935-r.unitCost)*10)<1e-6,'Royal: impuesto + publicación');
 assert(r.fameTotal>0&&r.journalsNeeded>0&&r.journalEmpty==='T5_JOURNAL_WARRIOR_EMPTY');
});
test('el Focus sube el retorno y baja el coste',()=>{
 const sin=calcBatch([{id:'T5_SHOES_PLATE_SET1',qty:1}],opts).rows[0];
 const con=calcBatch([{id:'T5_SHOES_PLATE_SET1',qty:1}],{...opts,focus:true}).rows[0];
 assert(con.unitCost<sin.unitCost&&con.returnRate>sin.returnRate);
});
test('materiales y diarios agregados: brutos con «sobran», totales y a quién sirven',()=>{
 const out=calcBatch([{id:'T5_SHOES_PLATE_SET1',qty:10},{id:'T4_SHOES_PLATE_SET1',qty:5}],opts);
 const t5=out.materials.find(m=>m.id==='T5_METALBAR');
 assert.equal(t5.gross,80);assert(t5.buy<t5.gross&&t5.reused===t5.gross-t5.buy&&t5.city==='Thetford');
 assert.deepEqual(t5.usedBy,['T5_SHOES_PLATE_SET1']);
 const j5=out.journals.find(j=>j.empty==='T5_JOURNAL_WARRIOR_EMPTY');
 assert(j5&&j5.count>=1&&j5.unitPrice===2500&&j5.totalCost===j5.count*2500);
 assert.equal(out.totals.crafts,15);
 assert(out.totals.buyCapital<=out.totals.grossCapital);
 assert(out.totals.profitBM!==null&&out.totals.royalMissing===0&&out.totals.bmMissing===1,'el T4 no tiene puja BM');
});
test('v9.8.0 · sin cotización no se inventa nada, pero la fila SÍ calcula: material sin precio entra a 0, se señala y el profit queda pendiente',()=>{
 const out=calcBatch([{id:'T9_NO_EXISTE',qty:3},{id:'T5_SHOES_PLATE_SET1@1',qty:2}],opts);
 assert.equal(out.rows[0].ok,false,'sin receta sigue siendo fila inválida');
 const row=out.rows[1];
 assert.equal(row.ok,true,'el material encantado sin precio ya no invalida la fila');
 assert.equal(row.incomplete,true);
 assert.deepEqual(row.missingPrices,['T5_METALBAR_LEVEL1@1']);
 assert.equal(row.profitBM,null,'el profit espera a que el usuario escriba el precio');
 assert.equal(out.totals.crafts,2);
 assert.equal(out.totals.incomplete,1);
 assert.deepEqual(out.totals.missingPriceIds,['T5_METALBAR_LEVEL1@1']);
 const mat=out.materials.find(m=>m.id==='T5_METALBAR_LEVEL1@1');
 assert(mat&&mat.missing===true&&mat.unitPrice===0);
 // escribir el precio a mano completa el cálculo
 const fixed=calcBatch([{id:'T5_SHOES_PLATE_SET1@1',qty:2}],{...opts,overrides:{buy:{'T5_METALBAR_LEVEL1@1':9000}}});
 assert.equal(fixed.rows[0].incomplete,false);
 assert(fixed.rows[0].profitBM!==undefined);
});
test('v9.8.0 · una cotización vieja ya no desaparece: se usa marcada como antigua, con su edad',()=>{
 const stale=[price('T5_METALBAR','Thetford',3600)].map(x=>({...x,sell_price_min_date:new Date(now-30*3600000).toISOString()}));
 const q24=quoteIndex(stale,{maxAgeHours:24,now}).get('T5_METALBAR');
 assert.equal(q24.ask.size,1);
 const quote=q24.ask.get('Thetford');
 assert.equal(quote.stale,true);
 assert(Math.abs(quote.ageHours-30)<.1);
 assert.equal(quoteIndex(stale,{maxAgeHours:48,now}).get('T5_METALBAR').ask.get('Thetford').stale,false);
 // y una fresca gana a una vieja aunque la vieja sea más barata
 const both=[...stale,price('T5_METALBAR','Lymhurst',4000)];
 const batch=calcBatch([{id:'T5_SHOES_PLATE_SET1',qty:1}],{...opts,quotes:quoteIndex(both,{maxAgeHours:24,now})});
 assert.equal(batch.rows[0].incomplete,false);
 const used=batch.materials.find(m=>m.id==='T5_METALBAR');
 assert.equal(used.city,'Lymhurst','prefiere la cotización fresca sobre la antigua más barata');
});
test('v9.8.0 · variantes: tiers y encantamientos disponibles según recetas, con fusión de ids',()=>{
 const rec={T4_SHOES_PLATE_SET1:{materials:[{id:'T4_METALBAR',count:8}]},T5_SHOES_PLATE_SET1:{materials:[{id:'T5_METALBAR',count:8}]},'T5_SHOES_PLATE_SET1@1':{materials:[{id:'T5_METALBAR_LEVEL1@1',count:8}]}};
 assert.deepEqual(availableTiers(rec,'T4_SHOES_PLATE_SET1'),[4,5]);
 assert.deepEqual(availableEnchants(rec,'T5_SHOES_PLATE_SET1',5),[0,1]);
 assert.deepEqual(availableEnchants(rec,'T5_SHOES_PLATE_SET1',4),[0]);
 assert.equal(variantId('T4_SHOES_PLATE_SET1',5,1),'T5_SHOES_PLATE_SET1@1');
 assert.equal(variantId('T6_X@3',4,0),'T4_X');
});
test('calcPriceIds reúne objeto, materiales y diario; la app tiene la pestaña cableada',()=>{
 const ids=calcPriceIds([{id:'T5_SHOES_PLATE_SET1',qty:1}],recipes,()=>null);
 assert.deepEqual(ids.sort(),['T5_JOURNAL_WARRIOR_EMPTY','T5_METALBAR','T5_SHOES_PLATE_SET1'].sort());
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 for(const t of ["if(state.page==='craftcal')calcPage();",'data-cal-add','data-cal-remove','data-cal-qty','data-cal-tier','data-cal-ench','calcItemDropdown','calcBatch(calcPrefs.items','Profit Royal','Usar Focus'])assert(app.includes(t),t);
 assert(!app.includes('cal-search'),'el buscador fue sustituido por el desplegable');
 assert(readFileSync(new URL('../index.html',import.meta.url),'utf8').includes('data-nav="craftcal"'));
 assert(readFileSync(new URL('../sw.js',import.meta.url),'utf8').includes('./core/craft-calc.js'));
});

test('precios manuales: compra, puja BM y venta Royal corregidas a mano mandan sobre AODP',()=>{
 const recipes={T4_X:{city:'Martlock',amount:1,materials:[{id:'T4_METALBAR',count:10}]}};
 const quotes=quoteIndex([
  {item_id:'T4_METALBAR',city:'Lymhurst',quality:1,sell_price_min:100,sell_price_min_date:new Date().toISOString()},
  {item_id:'T4_X',city:'Black Market',quality:1,buy_price_max:5000,buy_price_max_date:new Date().toISOString()},
  {item_id:'T4_X',city:'Thetford',quality:1,sell_price_min:4000,sell_price_min_date:new Date().toISOString()},
 ]);
 const base=calcBatch([{id:'T4_X',qty:2}],{recipes,quotes,tax:4,setup:2.5});
 const over=calcBatch([{id:'T4_X',qty:2}],{recipes,quotes,tax:4,setup:2.5,
  overrides:{buy:{T4_METALBAR:200},sellBM:{T4_X:6000},sellRoyal:{T4_X:3000}}});
 const b=base.rows[0],o=over.rows[0];
 assert.equal(o.bmBid,6000);assert.equal(o.bmManual,true);assert.equal(b.bmManual,false);
 assert.equal(o.royalAsk,3000);assert.equal(o.royalCity,'Manual');
 assert(o.unitCost>b.unitCost*1.9,'el material manual a 200 duplica el coste');
 assert.equal(over.materials[0].manual,true);
 assert(o.profitBM>b.profitBM*0&&o.profitBM!==b.profitBM);
});
test('la interfaz permite editar precios y volver a AODP',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 for(const t of ['data-cal-buy','data-cal-sell-bm','data-cal-sell-royal','data-cal-reset','overrides:{buy:calcPrefs.buy'])assert(app.includes(t),t);
});

test('v9.8.0 · fuera de ciudad de bono: sin el 15 % de especialidad, el retorno baja y el coste sube',()=>{
 const inBonus=calcBatch([{id:'T5_SHOES_PLATE_SET1',qty:4}],opts).rows[0];
 const outBonus=calcBatch([{id:'T5_SHOES_PLATE_SET1',qty:4,noBonus:true}],opts).rows[0];
 assert(Math.abs(inBonus.returnRate-24.812)<.1,'con bono ~24,8 %');
 assert(Math.abs(outBonus.returnRate-15.254)<.1,'sin bono ~15,3 %');
 assert(outBonus.unitCost>inBonus.unitCost,'fuera del bono cuesta más');
 assert.equal(outBonus.noBonus,true);assert.equal(outBonus.specialty,false);
 const focused=calcBatch([{id:'T5_SHOES_PLATE_SET1',qty:4,noBonus:true}],{...opts,focus:true}).rows[0];
 assert(Math.abs(focused.returnRate-43.503)<.1,'sin bono con Focus ~43,5 %');
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert(app.includes('data-cal-nobonus')&&app.includes('Fuera de ciudad de bono'));
});

test('v9.8.0 · bono diario de producción: +10/+20 % suben el retorno dentro y fuera de la ciudad de bono',()=>{
 const rate=(o={})=>calcBatch([{id:'T5_SHOES_PLATE_SET1',qty:1,...o}],{...opts,...o}).rows[0].returnRate;
 assert(Math.abs(rate({dailyBonus:10})-30.07)<.1,'con bono de ciudad y día +10 ≈ 30,1 %');
 assert(Math.abs(rate({dailyBonus:20})-34.64)<.1,'con bono de ciudad y día +20 ≈ 34,6 %');
 assert(Math.abs(rate({dailyBonus:20,noBonus:true})-27.54)<.1,'fuera de bono con día +20 ≈ 27,5 %');
 assert(rate({dailyBonus:20})>rate({dailyBonus:10})&&rate({dailyBonus:10})>rate());
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 for(const x of ['cal-daily','Bono diario','dailyBonus:calcPrefs.dailyBonus'])assert(app.includes(x),x);
});

test('v9.8.0 · el retorno SÍ cambia cuánto comprar: más bono, menos recursos; el bruto de la receta no cambia',()=>{
 const buyOf=o=>{const m=calcBatch([{id:'T5_SHOES_PLATE_SET1',qty:10,...o}],{...opts,...o}).materials.find(x=>x.id==='T5_METALBAR');return m;};
 const base=buyOf({});            // bono de ciudad 24,8 %
 const noBonus=buyOf({noBonus:true}); // 15,3 %
 const daily=buyOf({dailyBonus:20});  // 34,6 %
 const focused=buyOf({focus:true});   // 47,9 %
 assert.equal(base.gross,80);assert.equal(noBonus.gross,80);assert.equal(daily.gross,80);
 // v9.10: neto + retorno del último craft (8 lingotes × 24,8 %), que ya no se reutiliza.
 assert.equal(base.buy,Math.ceil(80*(1-.24812)+8*.24812-1e-9));
 assert(noBonus.buy>base.buy&&daily.buy<base.buy&&focused.buy<daily.buy,
  `${noBonus.buy} > ${base.buy} > ${daily.buy} > ${focused.buy}`);
 assert.equal(base.reused,base.gross-base.buy);
 assert.equal(base.buyCost,base.buy*base.unitPrice);
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert(app.includes('reutilizas ${fmt(m.reused)}'));
 assert(app.includes('totals.buyCapital+totals.journalCost'));
});
