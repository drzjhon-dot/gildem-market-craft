import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {enrichTrends} from '../src/market-trends.js';
import {settings,DEFAULTS} from '../src/planner.js';
const cfg=(extra={})=>({...DEFAULTS,goal:'silver',budget:1_000_000,minRoiPct:0,stressGuard:false,
 tiers:[4,5,6,7,8],enchants:[0,1,2,3],saleDays:7,style:'dynamic',useBudget:true,
 maxCapitalSharePct:50,maxTierSharePct:60,maxEnchantSharePct:72,maxFamilySharePct:65,...extra});
const mk=(id,city='Black Market',daily=150,price=22000,gross=4000,cost=7000)=>({id,city,routeKey:id+'|'+city,craftCity:'Martlock',
 maxCrafts:80,craftAmount:1,history:{id,city,quality1DailyUnits:daily,quality1ActiveDays:7,days:7,averageDailyUnits:daily},
 grossCapitalPerCraft:gross,expectedCostPerCraft:cost,marketFee:0,planningPrice:price,expectedProfitPerCraft:price-cost,
 expectedFamePerCraft:id.startsWith('T8')?15000:1200,returnPct:24.8,materials:[],focusPerCraft:0,qty:0});
const date='2026-11-11';
test('Tendencia: un pico de 7 días no aumenta artificialmente la capacidad Q1 y estabiliza precio',()=>{
 const x={id:'T8_MAIN_MACE',city:'Black Market',days:7,to:date,quality1DailyUnits:18,quality1AveragePrice:500000};
 const y={...x,days:14,quality1DailyUnits:6,quality1AveragePrice:300000};
 const a=enrichTrends([x],[y]);assert.equal(a.compared,1);assert.equal(a.fast,1);
 assert.equal(a.rows[0].effectiveQuality1DailyUnits,6*1.15);
 assert.equal(a.rows[0].stabilizedQuality1Price,300000*1.15);
});
test('Tendencia: caída de actividad Q1 y ausencia de historial largo se informan sin inventar unidades',()=>{
 const now={id:'T6_MAIN_MACE',city:'Martlock',days:7,to:date,quality1DailyUnits:6};
 const old={...now,days:14,quality1DailyUnits:20};
 const r=enrichTrends([now,{...now,id:'T7_MAIN_MACE'}],[old]);
 assert.equal(r.falling,1);assert.equal(r.rows[0].effectiveQuality1DailyUnits,6);assert.equal(r.rows[1].trend,'sin referencia');
});
test('Inputs de controles nuevos validados y disponibles en Craft Planner, nunca en Flips',()=>{
 const main=readFileSync('src/main.js','utf8');const html=readFileSync('index.html','utf8');
 for(const x of ['data-cfg="maxTierSharePct"','data-cfg="maxEnchantSharePct"','data-cfg="maxFamilySharePct"','data-cfg="trendAnalysis"','Comparativa de asignación'])assert(main.includes(x),x);
 assert.equal((html.match(/class="nav-link[^\"]*" data-route=/g)||[]).length,10);
 assert.throws(()=>settings({...cfg(),maxTierSharePct:105}),/Límites/);
});

