// Proxy único y validado para Albion Online Data Project, región AMERICA/WEST.
const HOST='https://west.albion-online-data.com';
const CITIES=new Set(['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford','Caerleon','Brecilien','Black Market']);
const store=new Map();const HOUR=3600_000;
const answer=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public, max-age=60, s-maxage=3600':'no-store',...headers}});
export default async function handler(request){
 if(request.method!=='GET')return answer({error:'Método no permitido'},405);
 const u=new URL(request.url);const kind=u.searchParams.get('kind');
 if(!['prices','history','orderbook'].includes(kind))return answer({error:'Endpoint no permitido'},400);
 const ids=(u.searchParams.get('items')||'').split(',').filter(Boolean);
 if(ids.length<1||ids.length>45||ids.some(id=>!/^[A-Z0-9_@-]{3,100}$/.test(id)))return answer({error:'IDs no permitidos (máximo 45)'},400);
 const cities=(u.searchParams.get('locations')||'').split(',').filter(Boolean);
 if(!cities.length||cities.some(c=>!CITIES.has(c)))return answer({error:'Mercados no permitidos'},400);
 const qualities=(u.searchParams.get('qualities')||'1').split(',');
 if(qualities.some(q=>!['1','2','3','4','5'].includes(q))||qualities.length>5)return answer({error:'Calidades inválidas'},400);
 const parameters=new URLSearchParams({locations:cities.join(','),qualities:qualities.join(',')});
 if(kind==='history'){
  const start=u.searchParams.get('date'),end=u.searchParams.get('end_date');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start||'')||!/^\d{4}-\d{2}-\d{2}$/.test(end||''))return answer({error:'Se requieren fechas UTC completas'},400);
  const a=Date.parse(start+'T00:00:00Z'),b=Date.parse(end+'T00:00:00Z');
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a||b-a>14*86400000)return answer({error:'Ventana UTC inválida'},400);
  parameters.set('date',start);parameters.set('end_date',end);parameters.set('time-scale','24');
 }
 const uri=`${HOST}/api/v2/stats/${kind}/${ids.map(encodeURIComponent).join(',')}.json?${parameters}`;
 const force=u.searchParams.get('refresh')==='1',previous=store.get(uri);
 if(!force&&previous&&Date.now()-previous.time<HOUR)return answer(previous.rows,200,{'x-gildem-cache':'HIT'});
 try{
  const res=await fetch(uri,{headers:{Accept:'application/json','Accept-Encoding':'gzip, deflate, br'},signal:AbortSignal.timeout(18000)});
  if(res.status===429)return answer({error:'AODP aplicó límite de solicitudes (429). Espera antes de volver a consultar.'},429,{'retry-after':res.headers.get('retry-after')||'60'});
  if(!res.ok)return answer({error:'AODP respondió HTTP '+res.status},502);
  const rows=await res.json();if(!Array.isArray(rows))return answer({error:'AODP devolvió un formato inesperado'},502);
  store.set(uri,{rows,time:Date.now()});if(store.size>250)store.delete(store.keys().next().value);
  return answer(rows,200,{'x-gildem-cache':'MISS','cache-control':force?'no-store':'public, max-age=60, s-maxage=3600'});
 }catch(e){return answer({error:'AODP West no disponible: '+String(e.message||e)},503);}
}
export const config={path:'/.netlify/functions/market'};
