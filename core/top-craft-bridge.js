// v9.9.0-top.6 · puente AODP West: idéntica agregación de 14 días UTC
// usada por Top Mercado. Los cinco niveles de calidad son ACTIVIDAD, no
// profundidad de compra ni ventas realizadas. La liquidez publicable exige
// evidencia adicional de calidad Normal y margen conservador.
import {aggregateTopMarket} from './top-market.js';
import {qualityVolumeIndex} from './market-mechanics.js';
import {demandHistoryIndex} from './demand-first.js';
import {variantParts} from './craft-plan-controls.js';

const key=(id,city)=>id+'|'+city;
// AODP a veces devuelve fechas UTC sin Z; Date.parse sin zona usaría la
// zona del navegador, desplazando el promedio de un día a otro.
function utcPointTime(t){return typeof t==='string'&&!/^\d+$/.test(t)&&!/(?:Z|[+-]\d\d:?\d\d)$/.test(t)?t+'Z':t;}
export function sharedTopCraftHistory(rows,{now=Date.now(),days=14}={}){
 const normalized=(rows||[]).map(r=>({...r,data:Array.isArray(r?.data)?r.data.map(p=>({...p,timestamp:utcPointTime(p.timestamp)})):r?.data}));
 const entries=aggregateTopMarket(normalized,{days,now});
 const normalEntries=aggregateTopMarket(normalized.filter(r=>Number(r?.quality??1)===1),{days,now});
 const normalByMarket=new Map(normalEntries.map(x=>[key(x.id,x.city),x]));
 const ranked=[...entries].sort((a,b)=>b.dailyAmount-a.dailyAmount||b.dailySilver-a.dailySilver);
 const topByMarket=new Map(ranked.map((x,i)=>[key(x.id,x.city),{...x,rank:i+1,
  normalDaily:normalByMarket.get(key(x.id,x.city))?.dailyAmount??null,
  source:'AODP West · historial calidades 1–5 · 14 días UTC completos'}]));
 return {entries,normalByMarket,topByMarket,
  normalHistory:demandHistoryIndex(normalized),qualityVolumes:qualityVolumeIndex(normalized,days,now),
  periodDays:days};
}
export function tierTopAudit({ids=[],topEntries=[],routes=[],viable=[],rejected=[],plan=[],tiers=[4,5,6,7,8],market=null,partial=false}={}){
 const allowed=new Set(ids),accepted=new Set((viable||[]).map(r=>key(r.id,r.city)));
 const chosen=new Set((plan||[]).filter(r=>r.qty>0).map(r=>key(r.id,r.city)));
 const candidates=new Set((routes||[]).map(r=>key(r.id,r.city)));
 const observed=new Map();
 for(const row of topEntries||[]){
  if(!allowed.has(row.id)||!row.dailyAmount||market==='black'&&row.city!=='Black Market'||market==='royal'&&row.city==='Black Market')continue;
  const t=variantParts(row.id)?.tier;
  if(!t)continue;
  const group=observed.get(t)||new Map();group.set(key(row.id,row.city),row);observed.set(t,group);
 }
 return [...new Set(tiers.map(Number))].sort((a,b)=>a-b).map(tier=>{
  const group=observed.get(tier)||new Map();let withPrices=0,eligible=0,picked=0;
  for(const key of group.keys()){
   if(candidates.has(key))withPrices++;
   if(accepted.has(key))eligible++;
   if(chosen.has(key))picked++;
  }
  const reasons=new Map();
  for(const entry of rejected||[]){if(variantParts(entry.id)?.tier!==tier||!group.has(key(entry.id,entry.city)))continue;
   for(const r of entry.reasons||[]){reasons.set(r,(reasons.get(r)||0)+1);}}
  const leading=[...reasons].sort((a,b)=>b[1]-a[1]).slice(0,2).map(([label])=>label).join(' · ');
  return {tier,observed:group.size,withPrices,eligible,picked,
   topDaily:Math.round([...group.values()].reduce((a,x)=>a+x.dailyAmount,0)),
   reason:!group.size?'No se recibió historial de ese tier':!withPrices?'No hay rutas con precio y coste completos':!eligible?'No superó filtros: '+(leading||'margen, riesgo o presupuesto'):!picked?'Rutas viables, pero no asignadas por capital, diversidad o tamaño de lote':'Incluido en el plan'};
 });
}
