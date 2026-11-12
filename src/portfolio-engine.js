/**
 * Gildem Portfolio Engine 2.0 — independent, deterministic allocation.
 * Input: already validated recipe + price + per-destination quality-1 history candidates.
 * NO generated demand. NO synthetic quotes. History is an activity proxy, not filled orders.
 *
 * Three different seed/optimization passes compete using the user's actual goal.
 * Each additional craft is priced at its marginal impact, constrained by gross capital,
 * focus, per-SKU exposure, group exposure and the observed Q1 volume cap.
 */
import {variant} from './branches.js';
const finite=x=>Number.isFinite(Number(x))?Number(x):0;
const cap=(x,a,b)=>Math.min(b,Math.max(a,x));
const family=id=>String(id||'').replace(/^T[1-8]_/,'').replace(/@[1-4]$/,'');
const familyGroup=id=>family(id).replace(/(?:_SET\d+|_UNIQUE(?:_\w+)?|_LEVEL\d+)$/,'');
const keyOf=r=>r.routeKey||`${r.id}|${r.city}`;
function marginalImpact(r,qty,c){const units=qty*finite(r.craftAmount||1),daily=finite(r.history?.effectiveQuality1DailyUnits??r.history?.quality1DailyUnits??r.history?.averageDailyUnits);
 return cap(units/Math.max(1,daily*finite(c.saleDays||7))*({prudent:.45,balanced:.75,dynamic:1.1}[c.style]||.75),0,.33);
}
export function estimateRoute(r,qty,c){const units=qty*finite(r.craftAmount||1),impact=marginalImpact(r,qty,c);
 const revenue=finite(r.planningPrice)*units*(1-finite(c.sellHaircutPct)/100)*(1-finite(r.marketFee))*(1-impact);
 const cost=finite(r.expectedCostPerCraft)*qty;
 return {revenue,cost,profit:revenue-cost,stressProfit:revenue*.9-cost,impact:impact*100,units};
}
function exposures(routes,c){const enabled=routes.filter(r=>r.maxCrafts>=1&&finite(r.grossCapitalPerCraft)<=c.budget);
 const tiers=new Set(enabled.map(r=>variant(r.id)?.tier)),enchants=new Set(enabled.map(r=>variant(r.id)?.ench));
 const groups=new Set(enabled.map(r=>familyGroup(r.id))),markets=new Set(enabled.map(r=>r.city));
 return {tier:tiers.size>1?Number(c.maxTierSharePct??72):100,
  ench:enchants.size>1?Number(c.maxEnchantSharePct??78):100,
  family:groups.size>1?Number(c.maxFamilySharePct??68):100,
  city:markets.size>1?Number(c.maxMarketSharePct??100):100};
}
function freshState(routes,c){return {budgetLeft:c.budget,focusLeft:c.focus?Number(c.focusAvailable):Infinity,loss:0,
  qty:new Map(),byItem:new Map(),tier:new Map(),ench:new Map(),family:new Map(),city:new Map(),rejections:new Map(),
  routes,activeCount:0};
}
const sum=(map,k)=>map.get(k)||0;
const increase=(map,k,v)=>map.set(k,sum(map,k)+v);
function evalNext(s,r,c,limit,exposure){const key=keyOf(r),qty=sum(s.qty,key),out=(why)=>({ok:false,why});
 const gross=finite(r.grossCapitalPerCraft);
 if(!(gross>0)||!(r.maxCrafts>0))return out('Coste o límite de demanda Q1 no verificable');
 const used=qty,styleLimit=c.useBudget?r.maxCrafts:Math.min(r.maxCrafts,Math.max(1,Math.ceil(r.maxCrafts*({prudent:.35,balanced:.7,dynamic:1}[c.style]||.7))));
 if(used>=styleLimit)return out('Límite de volumen de calidad 1 / estilo');
 if(!used&&s.activeCount>=limit)return out('Límite de variantes del estilo');
 if(gross>s.budgetLeft+1e-7)return out('Presupuesto bruto agotado');
 if(c.focus&&finite(r.focusPerCraft)>s.focusLeft+1e-7)return out('Focus agotado');
 const byItem=sum(s.byItem,r.id)+gross;
 if(byItem>c.budget*c.maxCapitalSharePct/100+1e-7)return out('Capital máximo por artículo');
 const v=variant(r.id)||{tier:0,ench:0};
 const groups=[['tier',v.tier,s.tier],['ench',v.ench,s.ench],['family',familyGroup(r.id),s.family],['city',r.city,s.city]];
 if(c.diversify){for(const [field,k,map] of groups){if(sum(map,k)+gross>c.budget*exposure[field]/100+1e-7)return out(`Concentración máxima por ${field}`);}}
 const before=estimateRoute(r,qty,c),after=estimateRoute(r,qty+1,c);
 const marginal=after.profit-before.profit;
 const balanceLoss=s.loss-Math.max(0,-before.profit)+Math.max(0,-after.profit);
 if(c.goal==='fame'){
  if(after.profit<0&&-after.profit>(qty+1)*gross*.25+1e-7)return out('Pérdida de ruta superior al 25%');
  if(balanceLoss>c.budget*Number(c.fameLossBudgetPct)/100+1e-7)return out('Límite total de pérdidas para fama');
 }else{
  if(marginal<=0)return out('La siguiente unidad reduce el beneficio neto');
  if(after.profit<=0||after.profit/((qty+1)*gross)*100<c.minRoiPct)return out('Beneficio / ROI insuficiente');
  if(c.stressGuard&&(c.style==='prudent'||!c.diversify)&&after.stressProfit<0)return out('Escenario de estrés negativo');
 }
 return {ok:true,marginal,before,after,balanceLoss,gross,byItem,groups};
}
function apply(s,r,c,check){const key=keyOf(r),first=!s.qty.has(key),v=variant(r.id)||{tier:0,ench:0};
 increase(s.qty,key,1);s.budgetLeft-=check.gross;s.focusLeft-=finite(r.focusPerCraft);s.loss=check.balanceLoss;
 increase(s.byItem,r.id,check.gross);increase(s.tier,v.tier,check.gross);increase(s.ench,v.ench,check.gross);
 increase(s.family,familyGroup(r.id),check.gross);increase(s.city,r.city,check.gross);if(first)s.activeCount++;
}
function removeOne(s,r,c){
 const key=keyOf(r),oldQty=sum(s.qty,key),gross=finite(r.grossCapitalPerCraft);
 if(oldQty<1)throw Error('Intento de retirar un craft no asignado');
 const before=estimateRoute(r,oldQty,c),after=estimateRoute(r,oldQty-1,c);
 if(oldQty===1){s.qty.delete(key);s.activeCount--;}else s.qty.set(key,oldQty-1);
 s.budgetLeft+=gross;s.focusLeft+=finite(r.focusPerCraft);
 s.loss=s.loss-Math.max(0,-before.profit)+Math.max(0,-after.profit);
 const v=variant(r.id)||{tier:0,ench:0};
 for(const [map,k] of [[s.byItem,r.id],[s.tier,v.tier],[s.ench,v.ench],[s.family,familyGroup(r.id)],[s.city,r.city]]){
  increase(map,k,-gross);if(Math.abs(sum(map,k))<1e-7)map.delete(k);
 }
 return before.profit-after.profit;
}
/**
 * One-unit exchange neighborhood after each greedy allocation. A cheaper route
 * can monopolize the budget despite a higher absolute-profit craft being affordable
 * after selling back a lower-value planned unit. Only strict NET improvements apply.
 * Keeps a seed tier/enchantment if diversity was requested.
 */
function polish(s,routes,c,caplines,exposure){if(c.goal==='fame')return;
 for(let pass=0;pass<8;pass++){
  let best=null,bestGain=.0001;
  const chosen=routes.filter(r=>sum(s.qty,keyOf(r))>0);
  for(const old of chosen){
   const oldQty=sum(s.qty,keyOf(old)),ov=variant(old.id)||{};
   if(c.diversify&&oldQty===1){
    if(!chosen.some(x=>x!==old&&variant(x.id)?.tier===ov.tier))continue;
    if(c.enchants.length>1&&!chosen.some(x=>x!==old&&variant(x.id)?.ench===ov.ench))continue;
   }
   const lost=removeOne(s,old,c);
   for(const fresh of routes){if(keyOf(fresh)===keyOf(old))continue;
    const step=evalNext(s,fresh,c,caplines,exposure);
    if(!step.ok)continue;
    const gain=step.marginal-lost;
    if(gain>bestGain){best={old,fresh};bestGain=gain;}
   }
   const undo=evalNext(s,old,c,caplines,exposure);
   if(!undo.ok)throw Error('Intercambio no pudo restaurar ruta de origen: '+undo.why);
   apply(s,old,c,undo);
  }
  if(!best)break;
  removeOne(s,best.old,c);
  const checked=evalNext(s,best.fresh,c,caplines,exposure);
  if(!checked.ok)throw Error('Intercambio marginal dejó de ser viable: '+checked.why);
  apply(s,best.fresh,c,checked);
 }
}
function objective(r,v,c,mode,s){const capital=Math.max(1,v.gross),rate=v.marginal/capital,tiers=variant(r.id)||{};
 const fameRate=finite(r.expectedFamePerCraft)/capital;
 const isNew=!s.qty.has(keyOf(r)),groupUnused=!s.family.has(familyGroup(r.id));
 const newFactor=isNew?.010:0,spread=groupUnused?.008:0;
 if(c.goal==='fame')return fameRate*(1+(mode==='spread'?.05:0)+newFactor)+(Math.min(.2,rate)*.001);
 if(mode==='profit')return rate+Math.log1p(Math.max(0,v.marginal))*.0008;
 if(mode==='spread')return rate+(c.diversify?(newFactor+spread):0)+(c.goal==='balanced'?fameRate*.008:0);
 return rate*.98+Math.log1p(Math.max(0,v.marginal))*.001+(c.goal==='balanced'?fameRate*.008:0);
}
function seed(s,r,c,caplines,exposure){const next=evalNext(s,r,c,caplines,exposure);if(next.ok){apply(s,r,c,next);return true;}return false;}
function solve(routes,c,mode,exposure){const s=freshState(routes,c),caplines=c.style==='prudent'?24:c.style==='balanced'?40:c.volume?70:55;
 const eligible=routes.filter(r=>r.maxCrafts>0&&r.grossCapitalPerCraft<=c.budget);
 // First reserve one viable craft per selected tier and enchant if diversity is enabled.
 // The same constraints apply to the seed. No exception for T8 or loss-making silver routes.
 if(c.diversify||c.goal==='fame'){
  const sortedTiers=[...new Set(eligible.map(r=>variant(r.id)?.tier))].filter(Boolean).sort((a,b)=>b-a);
  for(const tier of sortedTiers){const choices=eligible.filter(r=>variant(r.id)?.tier===tier).map(r=>({r,v:evalNext(s,r,c,caplines,exposure)})).filter(x=>x.v.ok)
   .sort((a,b)=>objective(b.r,b.v,c,mode,s)-objective(a.r,a.v,c,mode,s));if(choices.length)apply(s,choices[0].r,c,choices[0].v);}
  if(mode!=='profit')for(const ench of [...new Set(eligible.map(r=>variant(r.id)?.ench))].filter(x=>x!==undefined).sort((a,b)=>b-a)){
    const choices=eligible.filter(r=>variant(r.id)?.ench===ench&&!s.qty.has(keyOf(r))).map(r=>({r,v:evalNext(s,r,c,caplines,exposure)})).filter(x=>x.v.ok)
      .sort((a,b)=>objective(b.r,b.v,c,mode,s)-objective(a.r,a.v,c,mode,s));if(choices.length)apply(s,choices[0].r,c,choices[0].v);
  }
 }
 // Marginal profit allocation, recomputed on every craft because each added unit
 // reduces the expected clearing price of its own item+city batch.
 for(let i=0;i<16000;i++){
  let best=null,bestCheck=null,bestScore=-Infinity;
  for(const r of routes){const next=evalNext(s,r,c,caplines,exposure);
   if(!next.ok){if(!s.qty.has(keyOf(r)))s.rejections.set(keyOf(r),next.why);continue;}
   const score=objective(r,next,c,mode,s);
   if(score>bestScore+1e-12||(Math.abs(score-bestScore)<1e-12&&next.marginal>finite(bestCheck?.marginal))){bestScore=score;best=r;bestCheck=next;}
  }
  if(!best)break;apply(s,best,c,bestCheck);
 }
 polish(s,routes,c,caplines,exposure);
 const chosen=routes.filter(r=>sum(s.qty,keyOf(r))>0).map(r=>({row:r,qty:sum(s.qty,keyOf(r))}));
 const profit=chosen.reduce((v,{row,qty})=>v+estimateRoute(row,qty,c).profit,0);
 const fame=chosen.reduce((v,{row,qty})=>v+finite(row.expectedFamePerCraft)*qty,0);
 const diversity={tiers:new Set(chosen.map(x=>variant(x.row.id)?.tier)).size,enchants:new Set(chosen.map(x=>variant(x.row.id)?.ench)).size,
  families:new Set(chosen.map(x=>familyGroup(x.row.id))).size,variants:new Set(chosen.map(x=>x.row.id)).size,cities:new Set(chosen.map(x=>x.row.city)).size};
 return {...s,mode,profit,fame,diversity,chosen,capital:c.budget-s.budgetLeft};
}
/** Pure engine interface. The caller converts the chosen route quantities into a shopping ledger. */
export function optimizePortfolio(candidates,config){const c=config,keys=new Map();
 for(const x of candidates){const key=keyOf(x);if(!keys.has(key)||finite(x.estimatedProfitPerCraft)>finite(keys.get(key).estimatedProfitPerCraft))keys.set(key,x);}
 const routes=[...keys.values()].map(x=>({...x,routeKey:keyOf(x)}));const exposure=exposures(routes,c);
 const solutions=['profit','balanced','spread'].map(mode=>solve(routes,c,mode,exposure));
 const value=s=>c.goal==='fame'?s.fame+Math.min(0,s.profit)*.02:
  c.goal==='silver'?s.profit:s.profit+(s.fame*Math.max(0,Math.min(1,s.profit/Math.max(1,s.capital)))*.001);
 const ordered=solutions.sort((a,b)=>value(b)-value(a)||b.profit-a.profit||b.diversity.variants-a.diversity.variants);
 const best=ordered[0];const selected=best.chosen.map(x=>({...x.row,qty:x.qty}));
 const warnings=[];
 if(c.diversify){const availableTiers=new Set(routes.filter(x=>x.maxCrafts>0&&x.grossCapitalPerCraft<=c.budget).map(x=>variant(x.id)?.tier));
  for(const tier of c.tiers.filter(t=>Number(t)>=6))if(availableTiers.has(Number(tier))&&!selected.some(r=>variant(r.id)?.tier===Number(tier)))warnings.push(`T${tier}: no encajó en límites conjuntos de beneficio, liquidez, capital o diversidad.`);
 }
 return {selected,best,solutions:solutions.map(s=>({mode:s.mode,profit:s.profit,capital:s.capital,fame:s.fame,diversity:s.diversity})),warnings,
  exposure,unusedRoutes:routes.filter(r=>!best.qty.has(keyOf(r))).map(r=>({...r,reason:best.rejections.get(keyOf(r))||'Desplazado por variantes con mejor retorno marginal'}))};
}
