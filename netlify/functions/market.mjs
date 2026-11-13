// Optional server-side AODP proxy for Netlify. One-hour shared cache + validation.
const hosts={west:'https://west.albion-online-data.com'};
const memory=new Map();
export default async (request)=>{
 const u=new URL(request.url);const region=u.searchParams.get('region')||'west';const kind=u.searchParams.get('kind')||'prices';
 const items=(u.searchParams.get('items')||'').split(',').filter(Boolean);
 if(region!=='west'||!['prices','history','orderbook'].includes(kind)||items.length<1||items.length>60||items.some(s=>!/^[A-Z0-9_@-]{3,100}$/.test(s))){return json({error:'Parámetros inválidos'},400);}
 const allowed={locations:u.searchParams.get('locations')||'',qualities:u.searchParams.get('qualities')||'1'};
 if(!/^[a-zA-Z ,]{0,240}$/.test(allowed.locations)||!/^[1-5,]{1,11}$/.test(allowed.qualities)){return json({error:'Filtros inválidos'},400);}
 if(kind==='history'){
  const ts=u.searchParams.get('time-scale');allowed['time-scale']=['1','6','24'].includes(ts)?ts:'24';
  // Historial oficial por rango UTC: solo afecta consultas que incluyan date/end_date.
  for(const p of ['date','end_date']){
   const date=u.searchParams.get(p);
   if(date){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z')))return json({error:'Fecha inválida'},400);
    allowed[p]=date;
   }
  }
  if(allowed.date&&allowed.end_date){
   const span=(Date.parse(allowed.end_date+'T00:00:00Z')-Date.parse(allowed.date+'T00:00:00Z'))/86400000;
   if(span<0||span>31)return json({error:'Rango máximo: 31 días'},400);
  }
 }
 const key=region+'|'+kind+'|'+items.join(',')+'|'+JSON.stringify(allowed);
 const old=memory.get(key),forceRefresh=u.searchParams.get('refresh')==='1';if(!forceRefresh&&old&&Date.now()-old.time<(kind==='orderbook'?300000:3600000))return json(old.data,200,{'x-gildem-cache':'HIT'});
 const link=hosts[region]+'/api/v2/stats/'+kind+'/'+items.map(encodeURIComponent).join(',')+'.json?'+new URLSearchParams(allowed);
 try{
   const up=await fetch(link,{headers:{'Accept-Encoding':'gzip, deflate, br','Accept':'application/json'},signal:AbortSignal.timeout(18000)});
   if(!up.ok){if(old)return json(old.data,200,{'x-gildem-cache':'STALE','x-gildem-warning':String(up.status)});return json({error:'AODP devolvió '+up.status},up.status===429?429:502);}
   const data=await up.json();if(!Array.isArray(data)&&!(kind==='orderbook'&&data&&typeof data==='object'))return json({error:'Respuesta no válida'},502);
   memory.set(key,{time:Date.now(),data});if(memory.size>180){const first=memory.keys().next().value;memory.delete(first);}
   return json(data,200,{'x-gildem-cache':'MISS'});
 }catch(e){if(old)return json(old.data,200,{'x-gildem-cache':'STALE'});return json({error:'AODP no disponible'},502);}
};
function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Cache-Control':'public, max-age=30, s-maxage=60',...headers}});}
export const config={path:'/.netlify/functions/market'};
