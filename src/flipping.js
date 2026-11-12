/**
 * Original cross-market arbitrage simulator for AODP West.
 * Uses observed asks for purchases and observed bids for immediate sales.
 * AODP price snapshots and historical activity do NOT guarantee executable depth.
 * No source code from third-party proprietary/non-commercial clients is included.
 */
import {freshestQuotes} from './market.js';
import {variant} from './branches.js';

export const FLIP_DEFAULTS = Object.freeze({
  budget:10_000_000, daysToSell:3, maxQuoteHours:24,
  buyBufferPct:4, sellHaircutPct:2, taxPct:4,
  transportPerUnit:1000, minRoiPct:8, maxSkuSharePct:25,
  demandSharePct:15, minActiveDays:2, stressPct:10,
  requireStressProfit:false, diverse:true, maxRoutes:30,
  sources:['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford','Caerleon','Brecilien'],
  targets:['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford','Caerleon','Brecilien','Black Market']
});
const MARKETS = [...new Set([...FLIP_DEFAULTS.sources,...FLIP_DEFAULTS.targets])];
const percent=(value,fallback,max=100)=>Math.min(max,Math.max(0,Number.isFinite(Number(value))?Number(value):fallback));
export function flipSettings(input={}){
 const c={...FLIP_DEFAULTS,...input};
 const finite=(v,f,min,max)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):f;
 c.budget=Math.round(finite(c.budget,10_000_000,1000,1e12));
 c.daysToSell=Math.round(finite(c.daysToSell,3,1,14));
 c.maxQuoteHours=finite(c.maxQuoteHours,24,1,168);
 for(const k of ['buyBufferPct','sellHaircutPct','taxPct','minRoiPct','maxSkuSharePct','demandSharePct','stressPct'])c[k]=percent(c[k],FLIP_DEFAULTS[k],k==='taxPct'?30:100);
 c.transportPerUnit=finite(c.transportPerUnit,1000,0,1e9);
 c.minActiveDays=Math.round(finite(c.minActiveDays,2,1,14));
 c.maxRoutes=Math.round(finite(c.maxRoutes,30,1,100));
 c.sources=[...new Set((Array.isArray(c.sources)?c.sources:[]).filter(m=>MARKETS.includes(m)&&m!=='Black Market'))];
 c.targets=[...new Set((Array.isArray(c.targets)?c.targets:[]).filter(m=>MARKETS.includes(m)))];
 c.diverse=c.diverse!==false;c.requireStressProfit=c.requireStressProfit===true;
 return c;
}
const best=(quotes,id,city,kind,hours,now)=>freshestQuotes(quotes,id,city,kind,hours,now)[0]||null;
function baseRoute({id,from,to,ask,bid,hist,c}){
 const daily=Number(hist.quality1DailyUnits||0),active=Number(hist.quality1ActiveDays||0);
 if(!(daily>0)||active<c.minActiveDays)return {rejected:'Sin actividad Q1 suficiente en el destino'};
 const buyPerUnit=ask.price*(1+c.buyBufferPct/100),netBid=bid.price*(1-(c.taxPct+c.sellHaircutPct)/100);
 const costPerUnit=buyPerUnit+c.transportPerUnit,margin=netBid-costPerUnit;
 const roi=margin/Math.max(1,costPerUnit)*100;
 if(!(margin>0)||roi<c.minRoiPct)return {rejected:'Margen neto inferior al mínimo'};
 const limit=Math.floor(daily*c.daysToSell*c.demandSharePct/100);
 if(limit<1)return {rejected:'Cuota prudente Q1 inferior a una unidad'};
 const stressed=bid.price*(1-(c.taxPct+c.sellHaircutPct+c.stressPct)/100)-costPerUnit;
 if(c.requireStressProfit&&stressed<=0)return {rejected:'Pérdida en escenario de estrés'};
 return {id,from,to,sourcePrice:ask.price,targetPrice:bid.price,
  sourceObservedAt:new Date(ask.time).toISOString(),targetObservedAt:new Date(bid.time).toISOString(),
  q1Daily:daily,q1ActiveDays:active,totalDaily:Number(hist.averageDailyUnits||0),
  buyPerUnit,netBid,costPerUnit,marginPerUnit:margin,roi,stressedPerUnit:stressed,
  maxUnits:limit,qty:0,routeKey:id+'|'+from+'|'+to,
  tier:variant(id)?.tier||0,ench:variant(id)?.ench||0};
}
export function scanFlipRoutes({ids=[],quotes=new Map(),history=[],config={},now=Date.now()}={}){
 const c=flipSettings(config),candidates=[],rejections=[];
 const marketHistory=new Map(history.map(h=>[h.id+'|'+h.city,h]));
 for(const id of [...new Set(ids)].filter(x=>/^[A-Z0-9_@-]{3,100}$/.test(x))){
  for(const from of c.sources){
   const ask=best(quotes,id,from,'ask',c.maxQuoteHours,now);
   if(!ask){rejections.push({id,from,reason:'Sin oferta reciente de compra en origen'});continue;}
   for(const to of c.targets){
    if(from===to)continue;
    const bid=best(quotes,id,to,'bid',c.maxQuoteHours,now);
    const hist=marketHistory.get(id+'|'+to);
    if(!bid||!hist){rejections.push({id,from,to,reason:!bid?'Sin puja reciente en destino':'Sin historial Q1 del destino'});continue;}
    const route=baseRoute({id,from,to,ask,bid,hist,c});
    if(route.rejected)rejections.push({id,from,to,reason:route.rejected});else candidates.push(route);
   }
  }
 }
 return {candidates,rejections,config:c};
}
function forecast(row,units,c){
 const marketShare=units/Math.max(1,row.q1Daily*c.daysToSell);
 const additionalImpact=Math.min(.12,marketShare*.15);
 const proceeds=units*row.netBid*(1-additionalImpact);
 const capital=units*row.costPerUnit;
 return {profit:proceeds-capital,capital,proceeds,impactPct:additionalImpact*100,
  stressProfit:units*(row.stressedPerUnit-row.netBid*additionalImpact),
  roi:capital?(proceeds-capital)/capital*100:0};
}
/** Distribute capital, keeping budget and item caps strict; never force a loss. */
export function allocateFlips({candidates=[],config={},rejections=[]}={}){
 const c=flipSettings(config),unique=new Map(),reason=new Map(),capitalById=new Map();
 for(const row of candidates){
  const prior=unique.get(row.routeKey);
  if(!prior||row.marginPerUnit>prior.marginPerUnit)unique.set(row.routeKey,{...row,qty:0});
 }
 const routes=[...unique.values()].sort((a,b)=>{
  const sa=a.roi*Math.log1p(a.q1Daily)+Math.max(0,a.marginPerUnit)/10000;
  const sb=b.roi*Math.log1p(b.q1Daily)+Math.max(0,b.marginPerUnit)/10000;
  return sb-sa;
 });
 const selected=new Map();let remaining=c.budget;
 function addUnit(row){
  const key=row.routeKey,cap=c.budget*c.maxSkuSharePct/100;
  if(row.qty>=row.maxUnits){reason.set(key,'Cuota de historial Q1 agotada');return false;}
  if(!selected.has(key)&&selected.size>=c.maxRoutes){reason.set(key,'Límite de rutas distintas');return false;}
  if(remaining+1e-7<row.costPerUnit){reason.set(key,'Presupuesto insuficiente');return false;}
  if((capitalById.get(row.id)||0)+row.costPerUnit>cap+1e-7){reason.set(key,'Cuota máxima del capital por artículo');return false;}
  const next=forecast(row,row.qty+1,c);
  if(!(next.profit>0)||next.roi<c.minRoiPct){reason.set(key,'El tamaño del lote elimina el beneficio mínimo');return false;}
  if(c.requireStressProfit&&next.stressProfit<=0){reason.set(key,'Estrés negativo');return false;}
  row.qty++;remaining-=row.costPerUnit;capitalById.set(row.id,(capitalById.get(row.id)||0)+row.costPerUnit);selected.set(key,row);reason.delete(key);
  return true;
 }
 if(c.diverse){
  // Breadth-first across high tiers and destinations; only viable, never guaranteed fills.
  const initial=[...routes].sort((a,b)=>b.tier-a.tier||a.ench-b.ench||b.roi-a.roi);
  for(const row of initial)addUnit(row);
 }else for(const row of routes)addUnit(row);
 for(let i=0;i<300;i++){
  let progress=false;
  for(const row of routes)if(selected.has(row.routeKey)&&addUnit(row))progress=true;
  if(!progress)break;
 }
 const rows=[...selected.values()].map(r=>({...r,...forecast(r,r.qty,c)})).sort((a,b)=>b.profit-a.profit);
 const capital=rows.reduce((s,r)=>s+r.capital,0),profit=rows.reduce((s,r)=>s+r.profit,0);
 if(capital>c.budget+.01||rows.some(r=>r.profit<=0||r.roi<c.minRoiPct))throw Error('Invariante de capital/profit de Flip incumplido');
 return {rows,rejections:[...rejections,...routes.filter(r=>!r.qty).map(r=>({id:r.id,from:r.from,to:r.to,reason:reason.get(r.routeKey)||'Ruta viable pero descartada por prioridad'}))],
  summary:{budget:c.budget,capital,remaining:c.budget-capital,profit,units:rows.reduce((s,r)=>s+r.qty,0),routes:rows.length,roi:capital?profit/capital*100:0},
  warnings:['Cotizaciones y actividad no certifican profundidad, ejecuciones ni disponibilidad para estas cantidades.','Coste de transporte manual por unidad; pérdidas por gankeo o rutas peligrosas no incluidos.']};
}
