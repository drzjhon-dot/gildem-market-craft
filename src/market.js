// Cliente REST único West y agregador de historial. Sin datos simulados.
export const WEST='https://west.albion-online-data.com';
export const HOUR=3600_000,DAY=86400_000;
const memory=new Map();let previousCall=0;let blockedUntil=0;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function utcRange(days,now=Date.now()){
 const count=[1,3,7,14].includes(Number(days))?Number(days):7;
 const end=Math.floor(now/DAY)*DAY;
 return {days:count,start:end-count*DAY,end,date:new Date(end-count*DAY).toISOString().slice(0,10),end_date:new Date(end).toISOString().slice(0,10)};
}
export function toUtcMs(value){
 if(typeof value==='number'){
  if(value>621355968000000000)return (value-621355968000000000)/10000;
  return value>1e12?value:value>1e9?value*1000:NaN;
 }
 if(typeof value!=='string')return NaN;
 if(/^\d+$/.test(value))return toUtcMs(Number(value));
 return Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)?value:value+'Z');
}
const pos=x=>Number.isFinite(Number(x))?Math.max(0,Number(x)):0;
export function summarizeHistory(rows,{days=7,now=Date.now()}={}){
 const range=utcRange(days,now),map=new Map(),unique=new Set();
 for(const row of rows||[]){const id=row?.item_id,city=row?.location||row?.city,quality=Number(row?.quality);
  if(!id||!city||quality<1||quality>5||!Number.isInteger(quality)||!Array.isArray(row.data))continue;
  const key=id+'|'+city;
  for(const point of row.data){const ms=toUtcMs(point.timestamp),count=pos(point.item_count),avg=pos(point.avg_price);
   if(!(ms>=range.start&&ms<range.end&&count>0&&avg>0))continue;
   const sig=[key,quality,ms,count,avg].join('|');if(unique.has(sig))continue;unique.add(sig);
   const item=map.get(key)||{id,city,units:0,silver:0,observations:0,qualities:new Set(),activeDays:new Set(),latestObservation:0};
   item.units+=count;item.silver+=count*avg;item.observations++;item.qualities.add(quality);
   item.activeDays.add(new Date(ms).toISOString().slice(0,10));item.latestObservation=Math.max(item.latestObservation,ms);map.set(key,item);
  }
 }
 return [...map.values()].map(r=>({id:r.id,city:r.city,units:r.units,averageDailyUnits:r.units/range.days,
  averageDailySilver:r.silver/range.days,averageUnitPrice:r.silver/r.units,observations:r.observations,
  activeDays:r.activeDays.size,qualities:[...r.qualities].sort(),latestObservation:new Date(r.latestObservation).toISOString(),
  from:range.date,to:new Date(range.end-DAY).toISOString().slice(0,10),days:range.days}));
}
export function rankEntries(entries,sort='silver'){const field=sort==='units'?'averageDailyUnits':sort==='price'?'averageUnitPrice':'averageDailySilver';return [...entries].sort((a,b)=>b[field]-a[field]||b.averageDailyUnits-a.averageDailyUnits);}
export function quoteMap(rows){const q=new Map();
 for(const r of rows||[]){if(Number(r.quality)!==1||!r.item_id)continue;
  const city=r.city||r.location;const id=r.item_id;
  if(!city)continue;const key=id+'|'+city;const prev=q.get(key)||{id,city};
  for(const [kind,priceField,dateField] of [['ask','sell_price_min','sell_price_min_date'],['bid','buy_price_max','buy_price_max_date']]){
   const price=pos(r[priceField]),time=toUtcMs(r[dateField]);
   if(price>0&&Number.isFinite(time)&&(!prev[kind]||time>prev[kind].time))prev[kind]={price,time,date:r[dateField]};
  }q.set(key,prev);
 }return q;
}
export function freshestQuotes(quotes,id,market,kind='ask',maxAgeHours=48,now=Date.now()){
 return [...quotes.values()].filter(q=>q.id===id&&q.city===market&&q[kind]&&q[kind].time<=now+HOUR&&now-q[kind].time<=maxAgeHours*HOUR).map(q=>({...q[kind],city:q.city}));
}
export function cheapestMaterial(quotes,id,markets,maxAgeHours=48,now=Date.now()){
 const valid=markets.flatMap(city=>freshestQuotes(quotes,id,city,'ask',maxAgeHours,now));
 return valid.sort((a,b)=>a.price-b.price||b.time-a.time)[0]||null;
}
function split(ids,limit=45){const u=[...new Set(ids)].filter(x=>/^[A-Z0-9_@-]{3,100}$/.test(x));const out=[];for(let i=0;i<u.length;i+=limit)out.push(u.slice(i,i+limit));return out;}
export async function marketFetch(kind,ids,{cities,qualities='1',days=7,force=false,onProgress=()=>{}}={}){
 if(!['history','prices','orderbook'].includes(kind))throw Error('Consulta de mercado no permitida');
 if(!ids.length)return {rows:[],coverage:0,totalBatches:0,errors:[],fromCache:true};
 const batches=split(ids),out=[],errors=[];let finished=0,fromCache=true,oldestFetched=Infinity;
 for(const batch of batches){const args=new URLSearchParams({kind,items:batch.join(','),locations:(cities||[]).join(','),qualities});
  if(kind==='history'){const range=utcRange(days);args.set('date',range.date);args.set('end_date',range.end_date);args.set('time-scale','24');}
  if(force)args.set('refresh','1');const key=args.toString().replace(/&refresh=1$/,'');
  const saved=memory.get(key);let packet;
  try{
   if(!force&&saved&&Date.now()-saved.at<HOUR){packet=saved;}
   else{
    if(Date.now()<blockedUntil)throw Error('AODP limita las consultas. Intenta más tarde.');
    const wait=Math.max(0,1150-(Date.now()-previousCall));if(wait)await pause(wait);previousCall=Date.now();
    const response=await fetch('/api/market?'+args,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(22000)});
    if(response.status===429){blockedUntil=Date.now()+60000;throw Error('AODP respondió 429 (límite de consultas).');}
    if(!response.ok){const err=await response.json().catch(()=>({}));throw Error(err.error||'Error HTTP '+response.status);}
    const payload=await response.json();if(!Array.isArray(payload))throw Error('Respuesta de mercado inválida');
    const cacheMark=response.headers.get('x-gildem-cache');if(cacheMark==='STALE')throw Error('Caché de servidor antigua; no se verificó precio reciente');
    packet={rows:payload,at:Date.now()};memory.set(key,packet);fromCache=false;
    if(memory.size>200)memory.delete(memory.keys().next().value);
   }
   out.push(...packet.rows);oldestFetched=Math.min(oldestFetched,packet.at);
  }catch(e){errors.push(`Lote ${finished+1}/${batches.length}: ${e.message}`);}
  finished++;onProgress({finished,total:batches.length,rows:out.length,errors:errors.length});
 }
 return {rows:out,coverage:batches.length-errors.length,totalBatches:batches.length,errors,fromCache,fetchedAt:Number.isFinite(oldestFetched)?new Date(oldestFetched).toISOString():null};
}
