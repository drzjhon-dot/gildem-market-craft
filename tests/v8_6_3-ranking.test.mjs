import test from 'node:test';
import assert from 'node:assert/strict';
import {routePriority,allocatePortfolioV6} from '../core/allocator-v6.js';
const make=(id,profit,capital,daily)=>({id,city:'Black Market',craftCity:'Martlock',mode:'listed',
 profit,cost:capital*.65,stressProfit:profit*.75,capitalPerUnit:capital,craftAmount:1,
 demandDaily:daily,activity:{observations:14,activeDays:14,observedDaily:daily,count:daily*14},
 confidence:{score:85},ageHours:2,materials:[],focusPerUnit:0,journal:null,journalBonus:0});
test('ranking balanceado valora alta rotación T5.0 frente a una única T5.4 costosa',()=>{
 const common=make('T5_SHOES_PLATE_SET2',1100,5800,3696);
 const exotic=make('T5_SHOES_PLATE_SET3@4',258000,500000,1);
 assert(routePriority(common,'balanced')>routePriority(exotic,'balanced'));
 const plan=allocatePortfolioV6([common,exotic],500000,{goal:'balanced',useAll:true,horizonDays:14,capFraction:.06});
 assert(plan.rows.some(x=>x.id===common.id&&x.qty>=10));
 assert(plan.totalCost<=500000);
});
test('prioridad de profit sigue permitiendo elegir mayor beneficio absoluto',()=>{
 assert(routePriority(make('A',258000,500000,1),'profit')>routePriority(make('B',1100,5800,3696),'profit'));
});
