import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverDemand,demandHistoryIndex,chosenDemandIds,listingCapacity} from '../core/demand-first.js';
import {parseMarketRanking,validMarketSnapshot,externalDaily} from '../core/external-demand.js';
import {capacityFor,allocatePortfolioV6} from '../core/allocator-v6.js';
import {patientCapacity,selectPatientRoutes} from '../core/adaptive-planner.js';
import {readFileSync} from 'node:fs';
const date=Date.now(), ymd=d=>new Date(date-d*86400000).toISOString();
function sellRows(id,city,qty){return {item_id:id,location:city,quality:1,data:Array.from({length:12},(_,i)=>({timestamp:ymd(i+1),item_count:qty,avg_price:7000}))};}
const bm='Black Market';
const popular=[
 ['T5_SHOES_PLATE_SET2',bm,3696],
 ['T6_SHOES_PLATE_SET2',bm,2401],
 ['T5_SHOES_PLATE_SET1',bm,2355],
 ['T5_SHOES_PLATE_SET3@4',bm,1]
];
function candidate(id,city,daily){return {id,city,craftCity:'Martlock',mode:'listed',sell:9000,profit:600,stressProfit:220,cost:4300,capitalPerUnit:5800,craftAmount:1,confidence:{score:75},activity:{days:14,observations:12,activeDays:12,observedDaily:daily,count:daily*14},demandDaily:daily,ageHours:2,focusPerUnit:0,materials:[],journal:null,journalBonus:0};}
test('la rama completa se investiga antes de descartar los items baratos .0',()=>{
 const ids=popular.map(x=>x[0]);assert.deepEqual(chosenDemandIds(ids),ids);
 const sample=popular.map(([id,city,qty])=>sellRows(id,city,qty));
 const index=demandHistoryIndex(sample),seen=discoverDemand(ids,index,[bm],date).byMarket;
 assert.equal(seen.get('T5_SHOES_PLATE_SET2|Black Market').daily,3696*12/14);
 assert.equal(seen.get('T6_SHOES_PLATE_SET2|Black Market').daily,2401*12/14);
 assert.equal(seen.get('T5_SHOES_PLATE_SET3@4|Black Market').daily,12/14);
});
test('los objetos con miles diarios admiten lote grande sin fabricar inventario ficticio',()=>{
 const hot=candidate('T5_SHOES_PLATE_SET2',bm,3696),slow=candidate('T5_SHOES_PLATE_SET3@4',bm,1);
 assert(listingCapacity(hot,{horizonDays:14,share:.06})>100);
 assert.equal(listingCapacity(slow,{horizonDays:14,share:.06}),1);
 assert(patientCapacity(hot,{horizonDays:14,observedShare:.06})>100);
 assert.equal(patientCapacity(slow,{horizonDays:14,observedShare:.06}),1);
 const plan=allocatePortfolioV6([hot,slow],1000000,{useAll:true,horizonDays:14,capFraction:.06,unknownCap:1});
 assert(plan.rows.some(r=>r.id===hot.id&&r.qty>10));
 assert(plan.totalCost<=1000000);
});
test('la capacidad cambia con el horizonte, y usa unidades por fabricación',()=>{
 const meal=candidate('T4_MEAL_SALAD','Lymhurst',200);meal.craftAmount=10;
 assert.equal(capacityFor(meal,.1,1,7),14);
 assert.equal(capacityFor(meal,.1,1,14),28);
 assert.equal(capacityFor(meal,.1,1,30),60);
});
test('los rankings copiados de Hub se pueden importar con item, ciudad, volumen y fuente',()=>{
 const text=`ITEM\tCIUDAD\tCATEGORÍA\tCANTIDAD DIARIA MEDIA\tVOLUMEN PLATA DIARIO\nT5_SHOES_PLATE_SET2\nBotas de caballero del experto\nT5.0\nBlack Market\nFoot Armor > Plate Boots\n3,696\t27M\t7,3K\nT6_SHOES_PLATE_SET2\nBotas de caballero del maestro\nT6.0\nBlack Market\nFoot Armor > Plate Boots\n2,401\t47,7M\t19,9K`;
 const r=parseMarketRanking(text,{source:'hub'});
 assert.equal(r.length,2);assert.equal(r[0].daily,3696);assert.equal(r[1].daily,2401);
});
test('la antigua fuente europea queda prohibida como importación numérica',()=>{
 assert.equal(parseMarketRanking('| ico/T5_SHOES_PLATE_SET2.webp | 2642 |',{source:'journal'}).length,0);
});
test('una tabla externa europea nunca afecta planes West ni siquiera si tiene IDs reales',()=>{
 const row={id:'T5_SHOES_PLATE_SET2',city:bm,daily:3696,source:'Albion Online Hub'};
 const snap={source:'hub',region:'europe',serverProof:'user-confirmed-west',observedAt:new Date(date).toISOString(),rows:[row]};
 assert.equal(validMarketSnapshot(snap,{region:'west',now:date}),false);
 assert.equal(externalDaily(snap,row.id,row.city,{region:'west',now:date}),null);
 assert.equal(externalDaily(snap,row.id,row.city,{region:'europe',now:date}),null);
 const unconfirmed={...snap,region:'west',serverProof:null};
 assert.equal(validMarketSnapshot(unconfirmed,{region:'west',now:date}),false);
 const confirmed={...snap,region:'west'};
 assert.equal(externalDaily(confirmed,row.id,row.city,{region:'west',now:date}).daily,3696);
 assert(!JSON.stringify(row).includes('sell_price'));
});
test('la interfaz conserva valor seleccionado y muestra el motivo de cantidades',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert(app.includes("chosenDemandIds(ids,450)"));
 assert(app.includes("chosenDemandIds(marketHistoryUniverse,deep?320:200)"));
 assert(app.includes('QC_HORIZON=[7,14,30]'));
 assert(app.includes("demandSource||'historial'"));
 assert(!app.includes("saveExternalMarketVolume()"));
 assert(!app.includes("externalDaily(snapshot"));
 assert(!app.includes('const marketHistoryIds=marketAuditIds(ids,preferred'));
});
