// Estado de la política de datos. No consulta ni verifica otras webs.
import {AODP_WEST} from '../../core/server-policy.js';
export async function verifyMarketReferences(_fetcher=fetch,{region='west'}={}){
 if(region!=='west')return {region:'west',error:'Solo América West',checks:[],usedForPrices:false,usedForMarketVolume:false};
 return {checkedAt:new Date().toISOString(),region:'west',checks:[],
  usedForPrices:true,usedForMarketVolume:true,
  numericSource:'Albion Online Data Project (AODP West)',base:AODP_WEST,
  note:'Proveedor configurado, no significa conexión validada ni datos recientes.'};
}
export default async function handler(request){
 if(request.method!=='GET')return new Response('Método no permitido',{status:405});
 const region=new URL(request.url).searchParams.get('region')||'west';
 if(region!=='west')return new Response(JSON.stringify({error:'Solo América West'}),{status:400,headers:{'content-type':'application/json'}});
 return new Response(JSON.stringify(await verifyMarketReferences()),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
export const config={path:'/.netlify/functions/market-references'};
