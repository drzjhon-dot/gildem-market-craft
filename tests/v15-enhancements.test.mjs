import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {quoteMap} from '../src/market.js';
import {buildCandidates,allocatePlan,settings,DEFAULTS} from '../src/planner.js';
import {batchCalculate} from '../src/batch-calculator.js';
const now=Date.parse('2026-11-11T21:00:00Z'),date=new Date(now-3600000).toISOString();
const quoted=(id,city,sell,buy=0)=>({item_id:id,city,quality:1,sell_price_min:sell,sell_price_min_date:date,buy_price_max:buy,buy_price_max_date:date});
const recipe=tier=>({city:'Martlock',amountCrafted:1,materials:[{id:`T${tier}_METALBAR`,count:16,ret:true},{id:`T${tier}_PLANKS`,count:8,ret:true}]});
const history=(id,day,price,days=6)=>({id,city:'Black Market',averageDailyUnits:day,quality1DailyUnits:day,quality1ActiveDays:days,activeDays:days,days:7,averageUnitPrice:price,quality1AveragePrice:price});
const cfg=(extra={})=>({...DEFAULTS,budget:1_000_000,tiers:[8],enchants:[0],minRoiPct:5,stressGuard:false,...extra});

test('18 compras/semana Q1 en T8 se analizan y permiten UNA fabricación prudente cuando tiene margen',()=>{
 const id='T8_MAIN_MACE',rec={[id]:recipe(8)};
 const quotes=quoteMap([quoted('T8_METALBAR','Martlock',1100),quoted('T8_PLANKS','Lymhurst',700),quoted(id,'Black Market',0,60000)]);
 const h=[history(id,18/7,60000)];
 const c=cfg({diversify:true,tiers:[8],maxCapitalSharePct:5});
 const found=buildCandidates({top:h,recipes:rec,quotes,config:c,selectedMarkets:['Black Market'],now});
 assert.equal(found.candidates.length,1,JSON.stringify(found.rejectedSamples));
 assert(found.candidates[0].maxCrafts>=1);
 const plan=allocatePlan({...found,config:c});
 assert(plan.rows.some(x=>x.id===id&&x.qty>=1),'tier reservado pese al límite de concentración del SKU');
 assert(plan.summary.capitalReserved<=c.budget);
});

test('sin Q1, la venta aparente de calidades 2–5 no se confunde con demanda del planner y deja explicación',()=>{
 const id='T8_MAIN_MACE',rec={[id]:recipe(8)};
 const quotes=quoteMap([quoted('T8_METALBAR','Martlock',1100),quoted('T8_PLANKS','Lymhurst',700),quoted(id,'Black Market',0,60000)]);
 const h=[{...history(id,18/7,60000),quality1DailyUnits:0,quality1ActiveDays:0}];
 const found=buildCandidates({top:h,recipes:rec,quotes,config:cfg(),selectedMarkets:['Black Market'],now});
 assert.equal(found.candidates.length,0);
 assert.match(found.rejectedSamples[0].reason,/calidad 1/i);
});

test('modo Fama autoriza pérdida acotada y modo Silver rechaza ese mismo item',()=>{
 const id='T8_MAIN_MACE',rec={[id]:recipe(8)};
 const quotes=quoteMap([quoted('T8_METALBAR','Martlock',1300),quoted('T8_PLANKS','Lymhurst',1000),quoted(id,'Black Market',0,20000)]);
 const h=[history(id,18/7,20000)];
 const silver=buildCandidates({top:h,recipes:rec,quotes,config:cfg({goal:'silver'}),selectedMarkets:['Black Market'],now});
 assert.equal(silver.candidates.length,0);
 const fameCfg=cfg({goal:'fame',diversify:true,fameLossBudgetPct:2});
 const found=buildCandidates({top:h,recipes:rec,quotes,config:fameCfg,selectedMarkets:['Black Market'],now});
 assert.equal(found.candidates.length,1,JSON.stringify(found.rejectedSamples));
 const plan=allocatePlan({...found,config:fameCfg});
 assert(plan.rows.length>=1,'fame puede aceptar una ruta de pérdida');
 assert(plan.rows[0].totalProfit<0);
 assert(plan.summary.estimatedLosses<=fameCfg.budget*.02+1e-6);
 assert(plan.summary.capitalReserved<=fameCfg.budget);
 assert(plan.warnings.some(x=>x.includes('pérdida')));
 assert.throws(()=>settings({...fameCfg,fameLossBudgetPct:31}),/Límites/);
});

test('múltiples tiers y encantamientos reciben muestras distintas antes de llenar una SKU',()=>{
 const ids=['T6_MAIN_MACE','T6_MAIN_MACE@1','T6_MAIN_MACE@2','T7_MAIN_MACE','T8_MAIN_MACE'];
 const recipes=Object.fromEntries(ids.map(id=>[id,recipe(Number(id[1]))]));
 const quotedResources=[6,7,8].flatMap(t=>[quoted(`T${t}_METALBAR`,'Martlock',800),quoted(`T${t}_PLANKS`,'Lymhurst',500)]);
 const quotes=quoteMap([...quotedResources,...ids.map(id=>quoted(id,'Black Market',0,70000))]);
 const h=ids.map(id=>history(id,18/7,70000));
 const c=cfg({budget:5_000_000,tiers:[6,7,8],enchants:[0,1,2],diversify:true});
 const found=buildCandidates({top:h,recipes,quotes,config:c,selectedMarkets:['Black Market'],now});
 const p=allocatePlan({...found,config:c});
 assert.equal(found.candidates.length,5,JSON.stringify(found.rejectedSamples));
 assert(p.rows.some(x=>x.id==='T8_MAIN_MACE'));
 assert(new Set(p.rows.map(x=>Number(x.id[1]))).size>=3);
 assert(p.rows.some(x=>x.id.endsWith('@1')));
 assert(p.rows.some(x=>x.id.endsWith('@2')));
});

test('diarios de mismo tier/tipo se agrupan en una única fila opcional sin falsear profit de crafting',()=>{
 const ids=['T6_MAIN_MACE','T6_2H_MACE'];
 const recipes=Object.fromEntries(ids.map(id=>[id,recipe(6)]));
 const q=quoteMap([quoted('T6_METALBAR','Martlock',500),quoted('T6_PLANKS','Lymhurst',400),
  ...ids.map(id=>quoted(id,'Black Market',0,66000)),quoted('T6_JOURNAL_WARRIOR_EMPTY','Martlock',1500)]);
 const result=batchCalculate({items:ids.map(id=>({id,qty:2})),recipes,quotes:q,config:cfg({tiers:[6]}),now});
 const journals=result.materials.filter(x=>x.journal);
 assert.equal(journals.length,1);
 assert.equal(journals[0].tier,6);
 assert.equal(journals[0].usedBy.length,2);
 assert.equal(journals[0].total,journals[0].buy*1500);
 assert.equal(result.totals.journalCost,journals[0].total);
 assert(result.totals.buyCapital<result.totals.buyCapital+result.totals.journalCost);
 assert.equal(result.journals.length,1);
});

test('vista: presets 5/10/15/20, sin salida y sin lista de compras en Planner, escenas distintas',()=>{
 const src=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(src,/data-budget-preset/);assert.match(src,/\[5,10,15,20\]/);
 assert.match(src,/Máximo de pérdidas estimadas/);assert.match(src,/Fama por silver · admite pérdidas limitadas/);
 assert.match(src,/Plan por artículo y ciudad/);assert.doesNotMatch(src,/<th class="numeric">Crafts \/ salida<\/th>/);
 assert.doesNotMatch(src,/<div class="sub-title">Lista de compras de materiales<\/div>/);
 assert.match(src,/journal-tier-group/);assert.match(src,/DIARIO ESTIMADO · OPCIONAL/);
 for(const scene of ['planning.webp','forge.webp','royal-market.webp'])assert(existsSync(new URL(`../assets/scenes/${scene}`,import.meta.url)));
});
