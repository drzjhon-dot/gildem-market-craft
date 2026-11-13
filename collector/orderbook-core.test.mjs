import test from 'node:test';
import assert from 'node:assert/strict';
import {cityOf,detectScale,flattenMessage,normalizeOrder,emptyState,mergeOrders,pruneState,buildShards,shardOf} from './orderbook-core.mjs';
const now=Date.parse('2026-11-12T12:00:00Z');
const order=(id,item,loc,type,price,amount,q=1,exp='2026-11-20T00:00:00')=>({Id:id,ItemTypeId:item,LocationId:loc,QualityLevel:q,EnchantmentLevel:0,UnitPriceSilver:price,Amount:amount,AuctionType:type,Expires:exp});
test('ciudades AODP, islas y mercados desconocidos',()=>{
 assert.equal(cityOf('3003'),'Black Market');assert.equal(cityOf('0007'),'Thetford');assert.equal(cityOf('1002'),'Lymhurst');
 assert.equal(cityOf('3005-Auction2'),'Caerleon');assert.equal(cityOf('1234@island'),null);assert.equal(cityOf('9999'),null);
});
test('escala ×10.000 detectada con las propias órdenes',()=>{
 assert.equal(detectScale(Array.from({length:40},(_,i)=>({UnitPriceSilver:(1000+i)*10000}))),10000);
 assert.equal(detectScale(Array.from({length:40},(_,i)=>({UnitPriceSilver:1000+i*7}))),1);
 assert.equal(detectScale([{UnitPriceSilver:10000}]),null);
});
test('mensajes sueltos o en lote',()=>{assert.equal(flattenMessage({Orders:[order(1,'T4_BAG','3003','request',1,1)]}).length,1);assert.equal(flattenMessage(order(1,'T4_BAG','3003','request',1,1)).length,1);});
test('normalizar descarta datos inválidos',()=>{
 assert.equal(normalizeOrder(order(1,'T4_BAG','3003','request',50000000,3),10000,now).row[3],5000);
 assert.equal(normalizeOrder(order(2,'T4_BAG','9999','request',5,3),1,now),null);
 assert.equal(normalizeOrder(order(3,'T4_BAG','3003','other',5,3),1,now),null);
});
test('ventas seguras: solo cuando la misma orden reaparece con menos cantidad',()=>{
 const s=emptyState();
 mergeOrders(s,[normalizeOrder(order(10,'T6_MAIN_MACE','3003','request',70000,8),1,now)],now);
 const later=now+3600e3;
 const r=mergeOrders(s,[normalizeOrder(order(10,'T6_MAIN_MACE','3003','request',70000,5),1,later)],later);
 assert.equal(r.filledUnits,3);assert.deepEqual(s.fills['T6_MAIN_MACE|Black Market|1|r'],[[Math.floor(later/86400000),3]]);
 assert.equal(s.orders['10'][7],now,'conserva la primera vez visto');
});
test('poda: caducadas y no vistas en 72 h fuera; ventas de más de 7 días fuera',()=>{
 const s=emptyState();
 mergeOrders(s,[normalizeOrder(order(1,'T4_BAG','3003','request',1000,1,1,'2026-11-12T11:00:00'),1,now-3600e3)],now-3600e3);
 mergeOrders(s,[normalizeOrder(order(2,'T4_BAG','3003','request',1000,1),1,now-80*3600e3)],now-80*3600e3);
 mergeOrders(s,[normalizeOrder(order(3,'T4_BAG','3003','request',1000,1),1,now)],now);
 s.fills['T4_BAG|Black Market|1|r']=[[Math.floor(now/86400000)-9,5],[Math.floor(now/86400000),2]];
 assert.equal(pruneState(s,now),2);assert.deepEqual(Object.keys(s.orders),['3']);assert.equal(s.fills['T4_BAG|Black Market|1|r'].length,1);
});
test('resumen por tier con niveles agregados y ordenados',()=>{
 const s=emptyState();
 mergeOrders(s,[order(1,'T6_MAIN_MACE','3003','request',70000,3),order(2,'T6_MAIN_MACE','3003','request',70000,2),order(3,'T6_MAIN_MACE','3003','request',72000,1),
  order(4,'T6_METALBAR','3008','offer',2600,500),order(5,'T6_METALBAR','3008','offer',2500,300)].map(o=>normalizeOrder(o,1,now)),now);
 const {meta,shards}=buildShards(s,now);
 assert.deepEqual(shards.T6['T6_MAIN_MACE|Black Market|1'].r,[[72000,1],[70000,5]]);
 assert.deepEqual(shards.T6['T6_METALBAR|Martlock|1'].o,[[2500,300],[2600,500]]);
 assert.equal(meta.entries,2);assert.equal(shardOf('UNIQUE_X'),'other');
});
