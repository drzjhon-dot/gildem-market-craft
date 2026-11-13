import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {aggregateTopMarket} from '../core/top-market.js';
import {sharedTopCraftHistory,tierTopAudit} from '../core/top-craft-bridge.js';
import {chosenDemandIds} from '../core/demand-first.js';
import {allocatePortfolioV6} from '../core/allocator-v6.js';
import {validateCraftPlan,variantParts,portfolioSettings} from '../core/craft-plan-controls.js';
const NOW=Date.UTC(2026,10,11,16),d=86400000;
const row=(id,tier,quality,count,active=7)=>({item_id:id,location:'Black Market',quality,
 data:Array.from({length:active},(_,i)=>({timestamp:new Date(Date.UTC(2026,10,10-i)).toISOString(),item_count:count,avg_price:10000*tier*quality}))});
test('Top y crafting comparten 14 días completos, suman las 5 calidades SIN contar el libro dos veces',()=>{
 const id='T7_MAIN_MACE',rows=[row(id,7,1,10),row(id,7,2,7),row(id,7,3,3),row(id,7,4,2),row(id,7,5,1)];
 rows.push({...rows[0],data:[...rows[0].data]}); // duplicated cache result
 rows[1].data[0].timestamp=rows[1].data[0].timestamp.replace(/Z$/,''); // AODP timestamp UTC sin Z
 const actual=sharedTopCraftHistory(rows,{now:NOW,days:14});
 const top=aggregateTopMarket(rows,{now:NOW,days:14});
 assert.equal(actual.entries[0].dailyAmount,top[0].dailyAmount);
 assert.equal(actual.entries[0].dailyAmount,7*(10+7+3+2+1)/14);
 assert.equal(actual.topByMarket.get(id+'|Black Market').normalDaily,7*10/14);
 assert.equal(actual.qualityVolumes.get(id+'|Black Market')[2],7*7/14);
 assert.equal(actual.normalHistory.get(id+'|Black Market').length,7);
 assert(actual.normalHistory.get(id+'|Black Market').every(x=>String(x.timestamp).endsWith('Z')));
 assert.equal(actual.entries[0].activeDays,7);
});
test('La cobertura histórica parcial reparte la muestra entre T4–T8 y encantamientos',()=>{
 const ids=[];
 for(let t=4;t<=8;t++)for(let e=0;e<=3;e++)for(let i=0;i<15;i++)ids.push(`T${t}_MAIN_MACE_VARIANT${i}${e?'@'+e:''}`);
 const chosen=chosenDemandIds(ids,40);
 assert.equal(chosen.length,40);
 assert.deepEqual([...new Set(chosen.map(x=>variantParts(x).tier))].sort(),[4,5,6,7,8]);
 assert.deepEqual([...new Set(chosen.map(x=>variantParts(x).enchant))].sort(),[0,1,2,3]);
});
test('El diagnóstico muestra tiers vendidos en Top aunque el craft los excluya por rentabilidad',()=>{
 const r4=row('T4_MAIN_MACE',4,1,100),r7=row('T7_MAIN_MACE',7,1,40),r8=row('T8_MAIN_MACE',8,1,12);
 const data=sharedTopCraftHistory([r4,r7,r8],{now:NOW});
 const audit=tierTopAudit({ids:[r4.item_id,r7.item_id,r8.item_id],topEntries:data.entries,
  routes:[{id:r4.item_id,city:'Black Market'},{id:r7.item_id,city:'Black Market'},{id:r8.item_id,city:'Black Market'}],
  viable:[{id:r4.item_id,city:'Black Market'},{id:r7.item_id,city:'Black Market'}],
  rejected:[{id:r8.item_id,city:'Black Market',reasons:['pérdida en escenario conservador']}],
  plan:[{id:r4.item_id,city:'Black Market',qty:2},{id:r7.item_id,city:'Black Market',qty:1}],
  tiers:[4,7,8],market:'black'});
 assert.equal(audit.length,3);assert.equal(audit[2].tier,8);assert.equal(audit[2].observed,1);
 assert.equal(audit[2].eligible,0);assert.match(audit[2].reason,/pérdida en escenario conservador/);
 assert.equal(audit[1].picked,1);
});
function fixture({budget=30e6,negativeStressTier=null}={}){
 const routes=[];
 for(const t of [4,5,6,7,8])for(const e of [0,1]){
  const id=`T${t}_MAIN_MACE${e?'@1':''}`,cap=({4:14000,5:40000,6:150000,7:700000,8:2400000}[t])*(e?1.5:1);
  const daily=({4:500,5:420,6:300,7:120,8:30}[t])*(e?.48:1);
  routes.push({id,city:'Black Market',craftCity:'Thetford',mode:'listed',capitalPerUnit:cap,cost:cap*.75,profit:cap*.2,stressProfit:t===negativeStressTier?-50:cap*.11,sell:cap*1.25,
   confidence:{score:84},activity:{observations:14,observedDaily:daily,coverage:1,medianPrice:cap*1.1},activity7:{observations:7,count:daily*7,observedDaily:daily,coverage:1},
   demandDaily:daily,craftFame:1000*t*t*(e?1.5:1),qualityFactor:1,returnRate:24.8,focusPerUnit:0,craftAmount:1,materials:[]});
 }
 return routes;
}
test('Simulador Black: la cartera aprovecha T6, T7 y T8 cuando hay margen, actividad y presupuesto',()=>{
 const routes=fixture(),budget=30_000_000;
 for(const fameWeight of [0,.5,1]){
  const r=allocatePortfolioV6(routes,budget,{goal:'balanced',useAll:true,horizonDays:7,capFraction:.08,intelligent:true,bulkMode:true,saturation:2,fameWeight,maxPerItemFraction:.2,maxVariants:80,targetDifferentItems:20,diversityLanes:true,diversityWeight:.12});
  const found=[...new Set(r.rows.map(x=>variantParts(x.id).tier))];
  assert([6,7,8].every(t=>found.includes(t)),'tiers viables 6-8 ausentes: '+JSON.stringify(found));
  assert(r.rows.every(x=>x.qty<=x.maxCrafts&&x.stressProfit>0));
  const check=validateCraftPlan(r.rows,{tiers:[4,5,6,7,8],enchants:[0,1],ids:routes.map(x=>x.id),budget,totalCost:r.totalCost,market:'black'});
  assert(check.ok,check.problems.join(' | '));
  console.log('SIMULADOR_TOP6',JSON.stringify({goal:fameWeight,tiers:found,capital:r.totalCost,items:r.rows.length}));
 }
});
test('Simulador prudente: una receta T8 con pérdida no se introduce para forzar variedad',()=>{
 const routes=fixture({negativeStressTier:8}).filter(x=>x.stressProfit>0);
 const r=allocatePortfolioV6(routes,30_000_000,{goal:'balanced',useAll:true,horizonDays:7,capFraction:.05,intelligent:true,bulkMode:true,saturation:1,fameWeight:1,maxPerItemFraction:.2,maxVariants:80,targetDifferentItems:20,diversityLanes:true});
 assert(r.rows.every(x=>variantParts(x.id).tier!==8));assert(r.totalCost<=30_000_000);
});
test('Los dos generadores usan las consultas de Top Mercado y muestran motivos de descarte por tier',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.equal((app.match(/await historyTopMarket\(marketHistoryIds/g)||[]).length,2);
 assert.equal((app.match(/sharedTopCraftHistory\(hist.rows\)/g)||[]).length,2);
 assert.equal((app.match(/tierTopAudit\(\{/g)||[]).length,2);
 assert(app.includes('Top Mercado vs plan · Por qué algunos tiers no aparecen'));
 assert(app.includes('qualityVolumes')===false||app.includes('sharedQuality'));
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');assert(sw.includes('top-craft-bridge.js'));
});

test('Diversificación por tier también se considera con Más silver cuando hay suficientes objetos viables',()=>{
 for(const style of [1,2,3]){
  const p=portfolioSettings({style,fameGoal:0,eligibleItems:10});
  assert.equal(p.diversityLanes,true);
  assert(p.diversityWeight>0&&p.itemFractionCeiling<=1);
 }
});
