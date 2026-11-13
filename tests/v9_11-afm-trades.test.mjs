import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAfmTradesCsv,applyTradesToPortfolios,summarizeTrades,resolveItemId,parseDate} from '../core/afm-trades.js';
import {NAMES_EN} from '../core/names-en.js';
import {recordSale,createPortfolioFromPlan} from '../core/ledger.js';
import {learnFromSales} from '../core/personal-learning.js';

const HEADER='Server,Player,Received,Type,Operation,Quality,Item,Location,Full Location,Amount,Unit Silver,Total Silver,Order Amount';
const EN=[HEADER,
 'Americas,Gildem,11/14/2026 8:20:00 PM,Order,Sell,Normal,Adept\'s Broadsword [4.1],Lymhurst,Lymhurst Market,3,15000.00,45000,5',
 'Americas,Gildem,11/15/2026 9:05:00 AM,Instant,Sell,Good,Adept\'s Broadsword [4.1],Lymhurst,Lymhurst Market,2,14500.00,29000,',
 'Americas,Gildem,11/15/2026 9:06:00 AM,Instant,Buy,Normal,Steel Bar [4.0],Fort Sterling,Fort Sterling Market,160,150.00,24000,',
 'Americas,Gildem,11/16/2026 1:00:00 PM,Order,Sell,Normal,Expert\'s Claymore [5.0],Lymhurst,Lymhurst Market,0,,0,4',
 'Europe,Gildem,11/16/2026 1:00:00 PM,Instant,Sell,Normal,Adept\'s Broadsword [4.1],Lymhurst,Lymhurst Market,1,99999.00,99999,',
 'Americas,Gildem,11/16/2026 1:00:00 PM,Instant,Sell,Normal,Mystery Thing,Lymhurst,Lymhurst Market,1,10.00,10,'].join('\n');
const ES=['Server;Player;Received;Type;Operation;Quality;Item;Location;Full Location;Amount;Unit Silver;Total Silver;Order Amount',
 'Americas;Gildem;14/11/2026 20:20:00;Order;Sell;Normal;Adept\'s Broadsword [4.1];Lymhurst;Lymhurst Market;3;15000,00;45000;5'].join('\r\n');

test('v9.11 · AFM: nombre inglés + [tier.encantamiento] → ID del juego',()=>{
 assert.equal(resolveItemId("Adept's Broadsword [4.1]",NAMES_EN),'T4_MAIN_SWORD@1');
 assert.equal(resolveItemId("Expert's Claymore [5.0]",NAMES_EN),'T5_2H_CLAYMORE');
 assert.equal(resolveItemId('T6_MAIN_SWORD@2',NAMES_EN),'T6_MAIN_SWORD@2');
 assert.equal(resolveItemId('Mystery Thing',NAMES_EN),null);
});
test('v9.11 · AFM: lee CSV en inglés (coma, mes/día, AM/PM) y en español (punto y coma, decimal con coma)',()=>{
 const a=parseAfmTradesCsv(EN,{namesEn:NAMES_EN});
 assert.equal(a.dateOrder,'mdy');assert.equal(a.trades.length,5);assert.equal(a.skipped.length,1);
 const first=a.trades[0];assert.equal(first.id,'T4_MAIN_SWORD@1');assert.equal(first.market,'Lymhurst');assert.equal(first.type,'order');assert.equal(first.orderAmount,5);
 assert.equal(new Date(first.at).getHours(),20);
 assert(a.trades.find(t=>t.expired&&t.id==='T5_2H_CLAYMORE'));
 const b=parseAfmTradesCsv(ES,{namesEn:NAMES_EN});assert.equal(b.trades[0].unit,15000);assert.equal(new Date(b.trades[0].at).getDate(),14);
 assert.equal(parseDate('03/04/2026 10:00','dmy'),new Date(2026,3,3,10).getTime());
 assert.throws(()=>parseAfmTradesCsv('a,b\n1,2',{namesEn:NAMES_EN}),/CSV de Trades/);
});
test('v9.11 · AFM: registra ventas reales en carteras compradas, una sola vez, y el motor aprende',()=>{
 const p=createPortfolioFromPlan({rows:[{id:'T4_MAIN_SWORD@1',city:'Lymhurst',craftCity:'Lymhurst',qty:4,craftAmount:1,cost:12000,capitalPerUnit:13000,sell:15500,profit:2000,taxRate:.04,setupRate:.025}]},'Espadas');
 p.started=true;p.startedAt=new Date(2026,10,1).toISOString();
 const west=parseAfmTradesCsv(EN,{namesEn:NAMES_EN}).trades.filter(t=>t.server==='Americas');
 const r1=applyTradesToPortfolios([p],west,{recordSale});
 assert.equal(r1.report.units,4,'solo caben 4 unidades en el lote');assert.equal(r1.portfolios[0].lots[0].sales.length,2);
 const sale=r1.portfolios[0].lots[0].sales[0];assert.equal(sale.price,15000);assert.equal(sale.fees,Math.round(45000*.04+45000*.025));
 const r2=applyTradesToPortfolios(r1.portfolios,west,{recordSale});assert.equal(r2.report.recorded,0);assert(r2.report.duplicates>=1);
 const learned=learnFromSales(r1.portfolios).get('T4_MAIN_SWORD@1|Lymhurst');assert.equal(learned.qtySold,4);
 const pending={...p,started:false};assert.equal(applyTradesToPortfolios([pending],west,{recordSale}).report.recorded,0);
});
test('v9.11 · AFM: resumen con precio medio, llenado de órdenes y órdenes caducadas',()=>{
 const s=summarizeTrades(parseAfmTradesCsv(EN,{namesEn:NAMES_EN}).trades.filter(t=>t.server==='Americas'));
 const sword=s.find(x=>x.id==='T4_MAIN_SWORD@1'&&x.op==='sell');assert.equal(sword.units,5);assert.equal(sword.avgPrice,(45000+29000)/5);assert.equal(sword.fillRate,3/5);
 assert.equal(s.find(x=>x.id==="T5_2H_CLAYMORE").expiredOrders,1);assert(s.find(x=>x.id==="T4_METALBAR"&&x.op==="buy"));
});
