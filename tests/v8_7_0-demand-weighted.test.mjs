import test from 'node:test';
import assert from 'node:assert/strict';
import {bulkMarketCandidates,bulkItemExposureFraction} from '../core/high-volume.js';
import {allocatePortfolioV6} from '../core/allocator-v6.js';
import {listingCapacity} from '../core/demand-first.js';
import {validateIntelligentEdits} from '../core/intelligent-portfolio.js';
const mk=(d,i)=>({id:`T${4+i%4}_ITEM${i}`,city:i%3?'Black Market':'Martlock',craftCity:'Martlock',mode:'listed',
 cost:40000,capitalPerUnit:50000,profit:8000,stressProfit:3500,sell:60000,
 activity:{observations:14,count:d*14,observedDaily:d,activeDays:14,coverage:1},
 activity7:{observations:7,count:d*7,observedDaily:d,activeDays:7},
 demandDaily:d,ageHours:2,confidence:{score:85},competition:{known:false,penalty:.92},craftAmount:1});
const run=(demands,budget)=>{
 const acc=bulkMarketCandidates(demands.map(mk)).accepted;
 return allocatePortfolioV6(acc,budget,{intelligent:true,bulkMode:true,useAll:true,maxPerItemFraction:bulkItemExposureFraction(acc),
  maxVariants:65,targetDifferentItems:28,capFraction:.10,horizonDays:14});
};
test('más demanda => más unidades fabricadas (monótono) y nunca por encima de la capacidad',()=>{
 const demands=[8,20,40,80,150,300,600,1200,2500,60,100,200];
 const r=run(demands,50_000_000);
 const rows=[...r.rows].sort((a,b)=>a.demandDaily-b.demandDaily);
 for(let i=1;i<rows.length;i++)assert(rows[i].qty>=rows[i-1].qty,`${rows[i].id} (${rows[i].qty}) < ${rows[i-1].id} (${rows[i-1].qty})`);
 for(const x of r.rows)assert(x.qty<=listingCapacity(x,{horizonDays:14,share:.10}));
 const top=rows.at(-1),mid=rows.find(x=>x.demandDaily===300);
 assert(top.qty>mid.qty*3,'el objeto de 2500/día debe recibir bastante más que el de 300/día');
 assert(r.totalCost<=50_000_000);
});
test('con presupuesto escaso el capital se reparte según demanda, no a partes iguales',()=>{
 const r=run([100,100,1000,1000,10,10],5_000_000);
 const spend=d=>r.rows.filter(x=>x.demandDaily===d).reduce((a,x)=>a+x.allocation,0);
 assert(spend(1000)>spend(100)&&spend(100)>spend(10));
});
test('si la última semana cae, la capacidad baja; si sube, no se infla',()=>{
 const base=mk(100,0);
 const normal=listingCapacity(base,{horizonDays:14,share:.1});
 const falling=listingCapacity({...base,activity7:{observations:7,count:210,observedDaily:30}},{horizonDays:14,share:.1});
 const rising=listingCapacity({...base,activity7:{observations:7,count:2100,observedDaily:300}},{horizonDays:14,share:.1});
 assert(falling<normal);assert.equal(rising,normal);
});
test('las ediciones aceptan el tope proporcional a la demanda de cada ruta',()=>{
 const rows=[{id:'T4_A',city:'Martlock',qty:300,capitalPerUnit:1000,itemExposureFraction:.45},
             {id:'T5_B',city:'Thetford',qty:50,capitalPerUnit:1000,itemExposureFraction:.13}];
 assert(validateIntelligentEdits(rows,1_000_000,{itemFraction:.13,bulkMode:true}).ok===true);
 assert(validateIntelligentEdits([{...rows[0],qty:700}],1_000_000,{itemFraction:.13,bulkMode:true}).ok===false);
});
