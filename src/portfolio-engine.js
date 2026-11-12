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
import {walkBids} from './orderbook.js';
const finite=x=>Number.isFinite(Number(x))?Number(x):0;
const cap=(x,a,b)=>Math.min(b,Math.max(a,x));
const family=id=>String(id||'').replace(/^T[1-8]_/,'').replace(/@[1-4]$/,'');
const familyGroup=id=>family(id).replace(/(?:_SET\d+|_UNIQUE(?:_\w+)?|_LEVEL\d+)$/,'');
const keyOf=r=>r.routeKey||`${r.id}|${r.city}`;
function marginalImpact(r,qty,c){const units=qty*finite(r.craftAmount||1),daily=finite(r.history?.effectiveQuality1DailyUnits??r.history?.quality1DailyUnits??r.history?.averageDailyUnits);
 // Mismo coeficiente que planner.deriveImpact: el impacto depende del mercado, no del estilo.
 return cap(units/Math.max(1,daily*finite(c.saleDays||7))*.75,0,.33);
}
/**
 * Venta bruta (antes de comisiones) de N unidades.
 * v2.6: con libro de órdenes del Mercado Negro, las primeras unidades se venden recorriendo las pujas
 * reales (sin superar el precio de planificación); el resto, a órdenes futuras con el modelo de impacto.
 */
export function grossSale(r,units,c){
 if(!(units>0))return {gross:0,impact:0,bookUnits:0};
 const price=finite(r.planningPrice),daily=finite(r.history?.effectiveQuality1DailyUnits??r.history?.quality1DailyUnits??r.history?.averageDailyUnits);
 const impactOf=u=>cap(u/Math.max(1,daily*finite(c.saleDays||7))*.75,0,.33);
 if(Array.isArray(r.bookBids)&&r.bookBids.length){const w=walkBids(r.bookBids,units,price);const rest=w.remaining,impact=impactOf(rest);
  const gross=w.revenue+price*rest*(1-impact);return {gross,impact:units?1-gross/(price*units):0,bookUnits:w.units};}
 const impact=impactOf(units);return {gross:price*units*(1-impact),impact,bookUnits:0};
}
/** fq: crafts de la ruta que usan Focus (coste neto menor por más retorno). */
export function estimateRoute(r,qty,c,fq=0){const units=qty*finite(r.craftAmount||1),sale=grossSale(r,units,c),impact=Math.max(0,sale.impact);
 const revenue=sale.gross*(1-finite(c.sellHaircutPct)/100)*(1-finite(r.marketFee));
 const focused=Math.min(qty,Math.max(0,fq)),withFocus=Number.isFinite(r.costWithFocus)?r.costWithFocus:finite(r.expectedCostPerCraft);
 const cost=finite(r.expectedCostPerCraft)*(qty-focused)+withFocus*focused;
 return {revenue,cost,profit:revenue-cost,stressProfit:revenue*.9-cost,impact:impact*100,units,bookUnits:sale.bookUnits};
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
  qty:new Map(),focusQty:new Map(),byItem:new Map(),tier:new Map(),ench:new Map(),family:new Map(),city:new Map(),rejections:new Map(),
  routes,activeCount:0};
}
const sum=(map,k)=>map.get(k)||0;
const increase=(map,k,v)=>map.set(k,sum(map,k)+v);
function evalNext(s,r,c,limit,exposure){const key=keyOf(r),qty=sum(s.qty,key),out=(why)=>({ok:false,why});
 const gross=finite(r.grossCapitalPerCraft);
 if(!(gross>0)||!(r.maxCrafts>0))return out('Coste o límite de demanda Q1 no verificable');
 // maxCrafts ya incorpora el estilo (parte de la actividad Q1). No se aplica una segunda reducción.
 const used=qty,styleLimit=r.maxCrafts;
 if(used>=styleLimit)return out('Límite de volumen de calidad 1 / estilo');
 if(!used&&s.activeCount>=limit)return out('Límite de variantes del estilo');
 if(gross>s.budgetLeft+1e-7)return out('Presupuesto bruto agotado');
 // v2.5: el Focus es opcional por craft; si no queda, el craft se hace sin Focus.
 const fq=sum(s.focusQty,key),useFocus=!!(c.focus&&finite(r.focusPerCraft)>0&&Number.isFinite(r.costWithFocus)&&r.costWithFocus<finite(r.expectedCostPerCraft)&&finite(r.focusPerCraft)<=s.focusLeft+1e-7);
 const byItem=sum(s.byItem,r.id)+gross;
 if(byItem>c.budget*c.maxCapitalSharePct/100+1e-7)return out('Capital máximo por artículo');
 const v=variant(r.id)||{tier:0,ench:0};
 const groups=[['tier',v.tier,s.tier],['ench',v.ench,s.ench],['family',familyGroup(r.id),s.family],['city',r.city,s.city]];
 if(c.diversify){for(const [field,k,map] of groups){if(sum(map,k)+gross>c.budget*exposure[field]/100+1e-7)return out(`Concentración máxima por ${field}`);}}
 const before=estimateRoute(r,qty,c,fq),after=estimateRoute(r,qty+1,c,fq+(useFocus?1:0));
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
 return {ok:true,marginal,before,after,balanceLoss,gross,byItem,groups,useFocus};
}
function apply(s,r,c,check){const key=keyOf(r),first=!s.qty.has(key),v=variant(r.id)||{tier:0,ench:0};
 increase(s.qty,key,1);s.budgetLeft-=check.gross;if(check.useFocus){increase(s.focusQty,key,1);s.focusLeft-=finite(r.focusPerCraft);}s.loss=check.balanceLoss;
 increase(s.byItem,r.id,check.gross);increase(s.tier,v.tier,check.gross);increase(s.ench,v.ench,check.gross);
 increase(s.family,familyGroup(r.id),check.gross);increase(s.city,r.city,check.gross);if(first)s.activeCount++;
}
function removeOne(s,r,c){
 const key=keyOf(r),oldQty=sum(s.qty,key),gross=finite(r.grossCapitalPerCraft);
 if(oldQty<1)throw Error('Intento de retirar un craft no asignado');
 // Retira primero un craft sin Focus; si todos usan Focus, devuelve su Focus.
 const fq=sum(s.focusQty,key),dropFocus=fq>=oldQty;
 const before=estimateRoute(r,oldQty,c,fq),after=estimateRoute(r,oldQty-1,c,dropFocus?fq-1:fq);
 if(oldQty===1){s.qty.delete(key);s.activeCount--;}else s.qty.set(key,oldQty-1);
 if(dropFocus){if(fq===1)s.focusQty.delete(key);else s.focusQty.set(key,fq-1);s.focusLeft+=finite(r.focusPerCraft);}
 s.budgetLeft+=gross;
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
 reassignFocus(s,routes,c);
 // Tras reasignar el Focus ninguna ruta puede quedar en pérdida (objetivo silver/equilibrado):
 // se retiran crafts de esa ruta y se vuelve a repartir el Focus.
 if(c.goal!=='fame')for(let round=0;round<4;round++){let changed=false;
  for(const r of routes){let q=sum(s.qty,keyOf(r));
   while(q>0&&estimateRoute(r,q,c,sum(s.focusQty,keyOf(r))).profit<=0){removeOne(s,r,c);q--;changed=true;}}
  if(!changed)break;reassignFocus(s,routes,c);}
 const chosen=routes.filter(r=>sum(s.qty,keyOf(r))>0).map(r=>({row:r,qty:sum(s.qty,keyOf(r)),focusQty:sum(s.focusQty,keyOf(r))}));
 const profit=chosen.reduce((v,{row,qty,focusQty})=>v+estimateRoute(row,qty,c,focusQty).profit,0);
 const fame=chosen.reduce((v,{row,qty})=>v+finite(row.expectedFamePerCraft)*qty,0);
 const diversity={tiers:new Set(chosen.map(x=>variant(x.row.id)?.tier)).size,enchants:new Set(chosen.map(x=>variant(x.row.id)?.ench)).size,
  families:new Set(chosen.map(x=>familyGroup(x.row.id))).size,variants:new Set(chosen.map(x=>x.row.id)).size,cities:new Set(chosen.map(x=>x.row.city)).size};
 return {...s,mode,profit,fame,diversity,chosen,capital:c.budget-s.budgetLeft};
}
/**
 * v2.5 · Reparto final del Focus: con las cantidades ya decididas, el Focus se asigna
 * a los crafts que más silver ahorran por punto de Focus (mochila fraccional, greedy por ratio).
 */
function reassignFocus(s,routes,c){if(!c.focus)return;
 const total=Number(c.focusAvailable)||0;s.focusQty=new Map();s.focusLeft=total;
 const chosen=routes.filter(r=>sum(s.qty,keyOf(r))>0&&finite(r.focusPerCraft)>0&&Number.isFinite(r.costWithFocus)&&r.costWithFocus<finite(r.expectedCostPerCraft))
  .map(r=>({r,ratio:(finite(r.expectedCostPerCraft)-r.costWithFocus)/finite(r.focusPerCraft)})).sort((a,b)=>b.ratio-a.ratio);
 for(const {r} of chosen){const units=Math.min(sum(s.qty,keyOf(r)),Math.floor((s.focusLeft+1e-7)/finite(r.focusPerCraft)));
  if(units>0){s.focusQty.set(keyOf(r),units);s.focusLeft-=units*finite(r.focusPerCraft);}}
}
/** Pure engine interface. The caller converts the chosen route quantities into a shopping ledger. */
export function optimizePortfolio(candidates,config){const c=config,keys=new Map();
 for(const x of candidates){const key=keyOf(x);if(!keys.has(key)||finite(x.estimatedProfitPerCraft)>finite(keys.get(key).estimatedProfitPerCraft))keys.set(key,x);}
 const routes=[...keys.values()].map(x=>({...x,routeKey:keyOf(x)}));const exposure=exposures(routes,c);
 const solutions=['profit','balanced','spread'].map(mode=>solve(routes,c,mode,exposure));
 const value=s=>c.goal==='fame'?s.fame+Math.min(0,s.profit)*.02:
  c.goal==='silver'?s.profit:s.profit+(s.fame*Math.max(0,Math.min(1,s.profit/Math.max(1,s.capital)))*.001);
 const ordered=solutions.sort((a,b)=>value(b)-value(a)||b.profit-a.profit||b.diversity.variants-a.diversity.variants);
 const best=ordered[0];const selected=best.chosen.map(x=>({...x.row,qty:x.qty,focusQty:x.focusQty||0}));
 const warnings=[];
 if(c.diversify){const availableTiers=new Set(routes.filter(x=>x.maxCrafts>0&&x.grossCapitalPerCraft<=c.budget).map(x=>variant(x.id)?.tier));
  for(const tier of c.tiers.filter(t=>Number(t)>=6))if(availableTiers.has(Number(tier))&&!selected.some(r=>variant(r.id)?.tier===Number(tier)))warnings.push(`T${tier}: no encajó en límites conjuntos de beneficio, liquidez, capital o diversidad.`);
 }
 return {selected,best,solutions:solutions.map(s=>({mode:s.mode,profit:s.profit,capital:s.capital,fame:s.fame,diversity:s.diversity})),warnings,
  exposure,unusedRoutes:routes.filter(r=>!best.qty.has(keyOf(r))).map(r=>({...r,reason:best.rejections.get(keyOf(r))||'Desplazado por variantes con mejor retorno marginal'}))};
}
