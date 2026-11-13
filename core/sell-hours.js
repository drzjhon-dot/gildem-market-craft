// Gildem Craft Pro v9.3.0 · Mejores horas de venta por mercado.
// Usa el historial POR HORAS de AODP (time-scale=1, documentado en los api-docs
// de West) sobre los objetos del plan. Las marcas de tiempo de AODP son UTC;
// aquí se agrupan por hora UTC y la interfaz las muestra en hora local.
// Son observaciones de actividad del mercado, no ventas garantizadas.
const n=x=>Number.isFinite(Number(x))?Math.max(0,Number(x)):0;
const DAY=86400000;
const asUtc=ts=>{const raw=String(ts||'');return Date.parse(/Z|[+-]\d\d:?\d\d$/.test(raw)?raw:raw+'Z');};

// rows: respuesta de /stats/history con time-scale=1.
// Devuelve Map ciudad → perfil con 24 horas UTC: unidades medias y un índice de
// precio (1 = el precio medio del propio objeto, ponderado por unidades).
export function sellHoursByCity(rows=[],{days=7,now=Date.now()}={}){
 const window=Math.max(1,Math.min(14,Math.floor(n(days))||7));
 const since=now-window*DAY;
 const perItem=new Map(); // id|city → {hours:[{units,silver}...], units, silver}
 for(const row of rows||[]){
  const id=row?.item_id,city=row?.location||row?.city;
  if(!id||!city||!Array.isArray(row.data))continue;
  const key=id+'|'+city;
  const e=perItem.get(key)||{city,hours:Array.from({length:24},()=>({units:0,silver:0})),units:0,silver:0};
  for(const p of row.data){
   const at=asUtc(p?.timestamp);
   if(!Number.isFinite(at)||at<since||at>now+3600000)continue;
   const units=n(p.item_count),price=n(p.avg_price);
   if(!(units>0))continue;
   const h=new Date(at).getUTCHours();
   e.hours[h].units+=units;e.hours[h].silver+=units*price;
   e.units+=units;e.silver+=units*price;
  }
  perItem.set(key,e);
 }
 const byCity=new Map();
 for(const e of perItem.values()){
  if(!(e.units>0))continue;
  const meanPrice=e.silver/e.units;
  const c=byCity.get(e.city)||{hours:Array.from({length:24},()=>({units:0,weighted:0,weight:0})),units:0,items:0};
  c.units+=e.units;c.items++;
  for(let h=0;h<24;h++){
   const slot=e.hours[h];
   c.hours[h].units+=slot.units;
   if(slot.units>0&&meanPrice>0){
    c.hours[h].weighted+=(slot.silver/slot.units)/meanPrice*slot.units;
    c.hours[h].weight+=slot.units;
   }
  }
  byCity.set(e.city,c);
 }
 const out=new Map();
 for(const [city,c] of byCity){
  if(!(c.units>0))continue;
  out.set(city,{items:c.items,totalUnits:c.units,days:window,hours:c.hours.map((slot,hour)=>({
   hourUtc:hour,
   units:slot.units,
   share:slot.units/c.units,
   priceIndex:slot.weight>0?slot.weighted/slot.weight:null
  }))});
 }
 return out;
}

// Mejores horas de un perfil. En el Mercado Negro manda el precio (vender cuando
// paga por encima de su media); en Royal, la actividad de compradores. Solo se
// puntúan horas con una muestra mínima para no elegir un pico de 3 unidades.
export function bestSellHours(profile,{market='royal',count=3,minShare=1/96}={}){
 if(!profile?.hours?.length)return [];
 const eligible=profile.hours.filter(h=>h.share>=minShare&&h.units>0);
 if(!eligible.length)return [];
 const score=h=>market==='black'?(h.priceIndex??0)+h.share*.1:h.share+(h.priceIndex??1)*.01;
 return [...eligible].sort((a,b)=>score(b)-score(a)).slice(0,Math.max(1,count))
  .map(h=>({...h,reason:market==='black'
   ?(h.priceIndex!=null?`paga ${(h.priceIndex*100-100).toFixed(0)>0?'+':''}${((h.priceIndex-1)*100).toFixed(0)} % sobre su media`:'actividad alta')
   :`${(h.share*100).toFixed(0)} % de la actividad del día`}));
}

// ── Eventos del juego (festivities) ─────────────────────────────────────────
// /api/v2/stats/festivities devuelve calendarios confirmados por la comunidad;
// 404 significa «sin eventos confirmados». Los tiempos vienen en ticks de C#.
export const ticksToMs=ticks=>{const t=Number(ticks);return Number.isFinite(t)&&t>621355968000000000?(t-621355968000000000)/10000:null;};
export function parseFestivities(payload,now=Date.now()){
 const list=Array.isArray(payload)?payload:Array.isArray(payload?.events)?payload.events:Array.isArray(payload?.Events)?payload.Events:null;
 if(!list)return [];
 const out=[];
 for(const e of list){
  const name=e?.name||e?.Name||e?.type||e?.Type;
  const start=ticksToMs(e?.startTime??e?.StartTime),end=ticksToMs(e?.endTime??e?.EndTime);
  if(!name||start===null||end===null||end<=start)continue;
  if(end<now||start>now+7*DAY)continue;
  out.push({name:String(name),start,end,active:start<=now&&end>=now});
 }
 return out.sort((a,b)=>a.start-b.start).slice(0,4);
}
