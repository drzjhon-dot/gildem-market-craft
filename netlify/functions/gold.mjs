// Precio del oro en AODP West (Americas). Solo lectura, caché de 10 minutos.
const HOST='https://west.albion-online-data.com';
let cache=null;const TTL=600_000;
const answer=(value,status=200,headers={})=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public, max-age=120, s-maxage=600':'no-store',...headers}});
export default async function handler(request){
 if(request.method!=='GET')return answer({error:'Método no permitido'},405);
 const count=Math.max(1,Math.min(720,Number(new URL(request.url).searchParams.get('count'))||168));
 if(cache&&cache.count>=count&&Date.now()-cache.time<TTL)return answer(cache.rows.slice(-count),200,{'x-gildem-cache':'HIT'});
 try{
  const res=await fetch(`${HOST}/api/v2/stats/gold.json?count=${count}`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});
  if(res.status===429)return answer({error:'AODP aplicó límite de solicitudes (429).'},429,{'retry-after':res.headers.get('retry-after')||'60'});
  if(!res.ok)return answer({error:'AODP respondió HTTP '+res.status},502);
  const rows=await res.json();if(!Array.isArray(rows))return answer({error:'Formato inesperado'},502);
  const clean=rows.filter(r=>Number(r?.price)>0&&r?.timestamp).map(r=>({price:Number(r.price),timestamp:String(r.timestamp)}));
  cache={rows:clean,count,time:Date.now()};
  return answer(clean,200,{'x-gildem-cache':'MISS'});
 }catch(e){return answer({error:'AODP West no disponible: '+String(e.message||e)},503);}
}
export const config={path:'/.netlify/functions/gold'};
