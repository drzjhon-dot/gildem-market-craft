// Gildem Craft Pro v8.8.0 · Modelo de saturación del mercado.
// Cuando fabricas un lote y lo vendes tú solo, tus propias ventas empujan el precio
// hacia abajo. Este módulo estima ese efecto de forma EXPLÍCITA y ajustable:
//  - impacto medio en precio = k × (tu cuota del volumen observado en el horizonte)
//  - el lote crece mientras la ganancia de la ÚLTIMA unidad siga siendo una fracción
//    razonable de la ganancia de la primera ("stop").
// Es una heurística transparente, NO una medición de ventas ejecutadas. Los
// parámetros se pueden calibrar más adelante con las ventas registradas del usuario.
const finite=x=>Number.isFinite(Number(x))?Math.max(0,Number(x)):0;

export const PLAN_STYLES={
 1:{id:'prudent',label:'Prudente',k:.45,stop:.55,maxShare:.12,
    hint:'Lotes pequeños; casi no mueves el precio.'},
 2:{id:'balanced',label:'Equilibrado',k:.30,stop:.40,maxShare:.22,
    hint:'Lotes medios; asumes un impacto moderado si el margen lo compensa.'},
 3:{id:'aggressive',label:'Agresivo',k:.20,stop:.25,maxShare:.35,
    hint:'Lotes grandes en objetos de margen alto; más impacto en el precio.'}
};
export const DEFAULT_STYLE=2;
export function resolveStyle(value){
 if(value&&typeof value==='object'&&Number.isFinite(Number(value.k)))return {...PLAN_STYLES[DEFAULT_STYLE],...value};
 return PLAN_STYLES[Number(value)]||PLAN_STYLES[DEFAULT_STYLE];
}

// Unidades/día observadas para una ruta (null si no hay dato). Una caída reciente
// (últimos 7 días) baja la cifra; una subida reciente nunca la infla.
export function effectiveDaily(route){
 if(!route)return null;
 const a=route.activity;
 const base=route.demandDaily!=null?finite(route.demandDaily)
  :a?.observations>0?finite(a.observedDaily)
  :route.activity30?.observations>0?finite(route.activity30.observedDaily):null;
 if(base===null)return null;
 if(!route.externalDemand&&route.activity7?.observations>0){
  // activity7 es solo calidad Normal: se escala igual que la demanda atendible.
  const recent=finite(route.activity7.observedDaily)*Math.max(1,finite(route.qualityFactor)||1);
  if(recent<base)return recent;
 }
 return base;
}
export function horizonVolumeUnits(route,horizonDays=14){
 const d=effectiveDaily(route);
 if(d===null)return 0;
 return d*Math.min(30,Math.max(1,finite(horizonDays)||14));
}
const netSellPerCraft=route=>{
 const amount=Math.max(1,finite(route.craftAmount)||1);
 const tax=route.saleTaxPercent!=null?finite(route.saleTaxPercent):6.5;
 return finite(route.sell)*amount*(1-tax/100);
};

// Capacidad (en crafts) hasta la que la ganancia marginal sigue siendo útil.
export function impactCapacity(route,{horizonDays=14,style=DEFAULT_STYLE}={}){
 const s=resolveStyle(style),volume=horizonVolumeUnits(route,horizonDays);
 const profit=finite(route?.profit),net=netSellPerCraft(route||{});
 if(!(volume>0)||!(profit>0)||!(net>0))return 0;
 const amount=Math.max(1,finite(route.craftAmount)||1);
 // ganancia marginal(s) = profit - net·2k·s  →  se anula en s0 = profit/(2k·net)
 const s0=profit/(2*s.k*net);
 const share=Math.min(s.maxShare,(1-s.stop)*s0);
 return Math.max(1,Math.floor(share*volume/amount));
}
// Pérdida de ingreso por saturación al vender `crafts` lotes de la ruta.
export function saturationLoss(route,crafts){
 const sat=route?.saturation;
 if(!sat||!(crafts>0)||!(sat.volumeUnits>0))return 0;
 const amount=Math.max(1,finite(route.craftAmount)||1);
 const share=Math.min(1,crafts*amount/sat.volumeUnits);
 const discount=Math.min(.5,sat.k*share); // descuento MEDIO sobre todas las unidades
 return netSellPerCraft(route)*crafts*discount;
}
export function saturationInfo(route,crafts){
 const sat=route?.saturation;
 if(!sat||!(sat.volumeUnits>0))return null;
 const amount=Math.max(1,finite(route.craftAmount)||1);
 const share=Math.min(1,crafts*amount/sat.volumeUnits);
 return {share,discount:Math.min(.5,sat.k*share),loss:saturationLoss(route,crafts),volumeUnits:sat.volumeUnits};
}
// Resumen del plan para la interfaz.
export function saturationSummary(rows=[]){
 let units=0,volume=0,loss=0,naive=0,count=0,maxShare=0;
 for(const r of rows||[]){
  if(!(r?.qty>0))continue;
  const info=saturationInfo(r,r.qty);if(!info)continue;
  count++;units+=r.qty*Math.max(1,finite(r.craftAmount)||1);volume+=info.volumeUnits;
  loss+=info.loss;naive+=finite(r.profit)*r.qty;maxShare=Math.max(maxShare,info.share);
 }
 return count?{routes:count,avgShare:volume?units/volume:0,maxShare,loss,naiveProfit:naive,
  adjustedProfit:naive-loss}:null;
}
