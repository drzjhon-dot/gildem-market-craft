import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blackMarketFlips} from '../src/flips.js';
import {animalRows,kitchenRows,cheapestFood,isFarmProduct} from '../src/island.js';

const extra=JSON.parse(readFileSync(new URL('../assets/data/game-extra.json',import.meta.url),'utf8'));
const now=Date.parse('2026-11-12T12:00:00Z');
const q=(entries,ageH=1)=>new Map(entries.map(([id,city,ask,bid])=>[id+'|'+city,{id,city,...(ask?{ask:{price:ask,time:now-ageH*3600e3}}:{}),...(bid?{bid:{price:bid,time:now-ageH*3600e3}}:{})}]));

test('Datos de la isla: animales, nutrición y recetas de cocina del juego',()=>{
 const chicken=extra.animals.find(a=>a.baby==='T3_FARM_CHICKEN_BABY');
 assert.equal(chicken.grown,'T3_FARM_CHICKEN_GROWN');assert.equal(chicken.favorite,'T3_WHEAT');assert.equal(chicken.uses[0].id,'T3_MEAT');assert.equal(chicken.uses[0].amount,18);
 assert.equal(chicken.product.id,'T3_EGG');assert.equal(Math.round(chicken.growHours*3600/chicken.secondsPerNutrition),864);
 const horse=extra.animals.find(a=>a.baby==='T4_FARM_HORSE_BABY');assert(horse.uses.some(u=>u.id==='T4_MOUNT_HORSE'&&u.mats[0].id==='T4_LEATHER'&&u.mats[0].count===20));
 assert.equal(extra.nutrition.T6_POTATO.n,48);assert(extra.kitchen.length>=90);
 assert.deepEqual(extra.kitchen.find(k=>k.id==='T4_POTION_HEAL').mats,[{id:'T4_BURDOCK',count:24},{id:'T3_EGG',count:6}]);
 assert(isFarmProduct('T3_EGG')&&!isFarmProduct('T6_ALCOHOL'));});

test('Flips: Caerleon → Mercado Negro, sin datos viejos y con tope por volumen',()=>{
 const quotes=q([['A','Caerleon',100000,90000],['A','Black Market',null,130000],['B','Caerleon',100000,null],['B','Black Market',null,101000],['C','Lymhurst',50000,null],['C','Black Market',null,90000]]);
 const r=blackMarketFlips({ids:['A','B','C'],quotes,demand:new Map([['A',50]]),config:{tax:4,minMarginPct:5,minProfit:1000,sharePct:10},now});
 assert.deepEqual(r.rows.map(x=>x.id),['A']);const a=r.rows[0];
 assert.equal(a.city,'Caerleon');assert.equal(a.profit,130000*.96-100000);assert.equal(a.units,5);
 assert(a.order&&a.order.buy===90001&&a.order.profit>a.profit,'la orden de compra es más barata');
 const withRoyals=blackMarketFlips({ids:['C'],quotes,config:{buyCities:['Caerleon','Lymhurst'],tax:4,transportPct:3,minMarginPct:5,minProfit:1000},now});
 assert.equal(withRoyals.rows[0].city,'Lymhurst');assert(withRoyals.rows[0].risky);assert.equal(withRoyals.rows[0].cost,50000*1.03);
 const stale=blackMarketFlips({ids:['A'],quotes:q([['A','Caerleon',100000,null],['A','Black Market',null,130000]],10),config:{maxAgeHours:6},now});
 assert.equal(stale.rows.length,0);});

test('Animales: comida más barata por nutrición (favorito ×2), Premium y mejor salida',()=>{
 const chicken=extra.animals.find(a=>a.baby==='T3_FARM_CHICKEN_BABY');
 const quotes=q([['T3_FARM_CHICKEN_BABY','Lymhurst',6000,null],['T3_WHEAT','Lymhurst',100,null],['T1_CARROT','Lymhurst',60,null],
  ['T3_FARM_CHICKEN_GROWN','Lymhurst',9000,null],['T3_MEAT','Lymhurst',800,null],['T3_EGG','Lymhurst',150,null]]);
 const food=cheapestFood({nutrition:extra.nutrition,quotes,category:'plants',favorite:'T3_WHEAT',favoriteBonus:1,cities:['Lymhurst'],now});
 assert.equal(food.id,'T3_WHEAT','100/96 nutrición < 60/48');
 const r=animalRows({animals:[chicken],nutrition:extra.nutrition,quotes,config:{premium:true,focus:true,tax:4,listingFee:2.5,sellCity:'Lymhurst'},now});
 const x=r.rows[0];assert.equal(x.best.kind,'meat');assert.equal(x.back,1);
 assert(Math.abs(x.nutritionNeeded-864)<0.1);assert(Math.abs(x.foodCost-x.nutritionNeeded*100/96)<1e-6);assert.equal(x.days,44/24/2);
 assert(Math.abs(x.perAnimal-(18*800*(1-.065)-x.foodCost))<1e-6);
 assert(x.product&&x.product.id==='T3_EGG');
 const free=animalRows({animals:[chicken],nutrition:extra.nutrition,quotes,config:{premium:false,focus:false,tax:8,sellCity:'Lymhurst'},now}).rows[0];
 assert.equal(free.back,.6);assert.equal(free.days,44/24);});

test('Cocina y alquimia: retorno, ingredientes raros sin retorno y valor de la cosecha',()=>{
 const heal=extra.kitchen.find(k=>k.id==='T4_POTION_HEAL');
 const quotes=q([['T4_POTION_HEAL','Lymhurst',2000,null],['T4_BURDOCK','Lymhurst',150,null],['T3_EGG','Lymhurst',120,null]]);
 const r=kitchenRows({kitchen:[heal],quotes,config:{returnPct:15.2,tax:4,listingFee:2.5,sellCity:'Lymhurst'},now});
 const x=r.rows[0],cost=(24*150+6*120)*(1-.152);assert(Math.abs(x.cost-cost)<1e-6);
 assert(Math.abs(x.revenue-5*2000*(1-.065))<1e-6);assert(Math.abs(x.profit-(x.revenue-cost))<1e-6);
 assert(x.upliftPct>0,'convertir la cosecha en poción vale más que venderla cruda');});

test('Pestañas: Flips e Isla enlazadas y en caché',()=>{
 const html=readFileSync('index.html','utf8'),sw=readFileSync('sw.js','utf8'),main=readFileSync('src/main.js','utf8');
 assert(html.includes('data-route="flips" id="nav-flips"'));assert(html.includes('<strong>Isla</strong>'));
 for(const f of ['/src/flips.js','/src/flips-page.js','/src/island.js','/assets/tabs/flips-tab.svg'])assert(sw.includes(f),f);
 assert(main.includes("flipsPage=createFlipsPage(pageCtx('flips'))"));});
