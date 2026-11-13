// Cartera conjunta: capital, Focus, límite de órdenes y exposición por artículo.
// Multi-inicio con búsqueda de intercambio local; aproximación discreta, NO
// garantiza el óptimo matemático para todos los universos de recetas.
import {routeProfitAtQuantity} from './depth.js';
import {prudentListingCapacity,liquidityWeight} from './market-volume.js';
import {listingCapacity} from './demand-first.js';
import {allocateSmartPortfolio} from './optimizer.js';
import {resolveStyle,impactCapacity,horizonVolumeUnits} from './market-impact.js';
import {needWeight} from './market-mechanics.js';
import {pendingAdjustedCapacity,portfolioDiversityStats} from './intelligent-portfolio.js';
import {variantParts} from './craft-plan-controls.js';
import {diversityPolicy,diversityRouteCapacity} from './diversity-policy.js';
const f=(x,d=0)=>Number.isFinite(Number(x))?Number(x):d;
export function capacityFor(x,capFraction,unknownCap,horizonDays=14){
 if(Number.isFinite(x.marketCapacity))return Math.max(0,Math.floor(x.marketCapacity));
 return listingCapacity(x,{horizonDays,share:capFraction,maxPerRoute:6000,unknownCap});
}
function value(x,goal){
 const p=f(x.profit);const trust=Math.max(.15,Math.min(1,f(x.confidence?.score,40)/100));
 const slippage=(x.competition?.penalty??1)*liquidityWeight(x.activity,x.activity7)*needWeight(x);
 const risk=Math.max(.2,Math.min(1,f(x.stressProfit,p)/Math.max(1,p)));
 const personal=Math.max(.75,Math.min(1.12,f(x.personalLearning?.adjustment,1))); 
 const cash=f(x.capitalPerUnit,1);
 const daily=f(x.demandDaily,x.activity?.observedDaily||0);
 const rotation=Math.min(1,Math.log1p(Math.max(0,daily))/Math.log1p(3000));
 const turnover=.65+2.0*rotation;
 if(goal==='roi')return p/cash*trust*slippage*risk*personal*turnover;
 if(goal==='focus')return f(x.focusGain)/Math.max(1,f(x.focusPerUnit))*trust*slippage*risk*personal;
 if(goal==='balanced'||goal==='daily'){
  // Avoid ranking a single expensive .4 item above a highly liquid .0 line
  // exclusively because its absolute per-unit profit is larger. Log reduces
  // that distortion, ROI captures capital efficiency, rotation favors active
  // markets, and the allocator still checks budget and volume separately.
  const roi=Math.max(0,p/cash), balanced=Math.log1p(Math.max(0,p))*Math.sqrt(Math.min(2,roi))*turnover;
  const own=goal==='daily'&&x.personalLearning?.qtySold>=3?Math.max(.6,Math.min(1.3,3/Math.max(1,x.personalLearning.averageDays))):1;
  return balanced*trust*slippage*risk*personal*own;
 }
 return p*trust*slippage*risk*personal*turnover;
}
export function routePriority(route,goal='balanced'){return value(route,goal);}
// v9.1.0 · Lote mínimo útil. En el Mercado Negro un lote de 1 no compensa el viaje
// a Caerleon: o la ruta recibe una parte real de lo que su mercado absorbe, o no
// entra en el plan. En Royal se permite 1 unidad (se publica y se espera).
export function minUsefulLot(route,capacity){
 const cap=Math.max(0,Math.floor(Number(capacity)||0));
 // Con libro de órdenes verificado la venta es inmediata y real: vale cualquier cantidad.
 if(route?.city!=='Black Market'||route?.depthVerified||cap<=1)return Math.min(1,cap)||1;
 // Entre 3 y 5 unidades según lo que absorbe el mercado; para objetos caros basta
 // con el lote que ya mueve unas 400.000 de silver (uno solo si vale eso o más).
 const byUnits=Math.min(5,Math.max(3,Math.ceil(cap*.15)));
 const bySilver=f(route.capitalPerUnit)>0?Math.ceil(400000/f(route.capitalPerUnit)):byUnits;
 return Math.max(1,Math.min(cap,byUnits,bySilver));
}
// top.7.1: la política de lote final debe coincidir con la del asignador.
// Antes la última etapa volvía a exigir 3-5 unidades y eliminaba silenciosamente
// una fabricación T6-T8 de prueba que el modo diversidad ya había aceptado.
export function filterRowsByFinalLot(rows,{diversityPriority=false}={}){
 const accepted=[],rejected=[];
 for(const row of rows||[]){
  const tier=variantParts(row?.id)?.tier||0;
  const required=diversityPriority&&tier>=6?1:minUsefulLot(row,row?.maxCrafts);
  if((Number(row?.qty)||0)>=required)accepted.push(row);
  else rejected.push({id:row?.id,qty:row?.qty,required});
 }
 return {accepted,rejected};
}
// v9.1.0 · Fama de crafteo como segundo objetivo. Devuelve cuánto destaca una ruta
// en fama por silver invertido frente a la mediana del plan (entre 0,25 y 4).
export function fameFactorFor(routes,weight){
 const w=Math.max(0,Math.min(1,Number(weight)||0));
 if(!w)return ()=>1;
 const eff=x=>f(x.craftFame)>0&&f(x.capitalPerUnit)>0?f(x.craftFame)/f(x.capitalPerUnit):0;
 const known=(routes||[]).map(eff).filter(v=>v>0).sort((a,b)=>a-b);
 if(!known.length)return ()=>1;
 const median=known[Math.floor(known.length/2)]||1;
 return x=>{const e=eff(x);return Math.pow(e>0?Math.min(4,Math.max(.25,e/median)):.5,w);};
}
export function allocatePortfolioV6(candidates,budget,opts={}){
 const budgetValue=f(budget),focusLimit=opts.focusLimit==null?Infinity:f(opts.focusLimit);
 const maxVariants=Math.min(80,Math.max(1,opts.maxVariants??70));
 const capFraction=opts.capFraction??.06,unknownCap=opts.unknownCap??1,goal=opts.goal||'balanced',horizonDays=opts.horizonDays??14;
 const minConfidence=opts.minimumConfidence||0;
 const smart=opts.intelligent===true;
 const forceDiversity=opts.forceDiversity===true&&smart;
 // La casilla de diversidad manda: no puede quedar anulada por un perfil de objetivo.
 const diversifyLanes=forceDiversity||opts.diversityLanes===true;
 const diversityRules=diversityPolicy(opts.saturation); 
 // "Usar todo" allows spending available funds, never the removal of exposure caps.
 const itemFraction=smart?Math.min(.50,Math.max(.05,f(opts.maxPerItemFraction,.12))):
   Math.min(1,Math.max(0,f(opts.maxPerItemFraction,.30)));
 const itemExposureLimit=budgetValue*itemFraction;
 const pending=opts.pendingByMarket instanceof Map?opts.pendingByMarket:new Map();
 const empty={rows:[],capital:budgetValue,totalCost:0,totalNetCost:0,totalProfit:0,
  focusUsed:0,remaining:budgetValue,method:'Sin rutas rentables verificables'};
 if(!(budgetValue>0)||focusLimit<0)return empty;
 const sat=opts.saturation!=null&&opts.saturation!==false?resolveStyle(opts.saturation):null;
 const fameWeight=Math.max(0,Math.min(1,f(opts.fameWeight)));
 const fameOf=fameFactorFor(candidates,fameWeight);
 // El objetivo MÁS FAMA debe comparar fama/stock invertido, no solo multiplicar
 // la prioridad de silver por un factor leve (de lo contrario dos botones dan
 // planes prácticamente idénticos aunque una ruta dé mucha más fama).
 const median=a=>{const v=[...a].filter(x=>x>0&&Number.isFinite(x)).sort((x,y)=>x-y);return v.length?v[Math.floor(v.length/2)]:1;};
 const fameRate=x=>f(x.craftFame)/Math.max(1,f(x.capitalPerUnit,1));
 const rateMedian=median((candidates||[]).map(fameRate));
 const financialMedian=median((candidates||[]).map(x=>value(x,goal)));
 const val=x=>{
  const financial=value(x,goal);
  if(fameWeight===0)return financial;
  if(!(f(x.craftFame)>0))return financial*.25;
  const relative=Math.max(.10,Math.min(8,fameRate(x)/Math.max(1e-8,rateMedian)));
  const famous=financialMedian*Math.sqrt(Math.max(.05,financial/Math.max(1e-8,financialMedian)))*relative;
  return financial*(1-.78*fameWeight)+famous*(.78*fameWeight);
 };
 const valid=(candidates||[]).filter(x=>x?.id&&x?.city&&f(x.profit)>0&&f(x.capitalPerUnit)>0&&f(x.cost)>0&&f(x.confidence?.score)>=minConfidence);
 // Never buy the same listing book twice through different production cities.
 const byRoute=new Map();for(const x of valid){const key=x.id+'|'+x.city+'|'+x.mode;
  const old=byRoute.get(key);if(!old||val(x)>val(old))byRoute.set(key,x);
 }
 const all=[...byRoute.values()].map(x=>{
  let base=capacityFor(x,capFraction,unknownCap,horizonDays),saturation=null;
  // v8.8.0 · Saturación: tus propias ventas bajan el precio. El lote se limita donde
  // la ganancia marginal deja de compensar y el beneficio se descuenta por impacto.
  // Rutas con libro de órdenes verificado ya calculan el impacto con el libro real.
  if(sat&&!(x.depthVerified&&x.orderLevels?.length)){
   const volumeUnits=horizonVolumeUnits(x,horizonDays);
   if(volumeUnits>0){
    // En el Mercado Negro el lote ya se valora a la mediana pagada y lo vendido sale
    // del juego, así que tus ventas pesan menos sobre el precio (estimación: la mitad).
    const style=x.city==='Black Market'?{...sat,k:sat.k*.5}:sat;
    saturation={k:style.k,volumeUnits,style:sat.id};
    base=Math.min(base,impactCapacity(x,{horizonDays,style}));
   }
  }
  const pendingCapacity=pendingAdjustedCapacity(x,base,pending);
  // Limitamos también la exposición por OBJETO. El antiguo 55% conjunto
  // en T4/T5 permitía lotes muy grandes a pesar de marcar diversidad.
  const capacity=forceDiversity?diversityRouteCapacity(x,{style:opts.saturation,horizonDays,available:pendingCapacity}):pendingCapacity;
  return {...x,saturation:saturation||x.saturation||null,intelligentCapacity:capacity,minLot:forceDiversity&&variantParts(x.id)?.tier>=6?1:minUsefulLot(x,capacity),pendingUnits:pending.get(x.id+'|'+x.city)||0};
 }).filter(x=>x.intelligentCapacity>0);
 if(!all.length)return empty;
 all.sort((a,b)=>val(b)-val(a));
 // v8.7.0 · Reparto proporcional a la demanda. En producción de volumen el tope por
 // objeto ya no es un porcentaje plano del presupuesto: cada ruta recibe una cuota
 // del capital según cuánto capital puede absorber su mercado (capacidad x coste).
 const demandWeighted=opts.bulkMode===true&&opts.demandWeighted!==false;
 // El valor de cartera pondera actividad y objetivo, no solo precio × cantidad.
 const capitalAbsorbed=x=>{
  const base=x.intelligentCapacity*x.capitalPerUnit*fameOf(x);
  const v=Math.max(0,val(x)),median=1+Math.max(0,Number(x.profit)||0);
  return base*Math.max(.55,Math.min(2.1,(v/Math.sqrt(median))**.22));
 };
 const totalAbsorbed=all.reduce((a,x)=>a+capitalAbsorbed(x),0)||1;
 const routeShare=new Map(all.map(x=>[x,capitalAbsorbed(x)/totalAbsorbed]));
 // Con presupuesto escaso no caben todos: una ruta cuya parte proporcional no llega a
 // su lote mínimo útil sale del reparto y su capital pasa a las demás. Se repite
 // hasta que todas las que quedan reciben un lote real. Siempre queda al menos una.
 if(demandWeighted){
  let pool=[...all];
  for(let round=0;round<all.length;round++){
   const sum=pool.reduce((a,x)=>a+capitalAbsorbed(x),0)||1;
   const weak=pool.filter(x=>x.minLot>1&&Math.floor(budgetValue*capitalAbsorbed(x)/sum/x.capitalPerUnit)<x.minLot);
   if(!weak.length||weak.length===pool.length)break;
   // retira primero la de menor prioridad para no vaciar el plan de golpe
   const worst=weak.reduce((a,x)=>val(x)<val(a)?x:a);
   pool=pool.filter(x=>x!==worst);
  }
  if(pool.length<all.length){
   const keep=new Set(pool);
   for(let i=all.length-1;i>=0;i--)if(!keep.has(all[i]))all.splice(i,1);
   const sum=all.reduce((a,x)=>a+capitalAbsorbed(x),0)||1;
   routeShare.clear();for(const x of all)routeShare.set(x,capitalAbsorbed(x)/sum);
  }
 }
 const itemShare=new Map();
 for(const x of all)itemShare.set(x.id,(itemShare.get(x.id)||0)+routeShare.get(x));
 const itemFractionFor=id=>{const ordinary=demandWeighted?Math.max(itemFraction,Math.min(diversifyLanes?.32:.60,(itemShare.get(id)||0)*1.5)):itemFraction;
  if(!forceDiversity||variantParts(id)?.tier<6)return ordinary;
  // T7/T8: una unidad puede superar el 22% de capital aunque cumpla presupuesto.
  const cheapest=Math.min(...all.filter(x=>x.id===id).map(x=>x.capitalPerUnit));
  return Math.max(ordinary,Math.min(.72,cheapest/budgetValue+.02));
 };
 // Diversificación real de tier+enchant, solo si hay suficientes carriles
 // con actividad, beneficio bajo estrés y capital para lotes mínimos.
 const laneOf=x=>{const p=variantParts(x.id);return p?`${p.tier}.${p.enchant}`:'?';};
 const lanes=new Set(all.map(laneOf));
 const laneCapFactor=diversifyLanes&&lanes.size>1?(fameWeight>=.9?.44:fameWeight>=.4?.65:.86):1;
 const laneLimit=budgetValue*(forceDiversity?.74:Math.max(1/lanes.size,Math.min(1,laneCapFactor)));
 const destinations=new Set(all.map(x=>x.city));
 const tiers=new Set(all.map(x=>String(x.id).match(/^T([4-8])_/)?.[1]).filter(Boolean));
 // A single selected Royal city or the sole BM market must not be arbitrarily
 // capped as though the player had selected several destinations.
 const cityLimit=smart&&!opts.bulkMode&&destinations.size>1?budgetValue*Math.max(.45,1/destinations.size+.12):Infinity;
 // A high-volume route already has an activity cap per sale market. An extra
 // arbitrary 72% destination ceiling can leave silver idle with no market basis.
 const tierLimit=smart&&!opts.bulkMode&&tiers.size>1?budgetValue*.60:Infinity;
 // Likewise, never force 15% cash idle just because most viable items share T4.
 const desiredItems=Math.min(maxVariants,Math.max(1,Math.floor(f(opts.targetDifferentItems,12))));
 const orders=[
  all,
  [...all].sort((a,b)=>b.profit/b.capitalPerUnit-a.profit/a.capitalPerUnit),
  [...all].sort((a,b)=>b.profit-a.profit),
  [...all].sort((a,b)=>f(b.demandDaily,b.activity?.observedDaily)-f(a.demandDaily,a.activity?.observedDaily))
 ];
 if(fameWeight>0)orders.push([...all].sort((a,b)=>f(b.craftFame)/b.capitalPerUnit-f(a.craftFame)/a.capitalPerUnit));
 let best=null;
 for(const ordered of orders){
  const counts=new Map(),byItem=new Map(),byCity=new Map(),byTier=new Map(),byLane=new Map();
  let spent=0,focus=0;
  const tierOf=x=>String(x.id).match(/^T([4-8])_/)?.[1]||'?';
  const maxFor=x=>{
   const qty=counts.get(x)||0;
   const cashRoom=Math.floor((budgetValue-spent+1e-8)/x.capitalPerUnit);
   const focusRoom=Number.isFinite(focusLimit)&&f(x.focusPerUnit)>0?Math.floor((focusLimit-focus+1e-8)/x.focusPerUnit):Infinity;
   const itemRoom=Math.floor((budgetValue*itemFractionFor(x.id)-(byItem.get(x.id)||0)+1e-8)/x.capitalPerUnit);
   const cityRoom=Math.floor((cityLimit-(byCity.get(x.city)||0)+1e-8)/x.capitalPerUnit);
   const tierRoom=Math.floor((tierLimit-(byTier.get(tierOf(x))||0)+1e-8)/x.capitalPerUnit);
   // Con T6–T8 viables, no gastar todo el capital en T4 y T5 solo porque son más baratos.
   const highTierAvailable=forceDiversity&&[...tiers].some(t=>Number(t)>=6);
   const lowerSpent=(byTier.get('4')||0)+(byTier.get('5')||0);
   const lowTierRoom=highTierAvailable&&['4','5'].includes(tierOf(x))?Math.floor((budgetValue*diversityRules.lowTierBudgetShare-lowerSpent+1e-8)/x.capitalPerUnit):Infinity;
   const laneRoom=Math.floor((laneLimit-(byLane.get(laneOf(x))||0)+1e-8)/x.capitalPerUnit);
   return Math.max(0,Math.min(x.intelligentCapacity-qty,cashRoom,focusRoom,itemRoom,cityRoom,tierRoom,lowTierRoom,laneRoom));
  };
  const take=(x,count)=>{
   if(!counts.has(x)&&counts.size>=maxVariants)return 0;
   const room=maxFor(x);
   // Una ruta nueva entra con su lote mínimo útil o no entra.
   const n=Math.floor(counts.has(x)?Math.min(count,room):room>=x.minLot?Math.min(Math.max(count,x.minLot),room):0);
   if(n<1)return 0;
   counts.set(x,(counts.get(x)||0)+n);spent+=n*x.capitalPerUnit;focus+=n*f(x.focusPerUnit);
   byItem.set(x.id,(byItem.get(x.id)||0)+n*x.capitalPerUnit);
   byCity.set(x.city,(byCity.get(x.city)||0)+n*x.capitalPerUnit);
   byTier.set(tierOf(x),(byTier.get(tierOf(x))||0)+n*x.capitalPerUnit);
   byLane.set(laneOf(x),(byLane.get(laneOf(x))||0)+n*x.capitalPerUnit);
   return n;
  };
  if(smart){
   // Phase one: recorrer combinaciones T/encantamiento con margen y actividad.
   const seedOrder=diversifyLanes?(()=>{
    const lanes=new Map();for(const x of ordered){const key=laneOf(x);const group=lanes.get(key)||[];group.push(x);lanes.set(key,group);}
    const groups=[...lanes.values()].sort((a,b)=>forceDiversity?(variantParts(b[0].id)?.tier||0)-(variantParts(a[0].id)?.tier||0)||val(b[0])-val(a[0]):val(b[0])-val(a[0]));const pool=[];
    let index=0;while(index<ordered.length){let added=0;for(const group of groups)if(group[index]){pool.push(group[index]);added++;}if(!added)break;index++;}
    return pool;
   })():ordered;
   const seeded=new Set();
   if(diversifyLanes){
    // Cada tier tiene una lista de alternativas, NO un solo representante.
    // Una ruta barata puede no caber por Focus, por profundidad o por exposición;
    // si falla hay que intentar otra del mismo tier antes de descartarlo.
    const optionsByTier=new Map();
    for(const x of seedOrder){const tier=tierOf(x),list=optionsByTier.get(tier)||[];
     list.push(x);optionsByTier.set(tier,list);
    }
    const tierChoices=[...optionsByTier].sort((a,b)=>forceDiversity?Number(b[0])-Number(a[0]):0);
    for(const [,options] of tierChoices){
     const choices=[...options].sort((a,b)=>forceDiversity?
      a.capitalPerUnit-b.capitalPerUnit||val(b)-val(a):val(b)-val(a));
     for(const x of choices){
      if(maxFor(x)<x.minLot)continue;
      if(take(x,1)){seeded.add(x.id);break;}
     }
    }
   }
   for(const x of seedOrder){
    if(seeded.size>=desiredItems||counts.size>=maxVariants)break;
    if(seeded.has(x.id))continue;
    if(take(x,1))seeded.add(x.id);
   }
   // If capital allows, round-robin remaining items instead of monopolizing
   // the first route. This only considers routes with positive calculated profit.
   // En modo demanda el reparto lo hace la fase proporcional posterior; la ronda
   // por turnos daba ~48 unidades a cada ruta sin mirar su actividad.
   const available=demandWeighted?[]:ordered.filter(x=>counts.has(x));
   for(let pass=0;pass<12;pass++){
    let added=0;
    for(const x of available)added+=take(x,Math.max(1,Math.min(4,Math.floor(maxFor(x)/Math.max(1,12-pass)))));
    if(!added)break;
   }
  }else{
   // Legacy route behavior for calculators that call this allocator directly.
   for(const x of ordered)take(x,maxFor(x));
  }
  // v8.7.0 · Fase de demanda: cada ruta recibe capital proporcional a lo que su
  // mercado puede absorber. Un objeto con 10 veces más actividad recibe ~10 veces
  // más unidades (hasta su capacidad), en vez de un tope plano igual para todos.
  if(demandWeighted){
   for(const x of ordered){
    const target=Math.floor(budgetValue*routeShare.get(x)/x.capitalPerUnit);
    const missing=target-(counts.get(x)||0);
    if(missing>0)take(x,missing);
   }
  }
  // Finish with constrained profit-weighted capacity, even in smart mode.
  // The limits remain active for every item and city.
  for(const x of ordered)take(x,maxFor(x));
  const rows=[...counts].filter(([,q])=>q>0).map(([x,qty])=>({
   ...x,qty,maxCrafts:x.intelligentCapacity,fameTotal:qty*f(x.craftFame),allocation:qty*x.capitalPerUnit,itemExposureFraction:itemFractionFor(x.id),demandShare:routeShare.get(x),
   totalProfit:routeProfitAtQuantity(x,qty)
  })).filter(x=>x.totalProfit>0);
  const score=rows.reduce((a,x)=>a+x.qty*val(x),0);
  const profit=rows.reduce((a,x)=>a+x.totalProfit,0);
  const itemCount=new Set(rows.map(x=>x.id)).size;
  const variantCount=new Set(rows.map(x=>{const p=variantParts(x.id);return p?p.tier+'.'+p.enchant:'?' })).size;
  // Reward having several profitable, truly distinct items but avoid driving
  // profit below zero or manufacturing unprofitable filler stock.
  const metric=score*(smart?(1+.04*Math.min(24,itemCount)+Math.min(.30,Number(opts.diversityWeight||0)*Math.max(0,variantCount-1))):1)+(opts.bulkMode&&opts.useAll?(spent/Math.max(1,budgetValue))*Math.max(1,score)*.20:0);
  const coveredTiers=new Set(rows.map(r=>variantParts(r.id)?.tier)).size;
  const coveredLanes=new Set(rows.map(r=>laneOf(r))).size;
  const priority=forceDiversity?coveredTiers*100+coveredLanes:0;
  if(!best||priority>best.priority||priority===best.priority&&(metric>best.metric+1e-8||(Math.abs(metric-best.metric)<1e-8&&profit>best.profit)))
   best={rows,metric,profit,priority};
 }
 if(!best)return empty;
 const rows=best.rows,totalCost=rows.reduce((a,x)=>a+x.allocation,0);
 const stats=portfolioDiversityStats(rows,{budget:budgetValue,pending});
 return {rows,capital:budgetValue,totalCost,totalNetCost:rows.reduce((a,x)=>a+x.qty*x.cost,0),
  totalProfit:best.profit,focusUsed:rows.reduce((a,x)=>a+x.qty*f(x.focusPerUnit),0),
  remaining:Math.max(0,budgetValue-totalCost),diversity:stats,totalFame:rows.reduce((a,x)=>a+f(x.fameTotal),0),fameWeight,
  method:forceDiversity?'Diversidad prioritaria: reserva por tier, lotes conservadores por objeto y límite de capital T4/T5; historial AODP observado, no venta garantizada':opts.bulkMode?'Producción de volumen: actividad semanal superior a 50; reinversión del presupuesto sin reserva; topes dinámicos, mercado e inventario pendiente':smart?'Cartera inteligente: objetos distintos primero; topes por artículo, tier, destino e inventario pendiente':
   'asignación conjunta multi-inicio; resultado aproximado'};
}
