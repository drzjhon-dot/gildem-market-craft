import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeLot,createPortfolio,lotsFromPlanner,lotsFromBmPlan,sanitizeBusiness,loadBusiness,saveBusiness} from '../src/business-store.js';
import {summarizePortfolio,recordSale} from '../src/ledger.js';
import {parseAfmTradesCsv,applyTradesToPortfolios,summarizeTrades} from '../src/afm-trades.js';
import {searchItems,withEnchant,priceBoard,historySeries,goldSummary,sparkline,makeAlert,checkAlerts} from '../src/price-tools.js';
import {stepCount,enchantSteps,enchantOpportunities,enchantQueryIds} from '../src/enchant.js';
import {farmRows,salePrice} from '../src/farm.js';
import {RECIPE_SUPPLEMENT} from '../src/recipe-supplement.js';

const extra=JSON.parse(readFileSync(new URL('../assets/data/game-extra.json',import.meta.url),'utf8'));
const now=Date.parse('2026-11-12T12:00:00Z');
const qmap=entries=>new Map(entries.map(([id,city,ask,bid])=>[id+'|'+city,{id,city,...(ask?{ask:{price:ask,time:now-3600e3}}:{}),...(bid?{bid:{price:bid,time:now-3600e3}}:{})}]));

test('Datos del juego: cantidades de encantamiento exactas y granja',()=>{
 assert.equal(extra.enchant.T4_MAIN_SWORD,288);assert.equal(extra.enchant.T5_2H_CLAYMORE,384);
 assert.equal(extra.enchant.T6_HEAD_PLATE_SET1,96);assert.equal(extra.enchant.T4_ARMOR_CLOTH_SET1,192);
 assert.equal(extra.farm.length,15);const potato=extra.farm.find(f=>f.seed==='T6_FARM_POTATO_SEED');
 assert.equal(potato.crop,'T6_POTATO');assert.equal(potato.yieldMin,3);assert.equal(potato.yieldMax,6);assert(Math.abs(potato.seedChance-0.8667)<1e-4);});

test('Recetas del set de cuero dragón añadidas desde el 9.11',()=>{
 assert(RECIPE_SUPPLEMENT.T4_HEAD_LEATHER_DRAGON.materials.some(m=>m.ret===false));
 const main=readFileSync('src/main.js','utf8');assert(main.includes('state.recipes={...RECIPE_SUPPLEMENT,...files[1].value}'),'el catálogo principal tiene prioridad');});

test('Mi negocio: lotes desde Craft Planner y Plan Mercado Negro',()=>{
 const lots=lotsFromPlanner([{id:'T6_2H_DUALSWORD',city:'Lymhurst',craftCity:'Lymhurst',qty:10,craftAmount:1,grossCapitalPerCraft:60000,planningPrice:90000}],{tax:4,listingFee:2.5});
 assert.equal(lots[0].qty,10);assert.equal(lots[0].setupRate,.025);assert(Math.abs(lots[0].expectedProfit-(90000*(1-.04-.025)-60000))<1e-6);
 const bm=lotsFromBmPlan({config:{tax:4},rows:[{id:'T7_2H_DUALSWORD',units:9,capital:1_632_722,price:242100}]});
 assert.equal(bm[0].market,'Black Market');assert.equal(bm[0].setupRate,0);assert(Math.abs(bm[0].unitCost-181413.6)<1);
 const p=createPortfolio({title:'x',lots:bm});assert.equal(p.started,false);
 assert.throws(()=>createPortfolio({title:'vacío',lots:[]}),/no tiene unidades/);});

test('Mi negocio: ventas, resumen y copia saneada',()=>{
 let p=createPortfolio({title:'MN',lots:[makeLot({id:'T5_2H_CLAYMORE',market:'Black Market',units:10,unitCost:22000,expectedPrice:30000,listingFee:0})]});
 p={...p,started:true,startedAt:new Date(now-86400e3).toISOString()};
 p=recordSale(p,'lot-0',{qty:4,price:31000,fees:4960});
 const s=summarizePortfolio(p);assert.equal(s.sold,4);assert.equal(s.realizedProfit,4*31000-4960-4*22000);
 assert.throws(()=>recordSale(p,'lot-0',{qty:7,price:1,fees:0}),/supera/);
 const clean=sanitizeBusiness({portfolios:[p,{bad:true},{lots:[{id:'<script>'}]}]});assert.equal(clean.portfolios.length,2);assert.equal(clean.portfolios[1].lots.length,0);
 const mem=new Map();const storage={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v)};
 assert(saveBusiness({portfolios:[p]},storage));assert.equal(loadBusiness(storage).portfolios[0].lots[0].sales.length,1);});

test('Mi negocio: el CSV de Trades del AFM se aplica solo a inversiones compradas y una vez',async()=>{
 const {NAMES_EN}=await import('../src/names-en.js');
 const csv=['Server,Player,Received,Type,Operation,Quality,Item,Location,Full Location,Amount,Unit Silver,Total Silver,Order Amount',
  `Americas,Yo,${new Date(now).toISOString()},Instant,Sell,Normal,Expert's Claymore,Black Market,Black Market,3,31000,93000,`,
  `Europe,Yo,${new Date(now).toISOString()},Instant,Sell,Normal,Expert's Claymore,Black Market,Black Market,2,31000,62000,`].join('\n');
 const parsed=parseAfmTradesCsv(csv,{namesEn:NAMES_EN});assert.equal(parsed.trades[0].id,'T5_2H_CLAYMORE');
 const west=parsed.trades.filter(t=>/americ/i.test(t.server));
 let p={...createPortfolio({title:'MN',lots:[makeLot({id:'T5_2H_CLAYMORE',market:'Black Market',units:10,unitCost:22000,expectedPrice:30000,listingFee:0})]}),started:true,startedAt:new Date(now-86400e3).toISOString()};
 const a=applyTradesToPortfolios([p],west,{recordSale});assert.equal(a.report.units,3);
 const b=applyTradesToPortfolios(a.portfolios,west,{recordSale});assert.equal(b.report.duplicates,1);assert.equal(b.report.units,0);
 const planned=applyTradesToPortfolios([{...p,started:false}],west,{recordSale});assert.equal(planned.report.unmatched,1);
 assert.equal(summarizeTrades(west)[0].units,3);});

test('Precios: búsqueda en español, tabla por mercado e historial',()=>{
 const names={T5_2H_CLAYMORE:'Claymore del experto','T5_2H_CLAYMORE@1':'Claymore del experto',T5_MAIN_SWORD:'Espada ancha del experto',T6_2H_CLAYMORE:'Claymore del maestro'};
 assert.deepEqual(searchItems(names,'claymore expérto').map(x=>x.id),['T5_2H_CLAYMORE']);
 assert.equal(withEnchant('T5_2H_CLAYMORE',2),'T5_2H_CLAYMORE@2');assert.equal(withEnchant('T5_2H_CLAYMORE@2',0),'T5_2H_CLAYMORE');
 const q=qmap([['X','Lymhurst',100,90],['X','Martlock',95,null],['X','Black Market',null,120]]);
 const b=priceBoard(q,'X',{now});assert.equal(b.bestBuy.city,'Martlock');assert.equal(b.bestInstantSell.city,'Black Market');
 const h=historySeries([{item_id:'X',location:'Lymhurst',data:[{timestamp:'2026-11-10T00:00:00',item_count:10,avg_price:100},{timestamp:'2026-11-11T00:00:00',item_count:30,avg_price:120}]}],'X');
 assert.equal(h.Lymhurst.dailyUnits,20);assert.equal(h.Lymhurst.avgPrice,115);assert(sparkline([1,2,3]).startsWith('<svg'));});

test('Oro de West: último precio, cambio y rango',()=>{
 const rows=[...Array(30)].map((_,i)=>({price:7000+i*10,timestamp:new Date(now-(29-i)*3600e3).toISOString().slice(0,19)}));
 const g=goldSummary(rows,{now});assert.equal(g.latest,7290);assert(g.change24h>0);assert.equal(g.min,7000);assert.equal(g.max,7290);});

test('Alertas: validación y disparo solo con datos recientes',()=>{
 assert.throws(()=>makeAlert({itemId:'T5_2H_CLAYMORE',city:'Black Market',kind:'askAtMost',price:1}),/no vende/);
 assert.throws(()=>makeAlert({itemId:'T5_2H_CLAYMORE',city:'Lymhurst',kind:'bidAtLeast',price:0}),/precio/);
 const a=makeAlert({itemId:'T5_2H_CLAYMORE',city:'Black Market',kind:'bidAtLeast',price:30000}),b=makeAlert({itemId:'T5_2H_CLAYMORE',city:'Lymhurst',kind:'askAtMost',price:25000});
 const q=qmap([['T5_2H_CLAYMORE','Black Market',null,31000],['T5_2H_CLAYMORE','Lymhurst',26000,null]]);
 assert.deepEqual(checkAlerts([a,b],q,{now}).map(h=>h.alert.id),[a.id]);
 assert.equal(checkAlerts([a],q,{now:now+10*3600e3}).length,0,'dato viejo no dispara');});

test('Encantar: pasos exactos y mejor nivel de partida para el Mercado Negro',()=>{
 const counts=extra.enchant;assert.equal(stepCount(counts,'T4_MAIN_SWORD',1),288);
 assert.deepEqual(enchantSteps(counts,'T4_MAIN_SWORD',0,2).map(s=>s.id),['T4_RUNE','T4_SOUL']);
 const {items,mats}=enchantQueryIds(['T4_MAIN_SWORD'],counts);assert.equal(items.length,4);assert.deepEqual(mats,['T4_RUNE','T4_SOUL','T4_RELIC']);
 const q=qmap([['T4_MAIN_SWORD','Caerleon',6000,null],['T4_MAIN_SWORD@1','Lymhurst',20000,null],['T4_RUNE','Caerleon',30,null],['T4_SOUL','Martlock',60,null],
  ['T4_MAIN_SWORD@1','Black Market',null,17000],['T4_MAIN_SWORD@2','Black Market',null,40000]]);
 const r=enchantOpportunities({bases:['T4_MAIN_SWORD'],counts,quotes:q,demand:new Map([['T4_MAIN_SWORD@1',172],['T4_MAIN_SWORD@2',40]]),config:{tax:4,minMarginPct:5},now});
 const one=r.rows.find(x=>x.id==='T4_MAIN_SWORD@1');assert.equal(one.from,0);assert.equal(one.cost,6000+288*30);assert.equal(one.units,Math.floor(172*3*.06));
 const two=r.rows.find(x=>x.id==='T4_MAIN_SWORD@2');assert.equal(two.cost,6000+288*30+288*60,'.0 + runas + almas es más barato que comprar .1');
 assert(r.skipped.some(x=>x.id==='T4_MAIN_SWORD@3'));});

test('Granja: Premium dobla la cosecha y el Focus devuelve la semilla',()=>{
 const farm=extra.farm.filter(f=>f.crop==='T1_CARROT'||f.crop==='T6_POTATO');
 const q=qmap([['T1_FARM_CARROT_SEED','Lymhurst',2500,null],['T1_CARROT','Lymhurst',100,90],['T6_FARM_POTATO_SEED','Martlock',20000,null],['T6_POTATO','Lymhurst',1500,1400]]);
 const free=farmRows({farm,quotes:q,config:{premium:false,plots:1,tax:8},now}),prem=farmRows({farm,quotes:q,config:{premium:true,plots:1,tax:4},now});
 const c0=free.rows.find(x=>x.crop==='T1_CARROT'),c1=prem.rows.find(x=>x.crop==='T1_CARROT');
 assert.equal(c0.harvest,9*4.5);assert.equal(c1.harvest,9*9);
 assert(Math.abs(c0.profitNoFocus-(9*4.5*100*(1-.08-.025)-9*2500))<1e-6,'zanahoria sin Focus: se recompra toda la semilla');
 assert(Math.abs(c0.profitFocus-9*4.5*100*(1-.08-.025))<1e-6);
 assert(c1.silverPerFocus>0);assert.equal(salePrice(q,'T6_POTATO',{city:'Lymhurst',mode:'instant',tax:4,now}).net,1400*.96);});

test('Navegación, función del oro y caché',()=>{
 const html=readFileSync('index.html','utf8'),sw=readFileSync('sw.js','utf8'),toml=readFileSync('netlify.toml','utf8'),gold=readFileSync('netlify/functions/gold.mjs','utf8');
 for(const r of ['prices','enchant','business','farm'])assert(html.includes(`data-route="${r}" id="nav-${r}"`),r);
 assert(toml.includes('from = "/api/gold"'));assert(gold.includes("west.albion-online-data.com"));assert(!/europe|east\./.test(gold));
 for(const f of ['/src/business-page.js','/src/prices-page.js','/src/enchant-page.js','/src/farm-page.js','/assets/data/game-extra.json'])assert(sw.includes(f),f);
 const main=readFileSync('src/main.js','utf8');assert(main.includes('id=\\"plan-to-business\\"')||main.includes('id="plan-to-business"'));});
