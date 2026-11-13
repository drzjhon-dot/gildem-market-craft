// MOTOR 3.0 para Black Craft y Royal Craft (v9.10).
// Mismas entradas y la misma salida que allocatePortfolioV6, pero el reparto ya no usa
// heurísticas de cuotas proporcionales ni varios órdenes fijos: cada lote adicional compite
// con todos los demás por beneficio marginal / capital, usando el beneficio real a esa
// cantidad (saturación y libro de órdenes de routeProfitAtQuantity). Se detiene cuando el
// siguiente lote deja de compensar. Capacidad por ruta, Focus, exposición por objeto,
// tier y carril, lote mínimo útil y máximo de variantes se respetan como restricciones.
import {routeProfitAtQuantity} from './depth.js';
import {resolveStyle,impactCapacity,horizonVolumeUnits} from './market-impact.js';
import {pendingAdjustedCapacity,portfolioDiversityStats} from './intelligent-portfolio.js';
import {variantParts} from './craft-plan-controls.js';
import {diversityPolicy,diversityRouteCapacity} from './diversity-policy.js';
import {capacityFor,minUsefulLot,routePriority} from './allocator-v6.js';
import {optimize} from './marginal-optimizer.js';
const f=(x,d=0)=>Number.isFinite(Number(x))?Number(x):d;
export const MOTOR3_METHOD='Motor 3.0: beneficio marginal por silver invertido, con saturación por volumen observado y límites de capacidad, Focus y exposición';

export function allocatePortfolioV3(candidates,budget,opts={}){
 const budgetValue=f(budget),focusLimit=opts.focusLimit==null?Infinity:f(opts.focusLimit);
 const maxVariants=Math.min(80,Math.max(1,opts.maxVariants??70));
 const capFraction=opts.capFraction??.06,unknownCap=opts.unknownCap??1,goal=opts.goal||'balanced',horizonDays=opts.horizonDays??14;
 const minConfidence=opts.minimumConfidence||0,forceDiversity=opts.forceDiversity===true&&opts.intelligent===true;
 const diversifyLanes=forceDiversity||opts.diversityLanes===true;
 const rules=diversityPolicy(opts.saturation);
 const pending=opts.pendingByMarket instanceof Map?opts.pendingByMarket:new Map();
 const empty={rows:[],capital:budgetValue,totalCost:0,totalNetCost:0,totalProfit:0,focusUsed:0,remaining:budgetValue,method:'Sin rutas rentables verificables',engine:'motor3'};
 if(!(budgetValue>0)||focusLimit<0)return empty;
 const sat=opts.saturation!=null&&opts.saturation!==false?resolveStyle(opts.saturation):null;
 const fameWeight=Math.max(0,Math.min(1,f(opts.fameWeight)));
 const valid=(candidates||[]).filter(x=>x?.id&&x?.city&&f(x.profit)>0&&f(x.capitalPerUnit)>0&&f(x.cost)>0&&f(x.confidence?.score)>=minConfidence);
 // Una sola ruta por objeto+destino+modo (no comprar el mismo libro dos veces).
 const byRoute=new Map();for(const x of valid){const key=x.id+'|'+x.city+'|'+x.mode,old=byRoute.get(key);
  if(!old||routePriority(x,goal)>routePriority(old,goal))byRoute.set(key,x);}
 const all=[...byRoute.values()].map(x=>{
  let base=capacityFor(x,capFraction,unknownCap,horizonDays),saturation=null;
  if(sat&&!(x.depthVerified&&x.orderLevels?.length)){const volumeUnits=horizonVolumeUnits(x,horizonDays);
   if(volumeUnits>0){const style=x.city==='Black Market'?{...sat,k:sat.k*.5}:sat;saturation={k:style.k,volumeUnits,style:sat.id};base=Math.min(base,impactCapacity(x,{horizonDays,style}));}}
  const pendingCapacity=pendingAdjustedCapacity(x,base,pending);
  const capacity=forceDiversity?diversityRouteCapacity(x,{style:opts.saturation,horizonDays,available:pendingCapacity}):pendingCapacity;
  return {...x,saturation:saturation||x.saturation||null,intelligentCapacity:capacity,
   minLot:forceDiversity&&variantParts(x.id)?.tier>=6?1:minUsefulLot(x,capacity),pendingUnits:pending.get(x.id+'|'+x.city)||0};
 }).filter(x=>x.intelligentCapacity>0);
 if(!all.length)return empty;
 // Beneficio a cada cantidad; si el libro no cubre la cantidad, la ruta no puede crecer más.
 const profitAt=(x,q)=>{if(!(q>0))return 0;const p=routeProfitAtQuantity(x,q);return p==null?-Infinity:p;};
 const tierOf=x=>String(variantParts(x.id)?.tier||'?'),laneOf=x=>{const p=variantParts(x.id);return p?`${p.tier}.${p.enchant}`:'?';};
 const fameRatios=all.filter(x=>f(x.craftFame)>0).map(x=>f(x.profit)/f(x.craftFame)).sort((a,b)=>a-b);
 const fameSilver=fameWeight>0&&fameRatios.length?fameWeight*fameRatios[Math.floor(fameRatios.length/2)]:0;
 const routes=all.map(x=>({key:x.id+'|'+x.city+'|'+x.mode,max:x.intelligentCapacity,step:Math.max(1,Math.floor(x.intelligentCapacity/25)),firstStep:x.minLot,
  groups:{item:x.id,...(diversifyLanes?{lane:laneOf(x)}:{}),tier:tierOf(x)},division:x.id,
  mats:()=>[],weightPerUnit:()=>f(x.focusPerUnit),
  totals:q=>{const cost=q*x.capitalPerUnit,p=profitAt(x,q);return {revenue:cost+p,cost,fame:q*f(x.craftFame),cushion:0};},row:x}));
 // Exposición: por objeto (como el motor anterior), por carril con diversidad y T4/T5 cuando hay T6+ viables.
 const itemFraction=Math.min(.5,Math.max(.05,f(opts.maxPerItemFraction,.12)));
 const limits={item:Math.max(itemFraction,forceDiversity?0:.35),...(diversifyLanes?{lane:forceDiversity?.74:.86}:{})};
 const seedGroups=[];
 if(diversifyLanes){
  // Un primer lote por tier (de T8 a T4 con diversidad prioritaria) antes del reparto marginal.
  const byTier=new Map();for(const r of routes){const t=tierOf(r.row),l=byTier.get(t)||[];l.push(r);byTier.set(t,l);}
  for(const [,list] of [...byTier].sort((a,b)=>forceDiversity?Number(b[0])-Number(a[0]):0))
   seedGroups.push(list.sort((a,b)=>forceDiversity?a.row.capitalPerUnit-b.row.capitalPerUnit||routePriority(b.row,goal)-routePriority(a.row,goal):routePriority(b.row,goal)-routePriority(a.row,goal)));
 }
 const res=optimize({routes,budget:budgetValue,ledger:new Map(),goal:fameSilver>0?'balanced':'silver',fameSilver,
  minMarginalRoi:opts.useAll?0:.02,limits,weightCap:Number.isFinite(focusLimit)?focusLimit:0,maxDivisions:maxVariants,seedGroups});
 // T4/T5 no pueden quedarse todo el capital si hay T6+ viables (diversidad prioritaria).
 let chosen=res.chosen;
 if(forceDiversity&&chosen.some(c=>Number(tierOf(c.route.row))>=6)){
  const cap=budgetValue*rules.lowTierBudgetShare;let low=chosen.filter(c=>['4','5'].includes(tierOf(c.route.row))).reduce((a,c)=>a+c.cap,0);
  for(const c of [...chosen].sort((a,b)=>a.profit/a.cap-b.profit/b.cap)){if(low<=cap)break;if(!['4','5'].includes(tierOf(c.route.row)))continue;
   const x=c.route.row,excess=low-cap,cut=Math.min(c.q-x.minLot,Math.ceil(excess/x.capitalPerUnit));if(cut<=0)continue;
   c.q-=cut;c.cap=c.q*x.capitalPerUnit;low-=cut*x.capitalPerUnit;}
 }
 const rows=chosen.filter(c=>c.q>0).map(c=>{const x=c.route.row,qty=c.q;return {...x,qty,maxCrafts:x.intelligentCapacity,fameTotal:qty*f(x.craftFame),
  allocation:qty*x.capitalPerUnit,itemExposureFraction:limits.item,demandShare:null,totalProfit:routeProfitAtQuantity(x,qty)};})
  .filter(x=>x.totalProfit>0);
 const totalCost=rows.reduce((a,x)=>a+x.allocation,0);
 return {rows,capital:budgetValue,totalCost,totalNetCost:rows.reduce((a,x)=>a+x.qty*x.cost,0),totalProfit:rows.reduce((a,x)=>a+x.totalProfit,0),
  focusUsed:rows.reduce((a,x)=>a+x.qty*f(x.focusPerUnit),0),remaining:Math.max(0,budgetValue-totalCost),
  diversity:portfolioDiversityStats(rows,{budget:budgetValue,pending}),totalFame:rows.reduce((a,x)=>a+f(x.fameTotal),0),fameWeight,
  method:MOTOR3_METHOD,engine:'motor3'};
}

/**
 * v9.10 · Reparto final: calcula el plan con el motor 9.9 (más repartido) y con el Motor 3.0
 * (beneficio marginal). Se queda con el 9.9 salvo que el Motor 3.0 gane claramente:
 * más de un 8 % de beneficio, o el mismo beneficio usando el capital que el 9.9 deja parado.
 * Así se corrigen los planes casi vacíos (p. ej. presupuestos pequeños en Mercado Negro)
 * sin perder la diversificación cuando ambos rinden igual.
 */
export function allocateBestPortfolio(allocV6,candidates,budget,opts={}){
 const a=allocV6(candidates,budget,opts),b=allocatePortfolioV3(candidates,budget,opts);
 const pa=Number(a.totalProfit)||0,pb=Number(b.totalProfit)||0,ca=Number(a.totalCost)||0,cb=Number(b.totalCost)||0;
 const idle=ca<cb*.6&&pb>pa*1.02;
 const pick=b.rows.length&&(pb>pa*1.08+1||idle||!a.rows.length&&pb>0)?b:a;
 return {...pick,engineComparison:{v99:{profit:pa,capital:ca,routes:a.rows.length},motor3:{profit:pb,capital:cb,routes:b.rows.length},chosen:pick===b?'motor3':'v99'}};
}
