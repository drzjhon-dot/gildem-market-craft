import {getStore} from '@netlify/blobs';
export default async(request)=>{
 const u=new URL(request.url);const region=u.searchParams.get('region')||'west';
 if(region!=='west')return reply({error:'Solo se permite América (West)'},400);
 try{
  const store=getStore({name:'gildem-public-prices'});
  const snapshot=await store.get('hourly-'+region,{type:'json'});
  if(!snapshot)return reply({error:'La primera sincronización horaria aún no se ha ejecutado',region},404);
  return reply(snapshot,200);
 }catch(e){return reply({error:'No se pudo consultar Netlify Blobs en este despliegue'},503);}
};
function reply(body,status){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=120'}});}
export const config={path:'/.netlify/functions/snapshot'};
