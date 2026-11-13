// Conservatively evaluate whether a published price can support an actual
// crafting recommendation.  Market observations are *not* completed sales.
// No result from this module guarantees fill, profit, or sale time.
import {routeProfitAtQuantity} from './depth.js';
import {evaluateListingSpread} from './market-intelligence.js';

const valid=x=>Number.isFinite(Number(x))?Number(x):0;
export function evaluateCraftViability(route,{budget=Infinity,mode='royal',minROI=null,capFraction=.10,diversityPriority=false}={}){
 const reasons=[];
 const capital=valid(route?.capitalPerUnit),cost=valid(route?.cost),quote=valid(route?.sell),profit=valid(route?.profit);
 const isBM=route?.city==='Black Market',listed=route?.mode==='listed';
 const strict=mode==='level';
 const highTier=diversityPriority&&!strict&&/^T[6-8]_/.test(String(route?.id||''));
 const threshold=minROI??(highTier?.005:(strict?.09:.06));
 const maxExposure=highTier?.70:(strict?.22:.35);
 const activity=route?.activity||null;
 const spreadAudit=evaluateListingSpread(route,{strict});
 if(!spreadAudit.ok)reasons.push(spreadAudit.reason);
 const days=valid(activity?.activeDays||Math.min(14,activity?.observations||0));
 const frequency=valid(activity?.observedDaily),personal=valid(route?.personalLearning?.qtySold);
 const confidence=valid(route?.confidence?.score);
 if(!(capital>0&&cost>0&&quote>0&&profit>0))reasons.push('sin margen neto positivo o sin costo verificable');
 if(!(Number.isFinite(route?.ageHours)&&route.ageHours>=0&&route.ageHours<=(strict ? 18 : 24)))reasons.push('cotización antigua o sin fecha');
 if(capital>0&&profit/capital<threshold)reasons.push('margen insuficiente para el riesgo');
 if(!Number.isFinite(route?.stressProfit)||(!highTier&&route.stressProfit<=0)||highTier&&route.stressProfit<-capital*.40)reasons.push('pérdida en escenario conservador demasiado alta');
 if(Number.isFinite(budget)&&budget>0&&capital>budget*maxExposure)reasons.push('una sola unidad inmoviliza demasiado capital');
 if(isBM){
  if(!listed){
   if(!route.depthVerified||!(valid(route.marketCapacity)>0)||!route.orderLevels?.length)reasons.push('Mercado Negro sin compras verificadas');
   else if(!(routeProfitAtQuantity(route,1)>0))reasons.push('la primera orden del Mercado Negro no cubre el costo');
  }else{
   // Una orden de venta espera a la puja del NPC. No existe capacidad BM
   // de compra instantánea que represente absorción de nuestro anuncio.
   // Preferimos un historial observado con >= 3 días; si no, no comprar.
   if(!(days>=3&&frequency>=1)&&personal<3)reasons.push('BM: actividad histórica insuficiente para anunciar y esperar');
   if(route.referenceSide!=='buy_price_max')reasons.push('BM: precio de referencia no corresponde a la puja del NPC');
  }
 }else{
  if(route.mode==='instant'){
   if(!route.depthVerified||!(valid(route.marketCapacity)>0))reasons.push('venta inmediata sin compras verificadas');
  }else if(listed){
   if(!(days>= (strict ? 5 : 3)&&frequency >= (strict ? 2 : 1))&&personal<3)reasons.push('actividad Royal insuficiente: precio publicado no demuestra venta');
   const ahead=valid(route.competition?.unitsAhead);
   if(route.competition?.known&&ahead>Math.max(20,frequency*3)&&personal<3)reasons.push('demasiadas órdenes Royal por delante');
   if(!route.competition?.known&&capital>Math.min(350_000,Number.isFinite(budget)?budget*.06:350_000)&&personal<3&&!(highTier&&days>=5&&frequency>=2))reasons.push('artículo costoso sin competencia Royal comprobada');
  }
 }
 if(strict&&confidence>0&&confidence<45)reasons.push('confianza de cotización insuficiente');
 // A price above recent observed history is not necessarily an attainable price.
 // Deduct that optimism rather than displaying an inflated expected profit.
 const historical=valid(activity?.medianPrice)||valid(activity?.avgPrice),units=Math.max(1,valid(route?.craftAmount)||1);
 const overpriced=!isBM&&historical>0&&quote>historical?quote-historical:0;
 const priceDeduction=overpriced*units*(1-valid(route?.saleTaxPercent)/100-(listed?valid(route?.setupRate):0));
 // If user left optional station/transport inputs at zero, reserve a small
 // buffer instead of silently treating a potentially expensive craft as free.
 const unknownStation=route?.stationCost==null||Number(route.stationCost)===0;
 const destination=route.city==='Black Market'?'Caerleon':route.city;
 const crossCity=route.craftCity&&route.craftCity!==destination;
 const unknownTransit=crossCity&&!(valid(route?.transportCost)>0);
 const materialsAway=(route.materials||[]).some(m=>m.city&&m.city!==route.craftCity&&!(valid(m.shippingPerUnit)>0));
 const costReserve=capital*((unknownStation ? .015 : 0)+(unknownTransit ? .005 : 0)+(materialsAway ? .005 : 0));
 const prudentProfit=profit-Math.max(0,priceDeduction)-costReserve;
 const prudentStress=valid(route?.stressProfit)-Math.max(0,priceDeduction)-costReserve;
 if(priceDeduction>0&&(prudentProfit<=0||prudentProfit/capital<threshold||!highTier&&prudentStress<=0))reasons.push('precio de oferta muy superior al historial');
 if(!(prudentProfit>0&&prudentProfit/capital>=threshold&&(highTier?prudentStress>=-capital*.40:prudentStress>0)))reasons.push('margen insuficiente tras reservar gastos de fabricación y transporte');
 return {ok:reasons.length===0,reasons,prudentProfit,prudentStress,costReserve,
   ageHours:route?.ageHours,observedDays:days,observedDaily:frequency,
   maxInitialCrafts:Math.max(0,Math.floor(Number.isFinite(budget)?budget*maxExposure/Math.max(1,capital):Infinity))};
}
export function safeBookCraftCapacity(route,minMargin=.06){
 if(!route?.orderLevels?.length||!route.depthVerified)return 0;
 const cap=Math.min(200,Math.max(0,Math.floor(valid(route.marketCapacity))));
 let prev=0,accepted=0;
 for(let qty=1;qty<=cap;qty++){
  const current=routeProfitAtQuantity(route,qty);
  if(current===null||!(current-prev>Math.max(0,valid(route.capitalPerUnit))*minMargin))break;
  prev=current;accepted=qty;
 }
 return accepted;
}
export function filterViableCraftRoutes(routes,{budget=Infinity,mode='royal',capFraction=.10,diversityPriority=false}={}){
 const accepted=[],rejected=[],reasons=new Map();
 for(const route of routes||[]){const check=evaluateCraftViability(route,{budget,mode,capFraction,diversityPriority});
  if(check.ok){const safe={...route,profit:check.prudentProfit,stressProfit:check.prudentStress,priceDeduction:Math.max(0,route.profit-check.prudentProfit),costReserve:check.costReserve,roi:100*check.prudentProfit/Math.max(1,route.cost),diversityRisk:check.prudentStress<0};
   // Hard upper bound, independent of what later allocator decides.
   if(Number.isFinite(route.marketCapacity))safe.marketCapacity=Math.min(route.marketCapacity,check.maxInitialCrafts);
   if(route.mode==='instant')safe.marketCapacity=Math.min(safe.marketCapacity??0,safeBookCraftCapacity(safe,mode==='level' ? .09 : .06));
   if(Number.isFinite(safe.marketCapacity)&&safe.marketCapacity<1){
    const reason='la profundidad verificable no admite una fabricación con margen seguro';
    rejected.push({id:route.id,city:route.city,reasons:[reason]});
    reasons.set(reason,(reasons.get(reason)||0)+1);
   }else accepted.push(safe);
  }else{rejected.push({id:route.id,city:route.city,reasons:check.reasons});for(const r of check.reasons)reasons.set(r,(reasons.get(r)||0)+1);}
 }
 return {accepted,rejected,reasons:[...reasons].sort((a,b)=>b[1]-a[1]).map(([reason,count])=>({reason,count}))};
}
