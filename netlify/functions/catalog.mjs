// Proxy de respaldo para el catálogo verificado de recetas de Albion.
// Reduce fallos de CORS/CDN y nunca inventa recetas cuando la fuente falla.
const SOURCES={
 'names_es.json':[
  'https://raw.githubusercontent.com/vkorne-web/albion-market/main/names_es.json',
  'https://cdn.jsdelivr.net/gh/vkorne-web/albion-market@main/names_es.json'
 ],
 'recipes.json':[
  'https://raw.githubusercontent.com/vkorne-web/albion-market/main/recipes.json',
  'https://cdn.jsdelivr.net/gh/vkorne-web/albion-market@main/recipes.json'
 ]
};
const memory=new Map();
const TTL_MS=4*3600*1000;
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public, max-age=300, s-maxage=3600':'no-store','access-control-allow-origin':'*'}});}
export async function fetchCatalogFile(file,fetcher=fetch,now=Date.now()){
 if(!Object.hasOwn(SOURCES,file))throw Error('Archivo no permitido');
 const cached=memory.get(file);
 if(cached&&now-cached.at<TTL_MS)return cached.data;
 let last;
 for(const url of SOURCES[file]){
  try{
   const response=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12500)});
   if(!response.ok)throw Error('HTTP '+response.status);
   const data=await response.json();
   if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).length<100)throw Error('Fuente insuficiente');
   memory.set(file,{at:now,data});
   return data;
  }catch(e){last=e;}
 }
 if(cached?.data)return cached.data; // La fecha corresponde al caché, nunca a una cotización de mercado.
 throw Error('Fuente de recetas no disponible: '+(last?.message||'sin respuesta'));
}
export default async function handler(request){
 if(request.method!=='GET')return json({error:'Método no permitido'},405);
 const file=new URL(request.url).searchParams.get('file');
 if(!Object.hasOwn(SOURCES,file||''))return json({error:'Archivo no permitido'},400);
 try{return json(await fetchCatalogFile(file));}
 catch(error){return json({error:String(error.message||error)},503);}
}
export const config={path:'/.netlify/functions/catalog'};
