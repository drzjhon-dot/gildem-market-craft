import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {enrichTrends} from '../src/market-trends.js';
import {optimizePortfolio,estimateRoute} from '../src/portfolio-engine.js';
import {allocatePlan,settings,DEFAULTS} from '../src/planner.js';
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
test('Portfolio 2.0: tres estrategias, límite de capital bruto y cero pérdidas para objetivo silver',()=>{
 const rows=[mk('T4_MAIN_MACE'),mk('T5_MAIN_MACE'),mk('T6_2H_MACE'),mk('T7_2H_FLAIL'),mk('T8_MAIN_MACE')];
 const result=optimizePortfolio(rows,cfg({budget:60000,diversify:true}));
 assert.equal(result.solutions.length,3);
 assert(result.selected.length>=2);
 assert(result.best.capital<=60000+1e-6);
 assert(result.best.profit>0);
 assert(result.selected.every(r=>estimateRoute(r,r.qty,cfg()).profit>0));
 const tiers=new Set(result.selected.map(x=>x.id.slice(0,2)));
 assert(tiers.size>=2,'debe conservar al menos dos tiers viables');
});
test('Diversidad no puede romper límites por tier, familia, encantamiento o por artículo',()=>{
 const rows=[];for(let tier=4;tier<=8;tier++)for(let ench=0;ench<=2;ench++)for(const stem of ['MAIN_MACE','2H_MACE','2H_FLAIL']){
  rows.push(mk(`T${tier}_${stem}${ench?'@'+ench:''}`,'Black Market',350,20000,3000,6500));
 }
 const c=cfg({budget:180000,maxCapitalSharePct:30,maxTierSharePct:50,maxEnchantSharePct:63,maxFamilySharePct:48});
 const out=optimizePortfolio(rows,c);
 const totals={tier:new Map(),ench:new Map(),family:new Map(),sku:new Map()};
 const add=(map,k,v)=>map.set(k,(map.get(k)||0)+v);
 for(const row of out.selected){const money=row.qty*row.grossCapitalPerCraft;
  const tier=Number(row.id[1]),ench=Number(row.id.split('@')[1]||0),stem=row.id.replace(/^T\d+_/,'').replace(/@\d+/,'');
  add(totals.tier,tier,money);add(totals.ench,ench,money);add(totals.family,stem,money);add(totals.sku,row.id,money);
 }
 for(const [field,limit] of [['tier',50],['ench',63],['family',48],['sku',30]])
  for(const money of totals[field].values())assert(money<=c.budget*limit/100+.1,field+' cap broken');
 assert(out.best.capital<=c.budget);
});
test('Multi-ciudad: un objeto puede ir a dos destinos, sujeto al mismo máximo por SKU',()=>{
 const rows=[mk('T6_MAIN_MACE','Black Market'),mk('T6_MAIN_MACE','Lymhurst')];
 const c=cfg({budget:60000,tiers:[6],maxCapitalSharePct:35,diversify:false});
 const out=optimizePortfolio(rows,c);
 assert(out.selected.every(x=>x.city==='Black Market'||x.city==='Lymhurst'));
 assert(out.selected.reduce((n,r)=>n+r.qty*r.grossCapitalPerCraft,0)<=60000*.35+.1);
});
test('Estilo prudente y dinámico cambian de verdad el techo de crafts',()=>{
 const row=mk('T5_MAIN_MACE','Black Market',800,80000,1000,12000);
 const prudent=optimizePortfolio([row],cfg({budget:100000,tiers:[5],enchants:[0],diversify:false,style:'prudent',useBudget:false}));
 const dynamic=optimizePortfolio([row],cfg({budget:100000,tiers:[5],enchants:[0],diversify:false,style:'dynamic',useBudget:false}));
 assert(dynamic.best.capital>prudent.best.capital,`prudent ${prudent.best.capital}, dynamic ${dynamic.best.capital}`);
});
test('Capital no inventado: falta de candidatos significa plan vacío sin silver invertido',()=>{
 const out=allocatePlan({candidates:[],config:cfg()});
 assert.equal(out.rows.length,0);assert.equal(out.summary.totalProfit,0);assert.equal(out.summary.capitalReserved,0);
 assert.equal(out.scenarioComparisons.length,3);
});
test('Inputs de controles nuevos validados y disponibles en Craft Planner, nunca en Flips',()=>{
 const main=readFileSync('src/main.js','utf8');const html=readFileSync('index.html','utf8');
 for(const x of ['data-cfg="maxTierSharePct"','data-cfg="maxEnchantSharePct"','data-cfg="maxFamilySharePct"','data-cfg="trendAnalysis"','Comparativa de asignación'])assert(main.includes(x),x);
 assert.equal((html.match(/class="nav-link[^\"]*" data-route=/g)||[]).length,3);
 assert.throws(()=>settings({...cfg(),maxTierSharePct:105}),/Límites/);
});
