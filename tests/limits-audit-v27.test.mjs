import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCandidates,allocatePlan,DEFAULTS,settings} from '../src/planner.js';
import {variant} from '../src/branches.js';
import {top,recipes,quotes,T} from './fixtures/market-fixture.mjs';
// Auditoría: configuraciones aleatorias; el plan debe respetar TODOS los ajustes del usuario.
let seed=777;const rnd=()=>(seed=(seed*1103515245+12345)%2**31)/2**31;const pick=a=>a[Math.floor(rnd()*a.length)];
const subset=a=>{const s=a.filter(()=>rnd()<.5);return s.length?s:[pick(a)];};
const MK=['Black Market','Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford','Caerleon'];
const famOf=id=>id.replace(/^T\d_/,'').replace(/@\d$/,'').replace(/(?:_SET\d+|_UNIQUE(?:_\w+)?|_LEVEL\d+)$/,'');
test('v2.7 auditoría: 60 configuraciones aleatorias respetan filtros, presupuesto, ROI y límites del plan',()=>{
 const problems=[];
 for(let i=0;i<60;i++){
  const cfg=settings({...DEFAULTS,budget:pick([2e6,10e6,30e6]),tiers:subset([4,5,6,7,8]),enchants:subset([0,1,2,3]),saleDays:pick([3,7,14]),
   style:pick(['prudent','balanced','dynamic']),goal:pick(['silver','balanced','fame']),diversify:rnd()<.6,useBudget:rnd()<.5,bonusCity:rnd()<.7,
   purchaseMode:pick(['best-royal','craft-city']),minRoiPct:pick([0,5,15]),maxCapitalSharePct:pick([15,40,100]),maxTierSharePct:pick([35,72,100]),
   maxEnchantSharePct:pick([40,78,100]),maxFamilySharePct:pick([30,68,100]),craftFallbackCity:pick(['Lymhurst','Martlock']),journalProfit:false,trendAnalysis:false});
  const markets=subset(MK);
  const res=allocatePlan({...buildCandidates({top,recipes,quotes,config:cfg,selectedMarkets:markets,now:T}),recipes,config:cfg,now:T});
  const rows=res.rows,cap=res.summary.capitalReserved;if(!rows.length)continue;
  if(cap>cfg.budget+1)problems.push(`presupuesto ${cap}>${cfg.budget}`);
  for(const r of rows){const v=variant(r.id);
   if(!cfg.tiers.includes(v.tier))problems.push('tier '+r.id);if(!cfg.enchants.includes(v.ench||0))problems.push('ench '+r.id);
   if(!markets.includes(r.city))problems.push('ciudad '+r.city);if(r.qty>r.maxCrafts)problems.push('demanda '+r.id);
   if(cfg.goal!=='fame'&&r.totalProfit<=0)problems.push('pérdida '+r.id);
   if(cfg.goal!=='fame'&&r.totalProfit/(r.qty*r.grossCapitalPerCraft)*100<cfg.minRoiPct-.01)problems.push('ROI '+r.id);
   if(!cfg.bonusCity&&r.craftCity!==cfg.craftFallbackCity)problems.push('ciudad fabricación '+r.craftCity);}
  for(const m of res.materials)if(cfg.purchaseMode==='craft-city'&&m.city!==m.craftCity)problems.push('compra '+m.id);
  for(const [name,fn,lim] of [['artículo',r=>r.id,cfg.maxCapitalSharePct],['tier',r=>variant(r.id).tier,cfg.maxTierSharePct],['ench',r=>variant(r.id).ench||0,cfg.maxEnchantSharePct],['familia',r=>famOf(r.id),cfg.maxFamilySharePct]]){
   if(!(lim<100))continue;const by=new Map(),big=new Map();
   for(const r of rows){const k=fn(r),g=r.qty*r.grossCapitalPerCraft;by.set(k,(by.get(k)||0)+g);big.set(k,Math.max(big.get(k)||0,r.grossCapitalPerCraft));}
   if(by.size<2)continue;for(const [k,v] of by)if(v-big.get(k)>cap*lim/100+1)problems.push(`${name} ${k} ${(v/cap*100).toFixed(0)}% > ${lim}%`);}
 }
 assert.deepEqual(problems,[]);
});

test('v2.7 «Usar todo lo posible»: marcado invierte más; desmarcado deja 25 % de margen por destino',()=>{
 const base={...DEFAULTS,budget:100e6,tiers:[4,5,6],enchants:[0,1],style:'balanced',goal:'silver',diversify:true,journalProfit:false,trendAnalysis:false};
 const run=useBudget=>{const c=settings({...base,useBudget});return allocatePlan({...buildCandidates({top,recipes,quotes,config:c,selectedMarkets:['Black Market','Lymhurst'],now:T}),recipes,config:c,now:T});};
 const on=run(true),off=run(false);
 assert(on.summary.capitalReserved>off.summary.capitalReserved,`${on.summary.capitalReserved} > ${off.summary.capitalReserved}`);
 for(const r of off.rows)assert(r.qty<=Math.max(1,Math.ceil(r.maxCrafts*.75)),`${r.id} ${r.qty}/${r.maxCrafts}`);
});

test('v2.7 objetivo «Equilibrado» se diferencia de «Más silver»: más fama, sin rutas con pérdida',()=>{
 const base={...DEFAULTS,budget:30e6,tiers:[4,5,6,7],enchants:[0,1,2],style:'dynamic',journalProfit:false,trendAnalysis:false};
 const run=goal=>{const c=settings({...base,goal});return allocatePlan({...buildCandidates({top,recipes,quotes,config:c,selectedMarkets:['Black Market','Lymhurst','Martlock','Bridgewatch'],now:T}),recipes,config:c,now:T});};
 const silver=run('silver'),balanced=run('balanced');
 assert(balanced.summary.totalFame>silver.summary.totalFame,`${balanced.summary.totalFame} > ${silver.summary.totalFame}`);
 assert(balanced.rows.every(r=>r.totalProfit>0));
});
