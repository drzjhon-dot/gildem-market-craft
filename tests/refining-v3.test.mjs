import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planRefining,refiningIds,productIds,refineSettings,hops} from '../src/refining-engine.js';
import {REFINE_RECIPES,TRANSMUTE,WEIGHT} from '../src/refining-data.js';
import {quotes,history,materialHistory,T} from './fixtures/refining-fixture.mjs';

const run=(cfg={},q=quotes)=>planRefining({quotes:q,history,materialHistory,config:{type:'CLOTH',tiers:[4,5,6],enchants:[0,1,2],...cfg},now:T});

test('Datos del juego: recetas de refinado, transmutación y pesos',()=>{
 assert.deepEqual(REFINE_RECIPES.T5_CLOTH.m,[['T5_FIBER',3],['T4_CLOTH',1]]);
 assert.deepEqual(REFINE_RECIPES['T4_CLOTH_LEVEL1@1'].m,[['T4_FIBER_LEVEL1@1',2],['T3_CLOTH',1]]);
 assert(REFINE_RECIPES.T4_CLOTH.f>0);
 assert.deepEqual(TRANSMUTE.T5_FIBER[0],[781,['T4_FIBER',1]]);
 assert.equal(WEIGHT.T5_FIBER,.76);
});
test('Saltos entre ciudades Royal',()=>{
 assert.equal(hops('Lymhurst','Lymhurst'),0);assert.equal(hops('Fort Sterling','Lymhurst'),1);
 assert.equal(hops('Fort Sterling','Martlock'),2);assert.equal(hops('Caerleon','Thetford'),1);
});
test('Refinamiento: respeta presupuesto, Focus, montura y divisiones',()=>{
 const p=run({budget:2e6});assert(p.summary.capital<=2e6+1e-6);assert(p.sales.length);
 const f=run({focus:true,focusAvailable:5000});assert(f.summary.focus<=5000+1e-6);
 const m=run({mountKg:3000,trips:1});assert(m.summary.kgIn<=3000*1.03+1,'kg (con el 2 % de margen de compra)');
 const d=run({divisions:2});assert(new Set(d.sales.map(s=>s.city)).size<=2);
});
test('Refinamiento: ninguna venta a pérdida y la ciudad de bono da el retorno del 36,7 %',()=>{
 const p=run();assert(p.sales.every(s=>s.profit>0));assert(Math.abs(p.summary.returnPct-36.7)<.1);
 assert.equal(p.summary.refineCity,'Lymhurst');
});
test('Refinamiento: en cadena nunca empeora el plan',()=>{
 const on=run({tiers:[4],enchants:[0]}),off=run({tiers:[4],enchants:[0],chain:false});
 assert(on.summary.profit>=off.summary.profit-1);
});
test('Refinamiento: transmuta cuando el recurso cuesta más que transmutarlo',()=>{
 const q=new Map(quotes);for(const c of ['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford']){const k='T5_FIBER|'+c;q.set(k,{...q.get(k),ask:{price:5000,time:T-3600e3}});
  const p='T5_CLOTH|'+c;q.set(p,{...q.get(p),ask:{price:8000,time:T-3600e3}});}
 const h=history.map(x=>x.id==='T5_CLOTH'?{...x,quality1AveragePrice:8000,quality1Series:x.quality1Series.map(([u])=>[u,8000])}:x);
 const go=cfg=>planRefining({quotes:q,history:h,materialHistory,config:{type:'CLOTH',tiers:[5],enchants:[0],...cfg},now:T});
 const p=go({});assert(p.sales.length);assert(p.transmutations.some(t=>t.id==='T5_FIBER'));
 const no=go({transmute:false});assert(!no.transmutations.length);assert(p.summary.profit>no.summary.profit);
});
test('Refinamiento: IDs a consultar incluyen cadena y orígenes de transmutación',()=>{
 const ids=refiningIds({type:'CLOTH',tiers:[5],enchants:[1]});
 for(const id of ['T5_CLOTH_LEVEL1@1','T5_FIBER_LEVEL1@1','T4_CLOTH_LEVEL1@1','T4_FIBER_LEVEL1@1','T5_FIBER'])assert(ids.includes(id),id);
 assert.deepEqual(productIds(refineSettings({type:'CLOTH',tiers:[4],enchants:[0,1]})),['T4_CLOTH','T4_CLOTH_LEVEL1@1']);
});
test('Refinamiento: estilo dinámico + usar todo marca «Plan arriesgado» con la cantidad recomendada',()=>{
 const p=run({tiers:[4],enchants:[0],style:'dynamic',useBudget:true});assert.equal(p.verdict,'risky');
 assert(p.summary.recommendedUnits<p.summary.units);assert(p.warnings.some(w=>/arriesgado/.test(w)));
});
test('Refinamiento: prioridad de venta rápida vende a las pujas (sin publicación)',()=>{
 const p=run({priority:'fast-sale'});assert(p.sales.every(s=>s.saleMode==='instant'));
});
test('Interfaz: pestaña Refinamiento conectada al motor',()=>{
 const html=readFileSync('index.html','utf8'),main=readFileSync('src/main.js','utf8'),page=readFileSync('src/refine-page.js','utf8');
 assert(html.includes('data-route="refine"'));assert(main.includes("state.page==='refine'?refinePage.render()"));
 assert(page.includes('planRefining('));assert(page.includes("marketFetch('prices'"));
 for(const k of ['mountKg','trips','hopPct','divisions','transmute','chain','priority','focus'])assert(page.includes(`data-ref="${k}"`),k);
});
