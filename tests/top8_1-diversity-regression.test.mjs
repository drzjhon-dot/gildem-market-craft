import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allocatePortfolioV6 } from '../core/allocator-v6.js';
import { filterViableCraftRoutes } from '../core/viability.js';
import { bulkMarketCandidates } from '../core/high-volume.js';
import { fitPlan } from '../core/plan.js';
import { validateCraftPlan, variantParts } from '../core/craft-plan-controls.js';

const route=(id,capital,focus,profit,weekly=500)=>({
 id,city:'Black Market',craftCity:'Thetford',mode:'listed',
 sell:capital*1.5,cost:capital*.82,capitalPerUnit:capital,
 profit,stressProfit:profit*.45,confidence:{score:94},
 focusPerUnit:focus,craftAmount:1,craftFame:25000,
 referenceSide:'buy_price_max',saleTaxPercent:2.5,
 activity:{observations:14,activeDays:12,count:weekly*2,observedDaily:weekly/7},
 activity7:{observations:7,activeDays:7,count:weekly,observedDaily:weekly/7},
 demandDaily:weekly/7,materials:[]
});
const options=(force=true)=>({intelligent:true,bulkMode:true,saturation:2,
 capFraction:.22,horizonDays:7,forceDiversity:force,diversityLanes:false,
 maxPerItemFraction:.3,focusLimit:50,targetDifferentItems:1,maxVariants:5,unknownCap:0});

test('top8.1: checkbox de diversidad tiene prioridad incluso si el objetivo desactiva diversityLanes',()=>{
 const routes=[route('T4_MAIN_MACE',20000,0,15000),route('T5_MAIN_MACE',35000,0,18000),route('T8_2H_MACE',140000,0,12000)];
 const selected=allocatePortfolioV6(routes,2_000_000,options(true));
 const tiers=new Set(selected.rows.map(r=>variantParts(r.id)?.tier));
 assert(tiers.has(8),`La selección forzada no puede desaparecer al usar un objetivo de pocos objetos: ${[...tiers]}`);
 assert(selected.rows.every(r=>r.profit>0));
});

test('top8.1: prueba alternativas del mismo tier si la opción más barata no cabe por Focus',()=>{
 const input=[route('T4_MAIN_MACE',20000,0,18000),route('T5_MAIN_MACE',35000,0,15000),
  route('T8_MAIN_MACE',85000,1000,14000),route('T8_2H_MACE',140000,0,12000)];
 const allocation=allocatePortfolioV6(input,2_000_000,options(true));
 const selected=allocation.rows.map(x=>x.id);
 assert(selected.includes('T8_2H_MACE'),`La segunda receta T8 debió evaluarse: ${selected}`);
 assert(!selected.includes('T8_MAIN_MACE'),'No se puede aceptar una receta que gasta Focus inexistente');
 const result=fitPlan(allocation.rows,2_000_000,50,{preserveTiers:true});
 const final=result.rows.map(x=>x.id);
 assert(final.includes('T8_2H_MACE'),`T8 debe sobrevivir al cálculo final: ${final}`);
 assert(result.focusUsed<=50&&result.totalCost<=2_000_000);
});

test('top8.1: filtros T4/T6/T8 y .0/.2 no introducen variantes externas y la asignación final es válida',()=>{
 const allowed=[];
 for(const tier of [4,6,8])for(const ench of [0,2])for(const stem of ['MAIN_MACE','2H_MACE']){
  const id=`T${tier}_${stem}${ench?'@'+ench:''}`;
  const capital=({4:35000,6:240000,8:1050000}[tier])*(1+.2*ench);
  allowed.push(route(id,capital,0,capital*.16,({4:3000,6:350,8:80}[tier])/(1+ench)));
 }
 const budget=10_000_000;
 const viable=filterViableCraftRoutes(allowed,{budget,mode:'black',diversityPriority:true});
 const observed=bulkMarketCandidates(viable.accepted,{minWeekly:36,diversityPriority:true,requireStress:false});
 const allocated=allocatePortfolioV6(observed.accepted,budget,{...options(true),focusLimit:null,
  targetDifferentItems:12,maxVariants:24});
 const plan=fitPlan(allocated.rows,budget,null,{preserveTiers:true});
 const check=validateCraftPlan(plan.rows,{tiers:[4,6,8],enchants:[0,2],ids:allowed.map(x=>x.id),budget,market:'black',totalCost:plan.totalCost});
 assert.equal(check.ok,true,check.problems.join('; '));
 assert(plan.rows.every(r=>[4,6,8].includes(variantParts(r.id)?.tier)&&[0,2].includes(variantParts(r.id)?.enchant)));
 assert(plan.rows.every(r=>r.totalProfit>0&&r.qty<=r.maxCrafts));
});

test('top8.1: no se fuerza diversidad al faltar actividad o beneficio esperado',()=>{
 const dead=route('T8_MAIN_MACE',200000,0,8000);
 dead.activity=null;dead.activity7=null;dead.demandDaily=null;
 const observed=bulkMarketCandidates([dead],{minWeekly:0,diversityPriority:true,requireStress:false});
 assert.equal(observed.accepted.length,0);
 const loss=route('T7_MAIN_MACE',200000,0,-5);
 const feasible=filterViableCraftRoutes([loss],{budget:5_000_000,mode:'black',diversityPriority:true});
 assert.equal(feasible.accepted.length,0);
});

test('top8.1: el motor sigue conservando la distribución antigua con la casilla desactivada',()=>{
 const input=[route('T4_MAIN_MACE',20000,0,14000,5000),route('T6_MAIN_MACE',250000,0,16000,600)];
 const selected=allocatePortfolioV6(input,2_000_000,options(false));
 assert(selected.rows.every(r=>r.qty<=r.maxCrafts));
 assert(!selected.method.includes('Diversidad prioritaria'));
});

test('top8.1: la preselección de demanda no debe excluir por defecto las reservas T6-T8',()=>{
 const source=readFileSync(new URL('../core/allocator-v6.js',import.meta.url),'utf8');
 assert(source.includes('const diversifyLanes=forceDiversity||opts.diversityLanes===true'));
 assert(source.includes('const optionsByTier=new Map()'));
 assert(source.includes('if(maxFor(x)<x.minLot)continue;'));
});

test('top8.1: al desactivar la casilla, el generador y las tres propuestas desactivan la reserva de tiers',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const proposal=readFileSync(new URL('../core/portfolio-proposals.js',import.meta.url),'utf8');
 assert(app.includes('diversityLanes:diversityPriority&&profile.diversityLanes'));
 assert(proposal.includes('diversityLanes:forceDiversity&&profile.diversityLanes'));
});
