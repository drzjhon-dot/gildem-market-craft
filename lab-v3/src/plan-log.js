/**
 * Gildem 2.5 · Diario de planes.
 * Guarda cada plan generado (en este navegador) y, pasados unos días, lo compara con la
 * actividad Q1 real observada por AODP West en los mismos destinos.
 * Sirve para ajustar estilo, días de venta y protección del beneficio con datos propios.
 */
const DAY=86400000;
const validId=id=>typeof id==='string'&&/^[A-Z0-9_@-]{3,100}$/.test(id);
const num=x=>Number.isFinite(Number(x))?Number(x):0;
export function createPlanLogEntry(result,config={},now=Date.now()){
 const rows=(result?.rows||[]).filter(r=>validId(r.id)&&r.qty>0).slice(0,150).map(r=>({id:r.id,city:r.city,qty:r.qty,units:r.qty*(r.craftAmount||1),
  usedDaily:num(r.history?.effectiveQuality1DailyUnits??r.history?.quality1DailyUnits),q1Daily:num(r.history?.quality1DailyUnits),
  price:num(r.planningPrice),capital:num(r.qty*r.grossCapitalPerCraft),profit:num(r.totalProfit)}));
 return {id:String(now),createdAt:new Date(now).toISOString(),saleDays:num(config.saleDays)||7,style:config.style||'balanced',goal:config.goal||'silver',
  budget:num(config.budget),capital:num(result?.summary?.capitalReserved),profit:num(result?.summary?.totalProfit),rows,verification:null};
}
export function sanitizePlanLog(raw){return Array.isArray(raw)?raw.filter(e=>e&&typeof e.id==='string'&&Array.isArray(e.rows)&&!Number.isNaN(Date.parse(e.createdAt))).slice(0,20):[];}
/** Días UTC completos desde el plan y la ventana de History (1/3/7/14) que los cubre. */
export function planLogWindow(entry,now=Date.now()){
 const start=Math.floor(Date.parse(entry.createdAt)/DAY)*DAY,today=Math.floor(now/DAY)*DAY,days=Math.max(0,Math.round((today-start)/DAY)-0);
 const window=[1,3,7,14].find(w=>w>=days)||14;
 return {days,window,ready:days>=1,complete:days>=Math.min(entry.saleDays||7,14)};
}
/**
 * history: filas de summarizeHistory (Q1) con la ventana planLogWindow().window.
 * Compara por ruta la actividad Q1/día real con la usada en el plan y el precio Q1 medio con el planificado.
 */
export function verifyPlanEntry(entry,history,now=Date.now()){
 const index=new Map((history||[]).map(h=>[h.id+'|'+h.city,h]));
 const rows=entry.rows.map(r=>{const h=index.get(r.id+'|'+r.city),actual=num(h?.quality1DailyUnits),price=num(h?.quality1AveragePrice);
  const demandRatio=r.usedDaily>0?actual/r.usedDaily:null,priceRatio=r.price>0&&price>0?price/r.price:null;
  const verdict=!h?'sin datos':demandRatio!==null&&demandRatio<.8?'demanda menor':priceRatio!==null&&priceRatio<.95?'precio menor':'cumplido';
  return {...r,actualDaily:actual,actualPrice:price||null,demandRatio,priceRatio,verdict};});
 const weighted=(field)=>{const list=rows.filter(r=>r[field]!==null&&r.capital>0);const w=list.reduce((s,r)=>s+r.capital,0);return w?list.reduce((s,r)=>s+r[field]*r.capital,0)/w:null;};
 const demand=weighted('demandRatio'),price=weighted('priceRatio');
 const advice=[];
 if(demand!==null&&demand<.7)advice.push('La demanda real fue bastante menor que la prevista: prueba el estilo Prudente o menos días de venta.');
 else if(demand!==null&&demand>1.3)advice.push('La demanda real superó lo previsto: puedes probar un estilo con más volumen.');
 if(price!==null&&price<.93)advice.push('Los precios bajaron tras planificar: sube «Venta -%» en Protección del beneficio.');
 if(!advice.length&&demand!==null)advice.push('El plan se ajustó bien a lo que pasó en el mercado.');
 return {checkedAt:new Date(now).toISOString(),window:planLogWindow(entry,now).window,demandRatio:demand,priceRatio:price,
  ok:rows.filter(r=>r.verdict==='cumplido').length,total:rows.length,rows,advice};
}
