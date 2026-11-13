import test from 'node:test';
import assert from 'node:assert/strict';
import {prudentDailyVolume,prudentListingCapacity,volumeTrend} from '../core/market-volume.js';
import {limitRowsByMaterialVolume} from '../core/procurement-liquidity.js';
const hist=(daily,days=10)=>({observations:days,activeDays:days,observedDaily:daily,medianPrice:100});
const row=(id,qty=8,profit=100)=>({id,city:'Martlock',qty,profit,capitalPerUnit:1000,materials:[{id:'T5_METALBAR',city:'Martlock',count:4,used:2,unitPrice:105}]});
test('14d and 7d volume: never extrapolates rising demand',()=>{
 assert.equal(prudentDailyVolume(hist(100),hist(200)),100);
 assert.equal(prudentDailyVolume(hist(100),hist(40)),40);
 assert.equal(prudentListingCapacity({activity:hist(100),activity7:hist(40),craftAmount:2},.10),2);
 assert.equal(prudentDailyVolume(null,null),null);
 assert.equal(volumeTrend(hist(100),hist(40)),'Rotación observada a la baja');
});
test('shared raw material cap limits total spending across all crafted objects',()=>{
 const data=new Map([['T5_METALBAR|Martlock',{d14:hist(1000),d7:hist(500)}]]);
 const result=limitRowsByMaterialVolume([row('A',10,200),row('B',10,100)],data,{fraction:.08});
 // 8% of 500 = 40 bars, each craft uses 4 bars.
 assert.equal(result.rows.reduce((s,r)=>s+r.qty*4,0),40);
 assert.equal(result.rows.find(x=>x.id==='A').qty,10);
 assert.equal(result.rows.find(x=>x.id==='B').qty,0);
 assert.equal(result.changed.length,1);
});
test('missing history is uncertainty, so only one initial craft per route',()=>{
 const result=limitRowsByMaterialVolume([row('A',15)],new Map());
 assert.equal(result.rows[0].qty,1);
 assert.equal(result.unverified.length,1);
});
test('abnormally expensive inputs trigger a provisional quantity warning',()=>{
 const data=new Map([['T5_METALBAR|Martlock',{d14:hist(1000),d7:hist(1000)}]]);
 const expensive=row('A');expensive.materials[0].unitPrice=180;
 const result=limitRowsByMaterialVolume([expensive],data);
 assert.equal(result.rows[0].qty,1);
 assert.equal(result.priceAlerts.length,1);
});
test('refining materials are expanded to underlying purchase requirements',()=>{
 const data=new Map([['T5_ORE|Martlock',{d14:hist(500),d7:hist(250)}]]);
 const special={id:'A',city:'Martlock',qty:10,profit:200,capitalPerUnit:1000,materials:[{id:'T5_METALBAR',city:'Martlock',count:3,used:2,refining:{rrr:24.8,city:'Martlock',inputs:[{id:'T5_ORE',city:'Martlock',count:2,unitPrice:80}]}}]};
 const result=limitRowsByMaterialVolume([special],data,{fraction:.08});
 // 20 raw ore volume budget; 6 raw ore per craft => 3 crafts.
 assert.equal(result.rows[0].qty,3);
 assert.equal(result.verified,1);
});

test('scoring favors well-observed rotation over unknown turnover',async()=>{
 const {liquidityWeight}=await import('../core/market-volume.js');
 assert(liquidityWeight(hist(500),hist(300))>liquidityWeight(null,null));
 assert(liquidityWeight(hist(5),hist(2))<liquidityWeight(hist(500),hist(300)));
});
