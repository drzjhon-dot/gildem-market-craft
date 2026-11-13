// v8.6.3: auditable evidence per planned route. AODP history is based on
// observed sell-side records, NOT a confirmation of completed sales.
const n=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Math.max(0,Number(v)):null;
const whole=v=>Math.max(0,Math.floor(n(v)??0));
const fmt=v=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:1}).format(v);
export function evidenceForRoute(route,{horizonDays=14,supplyPending=false}={}){
 const qty=whole(route?.qty),perCraft=Math.max(1,whole(route?.craftAmount)||1),units=qty*perCraft;
 const age=n(route?.ageHours),observed=n(route?.demandDaily);
 const quote=age===null?'sin fecha':age<=24?'reciente':age<=72?'provisional':'caducada';
 const historySource=route?.externalDemand?'tabla West importada (no independiente)':
  observed===null?'sin historial':'AODP West: órdenes observadas';
 const evidenceDays=whole(route?.activity?.activeDays);
 const firstBatch=route?.procurementFirstBatch!=null
  ?Math.min(qty,whole(route.procurementFirstBatch))
  :route?.patientSupplyPending||supplyPending?null:qty;
 const needsStaging=!!(route?.patientSupplyPending||firstBatch!==null&&firstBatch<qty||firstBatch===null&&supplyPending);
 const procurement=firstBatch===null?'sin profundidad concluyente':needsStaging?'por etapas':'lote acotado por datos observados';
 // Exposure estimate ONLY. Not estimated completed-sales or a delivery promise.
 const horizon=Math.max(1,Math.min(30,whole(horizonDays)||14));
 const signalUnits=observed===null?null:observed*horizon;
 const ratio=signalUnits>0?units/signalUnits:null;
 const alerts=[];
 if(observed===null)alerts.push('sin actividad observada: no inferir ventas');
 else if(observed===0)alerts.push('actividad observada cero: no inferir capacidad de venta');
 if(route?.externalDemand)alerts.push('cantidad de una tabla importada, no verificable automáticamente');
 if(route?.salePriceProvisional)alerts.push('precio objetivo BM basado en historial, NO puja actual: verificar antes de fabricar');
 if(quote!=='reciente')alerts.push(`cotización ${quote}; revalidar antes de invertir`);
 if(needsStaging)alerts.push('compra completa no comprobada al precio presupuestado');
 if(route?.city==='Black Market')alerts.push('orden propia BM: puja NPC no asegura compra futura');
 if(n(route?.competition?.unitsAhead)>0)alerts.push(`${fmt(route.competition.unitsAhead)} unidades anunciadas por delante`);
 return {id:route?.id||'',city:route?.city||'',qty,units,quote,ageHours:age,observedDaily:observed,
  observedDays:evidenceDays,historySource,firstBatch,needsStaging,procurement,ratio,horizonDays:horizon,alerts};
}
export function evidenceForPlan(plan,{horizonDays=14,supplyPending=false}={}){
 const rows=(plan?.rows||[]).map(row=>evidenceForRoute(row,{horizonDays,supplyPending}));
 const ready=rows.filter(r=>r.quote==='reciente'&&!r.needsStaging&&r.observedDaily!==null).length;
 const staged=rows.filter(r=>r.needsStaging).length;
 const incomplete=rows.filter(r=>r.quote!=='reciente'||r.observedDaily===null).length;
 const quoted=rows.filter(r=>r.quote==='reciente').length;
 return {rows,ready,staged,incomplete,quoted,total:rows.length,
  disclaimer:'AODP West registra observaciones del mercado; actividad no equivale a ventas ejecutadas. Órdenes y precios pueden cambiar.'};
}
