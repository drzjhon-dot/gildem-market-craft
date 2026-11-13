import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {quoteMap} from '../src/market.js';
import {settings,DEFAULTS} from '../src/planner.js';
import {batchCalculate} from '../src/batch-calculator.js';
const now=Date.parse('2026-11-11T21:00:00Z'),date=new Date(now-3600000).toISOString();
const quoted=(id,city,sell,buy=0)=>({item_id:id,city,quality:1,sell_price_min:sell,sell_price_min_date:date,buy_price_max:buy,buy_price_max_date:date});
const recipe=tier=>({city:'Martlock',amountCrafted:1,materials:[{id:`T${tier}_METALBAR`,count:16,ret:true},{id:`T${tier}_PLANKS`,count:8,ret:true}]});
const history=(id,day,price,days=6)=>({id,city:'Black Market',averageDailyUnits:day,quality1DailyUnits:day,quality1ActiveDays:days,activeDays:days,days:7,averageUnitPrice:price,quality1AveragePrice:price});
const cfg=(extra={})=>({...DEFAULTS,budget:1_000_000,tiers:[8],enchants:[0],minRoiPct:5,stressGuard:false,...extra});

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

