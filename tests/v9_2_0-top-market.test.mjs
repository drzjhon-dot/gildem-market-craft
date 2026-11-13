import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {aggregateTopMarket,rankTopMarket,branchForItem,TOP_SORTS} from '../core/top-market.js';
const now=Date.UTC(2026,10,10,12);
const day=86400000;
const series=pts=>pts.map(([ago,count,price])=>({timestamp:new Date(now-ago*day).toISOString(),item_count:count,avg_price:price}));

test('agrega por objeto y ciudad: promedio sobre la ventana y precio ponderado por volumen',()=>{
 const rows=[
  {item_id:'T4_BAG',location:'Caerleon',quality:1,data:series([[1.5,100,2000],[2.5,50,4000],[10,999,100]])},
  {item_id:'T4_BAG',location:'Lymhurst',quality:1,data:series([[2,70,1000]])},
  {item_id:'T5_BAG',location:'Caerleon',quality:1,data:series([[20,500,900]])},
 ];
 const out=aggregateTopMarket(rows,{days:7,now});
 const bag=out.find(x=>x.id==='T4_BAG'&&x.city==='Caerleon');
 assert(bag);
 assert.equal(bag.totalUnits,150,'solo se incluyen días UTC completos dentro de la ventana de 7');
 assert(Math.abs(bag.dailyAmount-150/7)<1e-9);
 assert(Math.abs(bag.unitPrice-(100*2000+50*4000)/150)<1e-6,'precio medio ponderado por unidades');
 assert(Math.abs(bag.dailySilver-bag.dailyAmount*bag.unitPrice)<1e-6);
 assert.equal(bag.activeDays,2);
 assert.equal(out.find(x=>x.id==='T5_BAG'),undefined,'sin movimientos dentro de la ventana no aparece');
});
test('ranking: ordena por silver, unidades o precio, filtra ciudades y limita',()=>{
 const entries=[
  {id:'A',city:'Caerleon',dailyAmount:10,dailySilver:900,unitPrice:90},
  {id:'B',city:'Black Market',dailyAmount:100,dailySilver:500,unitPrice:5},
  {id:'C',city:'Martlock',dailyAmount:1,dailySilver:2000,unitPrice:2000},
 ];
 assert.deepEqual(rankTopMarket(entries,{sortBy:'silver'}).map(x=>x.id),['C','A','B']);
 assert.deepEqual(rankTopMarket(entries,{sortBy:'amount'}).map(x=>x.id),['B','A','C']);
 assert.deepEqual(rankTopMarket(entries,{sortBy:'price',limit:2}).map(x=>x.id),['C','A']);
 assert.deepEqual(rankTopMarket(entries,{cities:['Black Market']}).map(x=>x.id),['B']);
 assert.equal(TOP_SORTS.silver.field,'dailySilver');
});
test('branchForItem: rama concreta, nunca una agregada, con su mercado',()=>{
 const boots=branchForItem('T5_SHOES_PLATE_SET1@1');
 assert.equal(boots.key,'boots_plate');assert.equal(boots.market,'black');
 const potion=branchForItem('T4_POTION_HEAL');
 assert(potion.key.startsWith('potion_')&&potion.key!=='potion_all');assert.equal(potion.market,'royal');
 assert.equal(branchForItem('T4_SOMETHING_UNKNOWN'),null);
});
test('la app tiene la página Top mercado cableada a la calculadora',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 for(const t of ["if(state.page==='topmercado')topMarketPage();","data-top-cal","calcAddItem(topCal.dataset.topCal,1)","Agregar a Calculadora","aggregateTopMarket(res.rows","rankTopMarket(snap.entries"])assert(app.includes(t),t);
 assert(!app.includes('data-top-plan'),'el botón Planificar fue sustituido');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert(html.includes('data-nav="topmercado"'));
 assert(readFileSync(new URL('../sw.js',import.meta.url),'utf8').includes('./core/top-market.js'));
});
