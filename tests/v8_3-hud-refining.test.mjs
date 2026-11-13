import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {REFINERY_CHOICES,refinementScanIds,refiningPriceIds,createRefiningCandidates} from '../core/refining-opportunities.js';
import {rowMap} from '../core/engine.js';
import {rebuildPlan} from '../core/plan.js';
import {allocatePortfolioV6} from '../core/allocator-v6.js';
import {verifyPlannedPrices} from '../core/verify.js';

const now=new Date(Date.now()-10000).toISOString();
const make=(id,city,side,price)=>({item_id:id,city,quality:1,[side]:price,[side+'_date']:now});
const quotes=[
 make('T5_ORE','Thetford','sell_price_min',45),
 make('T5_ORE','Martlock','sell_price_min',90),
 make('T4_METALBAR','Thetford','sell_price_min',100),
 make('T4_METALBAR','Martlock','sell_price_min',90),
 make('T5_METALBAR','Lymhurst','sell_price_min',550),
 make('T5_METALBAR','Lymhurst','buy_price_max',500),
 make('T5_METALBAR','Martlock','sell_price_min',330)
];
// La API devuelve ambos lados de una cotización en la misma fila.
const combined=new Map();for(const x of quotes){const k=x.item_id+'|'+x.city;combined.set(k,{...(combined.get(k)||{}),...x});}
const rows=[...combined.values()];
rows.find(x=>x.item_id==='T5_METALBAR'&&x.city==='Lymhurst').buy_price_max=500;
rows.find(x=>x.item_id==='T5_METALBAR'&&x.city==='Lymhurst').buy_price_max_date=now;
const fixture=()=>createRefiningCandidates({selected:refinementScanIds({families:['METALBAR'],tierMin:5,tierMax:5,enchant:0}),priceMap:rowMap(rows),market:'royal',stationFee:25,maxAge:24,mode:'listed',dailyBonus:0,royalTax:4,listingFee:2.5});

test('v8.3 el refinamiento es una categoría invertible con cinco recursos sin inventar piedra encantada',()=>{
 assert.equal(REFINERY_CHOICES.length,5);
 const all=refinementScanIds({tierMin:4,tierMax:4,enchant:2});
 assert(all.some(x=>x.id==='T4_METALBAR_LEVEL1@1'));
 assert(all.some(x=>x.id==='T4_CLOTH_LEVEL2@2'));
 assert(!all.some(x=>x.id.startsWith('T4_STONEBLOCK_LEVEL')));
 assert.deepEqual(refinementScanIds({families:['PLANKS'],tierMin:5,tierMax:5,enchant:1,enchExact:'1'}).map(x=>x.id),['T5_PLANKS_LEVEL1@1']);
 assert.deepEqual(refinementScanIds({families:['LEATHER'],tierMin:6,tierMax:6,enchant:0}).map(x=>x.id),['T6_LEATHER']);
});

test('v8.3 lista de precios de refinamiento trae materia cruda, producto y tier anterior',()=>{
 const picked=refinementScanIds({families:['METALBAR'],tierMin:5,tierMax:5,enchant:0});
 assert.deepEqual(new Set(refiningPriceIds(picked)),new Set(['T5_METALBAR','T5_ORE','T4_METALBAR']));
});

test('v8.3 refinamiento compara compras, ciudad de bono, retorno, impuestos y estación con datos fechados',()=>{
 const {candidates}=fixture();
 const route=candidates.find(x=>x.id==='T5_METALBAR'&&x.city==='Lymhurst');
 assert(route);
 assert.equal(route.recipeKind,'refining');
 assert.equal(route.craftCity,'Thetford');
 assert.equal(route.materials.length,2);
 assert.equal(route.materials[0].id,'T5_ORE');
 assert.equal(route.materials[0].count,3);
 assert.equal(route.materials[0].city,'Thetford');
 assert.equal(route.materials[1].id,'T4_METALBAR');
 assert.equal(route.materials[1].city,'Martlock');
 assert.equal(route.returnRate>35,true);
 assert.equal(route.returnRate<40,true);
 assert.equal(route.stationCost,25);
 assert(route.capitalPerUnit>route.cost);
 assert(route.profit>0);
 const p=rebuildPlan([{...route,qty:2,maxCrafts:3}],3000);
 assert(p.ok);
 assert.equal(p.rows[0].qty,2);
 assert.equal(p.materials.find(x=>x.id==='T5_ORE').qtyGross,6);
 assert.equal(p.materials.find(x=>x.id==='T4_METALBAR').qtyGross,2);
 assert(!p.materials.some(x=>x.id==='T5_METALBAR'));
 assert(p.totalCost<=3000);
});

test('v8.3 refinamiento es Royal only, no inventa ventas ni ganancias sin precios',()=>{
 const selected=refinementScanIds({families:['METALBAR'],tierMin:5,tierMax:5,enchant:0});
 const black=createRefiningCandidates({selected,priceMap:rowMap(rows),market:'black'});
 assert.equal(black.candidates.length,0);
 const empty=createRefiningCandidates({selected,priceMap:rowMap([]),market:'royal'});
 assert.equal(empty.candidates.length,0);
 assert(empty.missing.materials>0);
 const expired=rows.map(r=>({...r,sell_price_min_date:'2005-01-01T00:00:00Z',buy_price_max_date:'2005-01-01T00:00:00Z'}));
 assert.equal(createRefiningCandidates({selected,priceMap:rowMap(expired),market:'royal'}).candidates.length,0);
});

test('v8.3 ingreso bruto y costo previo tienen un solo presupuesto incluso combinando destinos',()=>{
 const {candidates}=fixture();
 const r=candidates.find(x=>x.city==='Lymhurst');assert(r);
 const another={...r,id:'T5_FAKE_CRAFT',recipeKind:'equipo',city:'Black Market',craftCity:'Martlock',profit:115,capitalPerUnit:380,cost:230,mode:'instant',focusPerUnit:500,activity:null,confidence:{score:80},materials:[{id:'T5_METALBAR',count:2,used:1.5,unitPrice:120,city:'Martlock'}]};
 const filled=allocatePortfolioV6([{...r,confidence:{score:80}},another],1000,{focusLimit:1000,capFraction:0.1,unknownCap:2,maxVariants:10});
 const planned=rebuildPlan(filled.rows,1000,1000);
 assert(planned.ok);
 assert(planned.totalCost<=1000);
 assert(planned.focusUsed<=1000);
 assert(planned.rows.some(x=>x.recipeKind==='refining'));
});

test('v8.3 precompra vuelve a consultar insumos y venta de refinamiento',()=>{
 const r=fixture().candidates.find(x=>x.city==='Lymhurst');assert(r);
 const check=verifyPlannedPrices([{...r,qty:1,maxCrafts:2,totalProfit:r.profit,allocation:r.capitalPerUnit}],rows,{budget:1000,maxAgeHours:24,book:new Map()});
 assert(check.ok,check.blockers.join(' · '));
 assert(check.plan.materials.some(m=>m.id==='T5_ORE'));
 assert(check.plan.materials.some(m=>m.id==='T4_METALBAR'));
});

test('v8.3 el HUD separa los dos modos, no muestra agregados en crafting y tiene categorías legibles',async()=>{
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert(app.includes('BM_CATEGORIES.includes(g.key)'));
 assert(app.includes('manualBranches(branchCategory).map'));
 assert(app.includes("key==='weapons_all'||key.endsWith('_all')"));
 assert(app.includes("['refining','Refinamiento'"));
 assert(app.includes('auto-refinery-category-panel'));
 assert(app.includes('auto-refine-family'));
 assert(app.includes('createRefiningCandidates'));
 assert(css.includes('.auto-category-copy strong'));
 assert(css.includes('white-space:normal'));
 assert(!/data-nav="(?:cartera|focuslab|alertas|refino)"/.test(html));
});
