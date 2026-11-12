import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAmount,parseBlackMarketTable,planBlackMarket,demandFromAodp,bmSettings} from '../src/bm-plan.js';

const mats=(t,e,bars,leather)=>{const lv=e?`_LEVEL${e}@${e}`:'';return [{id:`T${t}_METALBAR${lv}`,count:bars,ret:true},{id:`T${t}_LEATHER${lv}`,count:leather,ret:true}];};
const recipes={};
for(let t=4;t<=8;t++)for(let e=0;e<=2;e++){const s=e?'@'+e:'';
 recipes[`T${t}_MAIN_SWORD${s}`]={city:'Lymhurst',materials:mats(t,e,16,8)};
 recipes[`T${t}_2H_CLAYMORE${s}`]={city:'Lymhurst',materials:mats(t,e,20,12)};
 recipes[`T${t}_2H_DUALSWORD${s}`]={city:'Lymhurst',materials:mats(t,e,20,12)};
 recipes[`T${t}_MAIN_SCIMITAR_MORGANA${s}`]={city:'Lymhurst',materials:[...mats(t,e,16,8),{id:`T${t}_ARTEFACT_MAIN_SCIMITAR_MORGANA`,count:1,ret:false}]};}

// Formato real de la tabla copiada (una celda por línea, cifras al final).
const SAMPLE=`ITEM	CIUDAD	CATEGORÍA	CANTIDAD DIARIA MEDIA	VOLUMEN PLATA DIARIO	PRECIO MEDIO UNITARIO
T4_MAIN_SWORD
Espada ancha del iniciado
T4.0
Black Market
Weapons
>
Sword
584	5,1M	8,7K
T5_2H_CLAYMORE
Claymore del experto
T5.0
Black Market
Weapons
>
Sword
518	15,7M	30,3K
T7_2H_DUALSWORD@3
Dos espadas del gran maestro
T7.3
Black Market
Weapons
>
Sword
0	1,7M	4,6M
T6_2H_DUALSWORD
Dos espadas del maestro
T6.0
Lymhurst
Weapons
>
Sword
50	4,5M	90K`;

test('parseAmount: K, M, coma decimal y miles',()=>{
 assert.equal(parseAmount('5,1M'),5_100_000);assert.equal(parseAmount('8,7K'),8700);assert.equal(parseAmount('584'),584);
 assert.equal(parseAmount('1,2M'),1_200_000);assert.equal(parseAmount('1.234,5'),1234.5);assert.equal(parseAmount('12,345'),12345);assert(Number.isNaN(parseAmount('abc')));});

test('Tabla pegada: lee ID y cifras, calcula ventas reales y descarta otras ciudades',()=>{
 const p=parseBlackMarketTable(SAMPLE);
 assert.deepEqual(p.rows.map(r=>r.id),['T4_MAIN_SWORD','T5_2H_CLAYMORE','T7_2H_DUALSWORD@3']);
 assert.equal(p.rows[0].price,8700);assert(Math.abs(p.rows[0].dailyUnits-586.2)<0.1);
 assert(p.rows[2].dailyUnits>0.3&&p.rows[2].dailyUnits<0.4,'0 redondeado → silver/precio');
 assert.equal(p.skipped[0].id,'T6_2H_DUALSWORD');});

test('Tabla tabulada en una sola línea',()=>{
 const p=parseBlackMarketTable('T6_MAIN_SWORD\tEspada ancha del maestro\tT6.0\tBlack Market\tWeapons\t239\t12,3M\t51,3K');
 assert.equal(p.rows.length,1);assert.equal(p.rows[0].price,51300);});

test('El archivo de espadas del usuario se lee entero',()=>{
 let text;try{text=readFileSync(new URL('./fixtures/bm-swords-sample.txt',import.meta.url),'utf8');}catch{return;}
 const p=parseBlackMarketTable(text);assert.equal(p.rows.length,90);assert.equal(p.skipped.length,0);});

const demand=[
 {id:'T4_MAIN_SWORD',dailyUnits:584,price:8700},{id:'T4_2H_DUALSWORD',dailyUnits:550,price:10600},{id:'T4_2H_CLAYMORE',dailyUnits:492,price:11600},
 {id:'T5_2H_CLAYMORE',dailyUnits:518,price:30300},{id:'T5_MAIN_SWORD',dailyUnits:384,price:18600},{id:'T5_2H_DUALSWORD',dailyUnits:219,price:30700},
 {id:'T6_MAIN_SWORD',dailyUnits:239,price:51300},{id:'T6_2H_DUALSWORD',dailyUnits:184,price:90600},{id:'T6_2H_CLAYMORE',dailyUnits:109,price:80000},
 {id:'T7_2H_DUALSWORD',dailyUnits:54,price:242100},{id:'T7_MAIN_SWORD',dailyUnits:30,price:165800},{id:'T8_MAIN_SWORD',dailyUnits:39,price:390600},
 {id:'T4_2H_DUALSWORD@1',dailyUnits:212,price:13400},{id:'T5_MAIN_SWORD@1',dailyUnits:124,price:31100},
 {id:'T6_MAIN_SCIMITAR_MORGANA',dailyUnits:44,price:74000},{id:'T8_2H_DUALSWORD',dailyUnits:1,price:745600}];

test('Plan: tope por volumen, presupuesto, diversidad y descartes explicados',()=>{
 const r=planBlackMarket({demand,recipes,config:{budget:10_000_000}});
 assert(r.rows.length>=6&&r.rows.length<=9);
 for(const x of r.rows)assert(x.sharePct<=6+1e-9,`${x.id} supera el 6 %`);
 assert(r.summary.capital<=10_000_000);
 assert(r.summary.capital>9_000_000,'usa casi todo el presupuesto');
 assert(new Set(r.rows.map(x=>x.tier)).size>=4,'reparte entre tiers');
 for(const x of r.rows)assert(x.capital<=2_500_000+1,'tope por artículo');
 const why=Object.fromEntries(r.rejected.map(x=>[x.id,x.reason]));
 assert.match(why['T4_2H_DUALSWORD@1'],/menos por material/);
 assert.match(why['T6_MAIN_SCIMITAR_MORGANA'],/artefacto/);
 assert.match(why['T8_2H_DUALSWORD'],/mínimo/);
 assert(r.summary.assumed);});

test('Sin cotizaciones no descarta nada y da el precio máximo de material',()=>{
 const r=planBlackMarket({demand,recipes,config:{}});
 const t6=r.rows.find(x=>x.id==='T6_2H_DUALSWORD');assert(t6);
 // 90.600 × 0,96 / (1,2 × 32 × (1 − 0,248))
 assert(Math.abs(t6.maxMatNoFocus-3012)<2);assert(t6.maxMatFocus>t6.maxMatNoFocus);
 const bars=r.shopping.find(s=>s.id==='T6_METALBAR');
 assert(bars.buyUnits<bars.recipeUnits,'compra neta del retorno');});

test('Con tus precios: margen real; los que no llegan al objetivo salen',()=>{
 const cheap={T6_METALBAR:1500,T6_LEATHER:1500};
 const ok=planBlackMarket({demand,recipes,config:{matPrices:cheap,tiers:[6]}});
 const t6=ok.rows.find(x=>x.id==='T6_2H_DUALSWORD');assert.equal(t6.costSource,'tus precios');
 assert(Math.abs(t6.margin-(90600*.96/(32*(1-33/133)*1500)-1))<1e-6);
 const dear=planBlackMarket({demand,recipes,config:{matPrices:{T6_METALBAR:5000,T6_LEATHER:5000},tiers:[6]}});
 assert.equal(dear.rows.length,0);assert(dear.rejected.some(x=>/Margen real/.test(x.reason)));});

test('Cotizaciones AODP de materiales en ciudades Royal',()=>{
 const now=Date.parse('2026-11-12T12:00:00Z'),q=new Map();
 for(const c of ['Lymhurst','Martlock'])for(const id of ['T7_METALBAR','T7_LEATHER'])q.set(id+'|'+c,{id,city:c,ask:{price:c==='Lymhurst'?6000:5500,time:now-3600e3}});
 const r=planBlackMarket({demand,recipes,quotes:q,config:{tiers:[7]},now});
 const x=r.rows.find(r=>r.id==='T7_2H_DUALSWORD');assert.equal(x.costSource,'AODP');
 assert.equal(r.shopping.find(s=>s.id==='T7_METALBAR').quote,5500);});

test('Demanda AODP: puja fresca del Mercado Negro o media −3 %',()=>{
 const now=Date.now(),quotes=new Map([['T5_2H_CLAYMORE|Black Market',{bid:{price:31000,time:now-3600e3}}]]);
 const d=demandFromAodp([{id:'T5_2H_CLAYMORE',city:'Black Market',averageDailyUnits:500,quality1AveragePrice:30000},{id:'T6_MAIN_SWORD',city:'Black Market',averageDailyUnits:200,quality1AveragePrice:50000},{id:'T6_MAIN_SWORD',city:'Lymhurst',averageDailyUnits:9,quality1AveragePrice:1}],quotes,{now});
 assert.equal(d.length,2);assert.equal(d[0].price,31000);assert.equal(d[1].price,48500);});

test('Ajustes: límites sanos y Premium enlazado al impuesto',()=>{
 const c=bmSettings({budget:-5,maxSharePct:900,premium:false,matPrices:{T6_METALBAR:'2000','x':5}});
 assert.equal(c.budget,10_000);assert.equal(c.maxSharePct,50);assert.equal(c.tax,8);assert.deepEqual(c.matPrices,{T6_METALBAR:2000});});

test('Pestaña Plan Mercado Negro enlazada en escritorio, teléfono y caché',()=>{
 const html=readFileSync('index.html','utf8'),js=readFileSync('src/main.js','utf8'),sw=readFileSync('sw.js','utf8');
 assert(html.includes('data-route="bm" id="nav-bm"'));assert(html.includes('data-route="bm" class="phone-tab"'));
 assert(js.includes("import {createBmPage} from './bm-page.js';"));assert(js.includes("state.page==='bm'?bmPage.render()"));
 for(const f of ['/src/bm-plan.js','/src/bm-page.js','/assets/tabs/bm-plan.svg'])assert(sw.includes(f),f);});
