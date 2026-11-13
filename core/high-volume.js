// Gildem Craft Pro 8.6.6 · volumen realista para Black Craft y Royal Craft.
// El historial AODP contiene observaciones, NO certifica ventas ejecutadas.
const finite=(v)=>(v===null||v===undefined||v==='')?null:Number.isFinite(Number(v))?Math.max(0,Number(v)):null;
export const MIN_WEEKLY_ACTIVITY=50;
export function observedWeeklyActivity(route){
 if(!route)return null;
 // Un ranking externo fechado y confirmado West es una estimación manual,
 // nunca una orden ejecutada. El dato se conserva separado del precio AODP.
 if(route.externalDemand&&finite(route.demandDaily)!==null)
  return {units:finite(route.demandDaily)*7,source:route.demandSource||'Importación manual West',provisional:true};
 const recent=route.activity7;
 if(recent?.observations>0&&finite(recent.count)!==null)
  return {units:finite(recent.count)*Math.min(1.46,Math.max(1,finite(route.qualityFactor)||1)),
   source:'AODP West · actividad de 7 días ajustada con calidades (estimación, no ventas)',provisional:true};
 const daily=finite(route.demandDaily??(route.activity?.observations>0?route.activity.observedDaily:null));
 if(daily!==null)return {units:daily*7,source:'AODP West · promedio histórico extrapolado a 7 días',provisional:true};
 return null;
}
export function bulkMarketCandidates(routes,{minWeekly=MIN_WEEKLY_ACTIVITY,requireStress=true,diversityPriority=false}={}){
 const accepted=[],rejected=[];
 for(const route of routes||[]){
  const signal=observedWeeklyActivity(route);
  const positive=Number(route?.profit)>0&&Number(route?.cost)>0&&Number(route?.capitalPerUnit)>0;
  const tier=Number(String(route?.id||'').match(/^T([1-8])_/)?.[1]||0);
  const relaxed=diversityPriority&&tier>=6;
  const floor=relaxed?(tier===8?2:tier===7?5:12):minWeekly;
  const hasHistory=!relaxed||route.depthVerified||Number(route?.activity?.activeDays)>=2||Number(route?.activity7?.observations)>=2;
  const stressed=!requireStress||Number(route?.stressProfit)>0;
  if(positive&&stressed&&hasHistory&&signal&&signal.units>floor){
   accepted.push({...route,weeklyObserved:signal.units,weeklySource:signal.source,bulkQualified:true});
  }else rejected.push({id:route?.id,city:route?.city,reason:!signal?'Sin observaciones semanales':!hasHistory?'Historial demasiado intermitente':signal.units<=floor?'Actividad semanal insuficiente':!positive?'Sin margen neto positivo':'Margen negativo en escenario conservador'});
 }
 return {accepted,rejected,minWeekly};
}
// Más rutas viables => diversificar más. Menos rutas NO significa saturar:
// sigue existiendo límite por producto y sobre todo capacidad por rotación.
export function bulkItemExposureFraction(routes){
 const count=new Set((routes||[]).map(x=>x.id).filter(Boolean)).size;
 // Limits are an anti-concentration guard, not a minimum cash reserve. With
 // 2 items, 40% each made it impossible to spend more than 80% of the budget.
 // Actual allocation remains bounded by observed demand, competition, existing
 // inventory and affordable input materials for every exact sale market.
 if(count>=15)return .11;
 if(count>=12)return .13;
 if(count>=9)return .16;
 if(count>=7)return .19;
 if(count>=5)return .24;
 if(count>=4)return .29;
 if(count>=3)return .38;
 if(count>=2)return .52;
 return .75; // one item alone never justifies committing every silver
}
export function portfolioFillSummary(plan,budget,{minWeekly=MIN_WEEKLY_ACTIVITY,eligible=0}={}){
 const capital=Math.max(0,Number(budget)||0),used=Math.max(0,Number(plan?.totalCost)||0);
 const remaining=Math.max(0,capital-used),percent=capital?used/capital*100:0;
 return {budget:capital,used,remaining,percent,eligible,minWeekly,
  explanation:remaining<=Math.max(1,capital*.01)?'Presupuesto prácticamente asignado':'El capital no asignado se conserva porque las oportunidades verificables, los topes de saturación o las cantidades enteras no permiten invertirlo de forma prudente.'};
}
