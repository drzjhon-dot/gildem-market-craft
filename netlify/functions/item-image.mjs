// Proxy de imágenes oficiales de Albion. Solo IDs de ítems, nunca URLs arbitrarias.
// CDN de respaldo para usuarios cuyo navegador bloquea el renderer externo.
import {validIconId} from '../../core/icons.js';
const maximum=750_000;
const publicCache={'Cache-Control':'public,max-age=604800,immutable','Netlify-CDN-Cache-Control':'public,durable,max-age=604800,stale-while-revalidate=86400','Netlify-Vary':'query=id|size','X-Content-Type-Options':'nosniff'};
export function imageUpstreams(id,size){
 const encoded=encodeURIComponent(id);
 return [
  `https://render.albiononline.com/v1/item/${encoded}.png?size=${size}&quality=1`
 ];
}
export async function resolveIcon(id,size,fetcher=fetch){
 if(!validIconId(id))return null;
 const px=Math.min(217,Math.max(32,Math.round(Number(size)||84)));
 // Race permitted renderers rather than waiting serially for two 4.5s timeouts.
 // The first valid image wins; cancel other requests where supported.
 const controllers=imageUpstreams(id,px).map(()=>new AbortController());
 const attempts=imageUpstreams(id,px).map(async(url,index)=>{
  const response=await fetcher(url,{headers:{Accept:'image/png,image/*;q=0.8'},signal:AbortSignal.any([controllers[index].signal,AbortSignal.timeout(3200)])});
  const type=response.headers.get('content-type')||'';
  if(!response.ok||!type.startsWith('image/'))throw Error('Not an image');
  const contentLength=Number(response.headers.get('content-length')||0);
  if(contentLength>maximum)throw Error('Image too large');
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(bytes.byteLength<24||bytes.byteLength>maximum)throw Error('Invalid image size');
  const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
  const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  if(!png&&!webp)throw Error('Invalid image signature');
  return {bytes,contentType:png?'image/png':'image/webp',url};
 });
 try{return await Promise.any(attempts);}
 catch{return null;}
 finally{controllers.forEach(c=>c.abort());}
}
export default async request=>{
 const url=new URL(request.url);
 const id=url.searchParams.get('id')||'';
 const size=Number(url.searchParams.get('size')||84);
 if(!validIconId(id)||!Number.isFinite(size)||size<32||size>217){
  return new Response('ID de ítem o tamaño inválido',{status:400,headers:{'Cache-Control':'no-store'}});
 }
 const result=await resolveIcon(id,size);
 if(!result)return new Response('Icono no disponible',{status:404,headers:{'Cache-Control':'public,max-age=300'}});
 return new Response(result.bytes,{status:200,headers:{...publicCache,'Content-Type':result.contentType}});
};
