// v9.11 · Cumplimiento estricto de la configuración del plan (Black Craft y Royal Craft).
// Se aplica al plan final y a las tres propuestas, DESPUÉS del motor. Cuatro reglas:
//  1. Filtros duros: tiers, encantamientos, objetos de la rama, destino (MN / ciudades Royal
//     marcadas), ciudad de fabricación elegida (o la de bono), máximo de ciudades de
//     fabricación y Focus activado/desactivado.
//  2. Límites estrictos: cada ruta ≤ su capacidad por estilo y días de venta; cada objeto
//     ≤ el % máximo de capital del estilo. Sin excepciones automáticas.
//  3. Cobertura: al menos un lote de cada combinación tier/encantamiento marcada que tenga
//     una ruta rentable y quepa en los límites (se liberan unidades de las combinaciones
//     más grandes si falta capital).
//  4. Usar todo: con «Usar todo» el capital sobrante se invierte en las rutas con más
//     beneficio marginal, sin pérdidas y sin pasar los límites.
// Lo que no se puede cumplir se explica en el informe; nunca se inventan rutas ni ventas.
import {routeProfitAtQuantity} from './depth.js';
import {resolveStyle,impactCapacity,horizonVolumeUnits} from './market-impact.js';
import {capacityFor,minUsefulLot} from './allocator-v6.js';
import {variantParts} from './craft-plan-controls.js';
const f=(x,d=0)=>Number.isFinite(Number(x))?Number(x):d;
const comboOf=id=>{const p=variantParts(id);return p?`T${p.tier}.${p.enchant}`:null;};
const routeKey=r=>r.id+'|'+r.city+'|'+r.mode;
const profitAt=(r,q)=>{if(!(q>0))return 0;const p=routeProfitAtQuantity(r,q);return p==null?-Infinity:p;};

/** Capacidad estricta de una ruta según el estilo y los días de venta. */
export function strictCapacity(route,{style,horizonDays=14}={}){
 const sat=resolveStyle(style);
 let cap=capacityFor(route,sat.maxShare,0,horizonDays);
 if(!(route.depthVerified&&route.orderLevels?.length)&&horizonVolumeUnits(route,horizonDays)>0){
  const st=route.city==='Black Market'?{...sat,k:sat.k*.5}:sat;cap=Math.min(cap,impactCapacity(route,{horizonDays,style:st}));
 }
 return Math.max(0,Math.floor(cap));
}
/**
 * @param o.rows        filas del plan (con qty)
 * @param o.pool        rutas viables con economía calculada (candidatos)
 * @param o.cfg         {tiers,enchants,ids,budget,invest,market,saleCities,city,maxCraftCities,focus,focusLimit,style,horizonDays,itemFraction,recipeCity(id)}
 */
export function enforcePlanConfig({rows=[],pool=[],cfg={}}={}){
 const report={removed:[],clipped:[],coverageAdded:[],coverageMissing:[],filled:0,leftoverReason:null};
 const tiers=new Set((cfg.tiers||[]).map(Number)),enchants=new Set((cfg.enchants||[]).map(Number)),ids=cfg.ids?new Set(cfg.ids):null;
 const budget=f(cfg.budget),focusLimit=cfg.focusLimit==null?Infinity:f(cfg.focusLimit),itemFraction=Math.min(1,Math.max(.01,f(cfg.itemFraction,.12)));
 const saleCities=cfg.saleCities?new Set(cfg.saleCities):null,maxCities=cfg.maxCraftCities&&cfg.maxCraftCities!=='all'?Number(cfg.maxCraftCities):Infinity;
 const why=r=>{
  const p=variantParts(r.id);if(!p)return 'Objeto sin tier reconocible';
  if(!tiers.has(p.tier))return `Tier T${p.tier} no marcado`;
  if(!enchants.has(p.enchant))return `Encantamiento .${p.enchant} no marcado`;
  if(ids&&!ids.has(r.id))return 'Fuera de las ramas u objetos elegidos';
  if(cfg.market==='black'&&r.city!=='Black Market')return 'Destino distinto del Mercado Negro';
  if(cfg.market==='royal'&&(r.city==='Black Market'||saleCities&&!saleCities.has(r.city)))return `Ciudad de venta ${r.city} no marcada`;
  if(cfg.city&&cfg.city!=='auto'&&cfg.city!=='compare'&&r.craftCity&&r.craftCity!==cfg.city)return `Fabricar en ${r.craftCity}, no en ${cfg.city}`;
  if(cfg.city==='auto'&&cfg.recipeCity){const home=cfg.recipeCity(r.id);if(home&&r.craftCity&&r.craftCity!==home)return `Fuera de la ciudad de bono (${home})`;}
  if(cfg.focus===false&&f(r.focusPerUnit)>0)return 'Usa Focus con Focus desactivado';
  if(!(f(r.capitalPerUnit)>0)||!(f(r.profit)>0))return 'Sin beneficio';
  return null;};
 // 1 · Filtros duros sobre el plan y el universo de rutas.
 let plan=[];for(const r of rows){const w=why(r);if(w)report.removed.push({id:r.id,city:r.city,reason:w});else plan.push({...r});}
 const seen=new Map();for(const r of pool){if(why(r))continue;const k=routeKey(r),o=seen.get(k);if(!o||f(r.profit)/f(r.capitalPerUnit)>f(o.profit)/f(o.capitalPerUnit))seen.set(k,r);}
 for(const r of plan)if(!seen.has(routeKey(r)))seen.set(routeKey(r),r);
 // Máximo de ciudades de fabricación: se quedan las que más capital tienen en el plan.
 let allowedCities=null;
 if(Number.isFinite(maxCities)){const byCity=new Map();for(const r of plan)byCity.set(r.craftCity,(byCity.get(r.craftCity)||0)+r.qty*f(r.capitalPerUnit));
  const ordered=[...byCity].sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
  if(!ordered.length){const pc=new Map();for(const r of seen.values())pc.set(r.craftCity,(pc.get(r.craftCity)||0)+f(r.profit));ordered.push(...[...pc].sort((a,b)=>b[1]-a[1]).map(x=>x[0]));}
  allowedCities=new Set(ordered.slice(0,maxCities));
  plan=plan.filter(r=>{if(allowedCities.has(r.craftCity))return true;report.removed.push({id:r.id,city:r.city,reason:`Más de ${maxCities} ciudad(es) de fabricación`});return false;});
  for(const [k,r] of seen)if(!allowedCities.has(r.craftCity))seen.delete(k);}
 const universe=[...seen.values()].map(r=>({...r,strictCap:Math.min(strictCapacity(r,cfg),f(r.supplyCap,Infinity))}));
 const capOf=new Map(universe.map(r=>[routeKey(r),r.strictCap]));
 // 2 · Límites estrictos: capacidad por ruta y % de capital por objeto.
 const itemCap=budget*itemFraction;
 for(const r of plan){const cap=capOf.get(routeKey(r))??strictCapacity(r,cfg);
  if(r.qty>cap){report.clipped.push({id:r.id,city:r.city,from:r.qty,to:cap,reason:'Capacidad del estilo y días de venta'});r.qty=cap;}
  r.maxCrafts=Math.min(f(r.maxCrafts,Infinity),cap);}
 const itemCapital=()=>{const m=new Map();for(const r of plan)m.set(r.id,(m.get(r.id)||0)+r.qty*f(r.capitalPerUnit));return m;};
 for(const [id,cap] of itemCapital())if(cap>itemCap+1e-6){
  // Recorta primero las unidades con menos beneficio por silver de ese objeto.
  let excess=cap-itemCap;for(const r of plan.filter(x=>x.id===id).sort((a,b)=>f(a.profit)/f(a.capitalPerUnit)-f(b.profit)/f(b.capitalPerUnit))){
   if(excess<=0)break;const cut=Math.min(r.qty,Math.ceil(excess/f(r.capitalPerUnit)));
   if(cut>0){report.clipped.push({id:r.id,city:r.city,from:r.qty,to:r.qty-cut,reason:`Máximo ${Math.round(itemFraction*100)} % del capital por objeto`});r.qty-=cut;excess-=cut*f(r.capitalPerUnit);}}}
 plan=plan.filter(r=>r.qty>0);
 // Focus: si el plan se pasa, se recortan las unidades con menos beneficio por punto.
 const focusUsed=()=>plan.reduce((a,r)=>a+r.qty*f(r.focusPerUnit),0);
 if(focusUsed()>focusLimit+1e-6){for(const r of [...plan].filter(x=>f(x.focusPerUnit)>0).sort((a,b)=>f(a.profit)/f(a.focusPerUnit)-f(b.profit)/f(b.focusPerUnit))){
  const over=focusUsed()-focusLimit;if(over<=0)break;const cut=Math.min(r.qty,Math.ceil(over/f(r.focusPerUnit)));
  report.clipped.push({id:r.id,city:r.city,from:r.qty,to:r.qty-cut,reason:'Focus disponible'});r.qty-=cut;}
  plan=plan.filter(r=>r.qty>0);}
 const spent=()=>plan.reduce((a,r)=>a+r.qty*f(r.capitalPerUnit),0);
 const roomFor=(r,q)=>{const cap=capOf.get(routeKey(r))??0,inPlan=plan.find(x=>routeKey(x)===routeKey(r));const have=inPlan?.qty||0;
  const item=(itemCapital().get(r.id)||0),capital=f(r.capitalPerUnit);
  const byCap=cap-have,byItem=Math.floor((itemCap-item+1e-6)/capital),byBudget=Math.floor((budget-spent()+1e-6)/capital);
  const byFocus=f(r.focusPerUnit)>0?Math.floor((focusLimit-focusUsed()+1e-6)/f(r.focusPerUnit)):Infinity;
  return Math.max(0,Math.min(q,byCap,byItem,byBudget,byFocus));};
 const add=(r,q)=>{const inPlan=plan.find(x=>routeKey(x)===routeKey(r));if(inPlan)inPlan.qty+=q;else plan.push({...r,qty:q,maxCrafts:capOf.get(routeKey(r))});};
 // 3 · Cobertura de cada tier/encantamiento marcado.
 const wanted=[];for(const t of tiers)for(const e of enchants)wanted.push(`T${t}.${e}`);
 for(const combo of wanted){if(plan.some(r=>comboOf(r.id)===combo))continue;
  const options=universe.filter(r=>comboOf(r.id)===combo&&r.strictCap>0).sort((a,b)=>f(b.profit)/f(b.capitalPerUnit)-f(a.profit)/f(a.capitalPerUnit));
  if(!options.length){report.coverageMissing.push({combo,reason:'Sin ruta rentable con ventas observadas en tus destinos'});continue;}
  let done=false;
  for(const r of options){const lot=Math.max(1,Math.min(r.strictCap,minUsefulLot(r,r.strictCap)));const lotCost=lot*f(r.capitalPerUnit);
   if(lotCost>itemCap+1e-6||lot>r.strictCap)continue;
   if(f(r.focusPerUnit)*lot>focusLimit-focusUsed()+1e-6)continue;
   // Libera capital de las combinaciones con más inversión (manteniendo su primer lote).
   let need=lotCost-(budget-spent());
   if(need>0){const byCombo=new Map();for(const x of plan){const c=comboOf(x.id);byCombo.set(c,(byCombo.get(c)||0)+x.qty*f(x.capitalPerUnit));}
    for(const x of [...plan].sort((a,b)=>(byCombo.get(comboOf(b.id))||0)-(byCombo.get(comboOf(a.id))||0)||f(a.profit)/f(a.capitalPerUnit)-f(b.profit)/f(b.capitalPerUnit))){
     if(need<=0)break;const keep=plan.filter(y=>comboOf(y.id)===comboOf(x.id)).length>1?0:Math.max(1,minUsefulLot(x,x.maxCrafts));
     const cut=Math.min(x.qty-keep,Math.ceil(need/f(x.capitalPerUnit)));if(cut<=0)continue;x.qty-=cut;need-=cut*f(x.capitalPerUnit);}
    plan=plan.filter(x=>x.qty>0);}
   if(lotCost>budget-spent()+1e-6)continue;
   const profit=profitAt(r,lot);if(!(profit>0))continue;
   add(r,lot);report.coverageAdded.push({combo,id:r.id,city:r.city,qty:lot});done=true;break;}
  if(!done)report.coverageMissing.push({combo,reason:'Un lote supera el presupuesto, el % por objeto o el Focus disponible'});
 }
 // 4 · Usar todo: invertir el capital restante por beneficio marginal, sin pérdidas.
 if(cfg.invest==='all'){
  const before=spent();
  for(let guard=0;guard<20000;guard++){
   let best=null;
   for(const r of universe){const inPlan=plan.find(x=>routeKey(x)===routeKey(r)),have=inPlan?.qty||0;
    const step=Math.max(1,Math.floor((r.strictCap||1)/20)),first=have?0:Math.max(1,minUsefulLot(r,r.strictCap));
    const q=roomFor(r,Math.max(step,first));if(q<(have?1:first))continue;
    const gain=profitAt(r,have+q)-profitAt(r,have);if(!(gain>0))continue;
    const score=gain/(q*f(r.capitalPerUnit));if(!best||score>best.score)best={r,q,score};}
   if(!best)break;add(best.r,best.q);
  }
  report.filled=spent()-before;
  const left=budget-spent();
  if(left>budget*.05)report.leftoverReason=`Quedan ${Math.round(left).toLocaleString('es-ES')} silver sin invertir: todas las rutas rentables están en su límite de capacidad (estilo y días de venta), de % por objeto o de Focus.`;
 }
 return {rows:plan.filter(r=>r.qty>0),report};
}
/** Texto breve para mostrar al usuario. */
export function enforcementSummary(report){
 if(!report)return '';const parts=[];
 if(report.removed.length)parts.push(`${report.removed.length} rutas quitadas por no cumplir tu configuración`);
 if(report.clipped.length)parts.push(`${report.clipped.length} rutas recortadas a sus límites`);
 if(report.coverageAdded.length)parts.push(`añadido un lote de ${report.coverageAdded.map(x=>x.combo).join(', ')} para cubrir todos los tiers/encantamientos`);
 if(report.coverageMissing.length)parts.push(`sin ruta posible para ${report.coverageMissing.map(x=>x.combo).join(', ')}`);
 if(report.filled>0)parts.push(`${Math.round(report.filled).toLocaleString('es-ES')} silver más invertidos por «Usar todo»`);
 if(report.leftoverReason)parts.push(report.leftoverReason);
 return parts.join(' · ');
}
