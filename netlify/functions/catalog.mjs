// Metadatos de recetas/idioma del juego. No aportan cifras de mercado.
import {extractSpecialRecipes,FULL_ITEM_DUMP,FULL_ITEM_DUMP_BACKUP} from '../../src/recipe-extractor.js';
import {referenceRefiningRecipes,extractBinRecipes} from '../../src/refining.js';
const SOURCES={
 recipes:['https://raw.githubusercontent.com/vkorne-web/albion-market/main/recipes.json','https://cdn.jsdelivr.net/gh/vkorne-web/albion-market@main/recipes.json'],
 names:['https://raw.githubusercontent.com/vkorne-web/albion-market/main/names_es.json','https://cdn.jsdelivr.net/gh/vkorne-web/albion-market@main/names_es.json'],
 special:[FULL_ITEM_DUMP,FULL_ITEM_DUMP_BACKUP]
};
const cache=new Map();
let dumpPromise=null;
async function getGameDump(requester=fetch){
 if(dumpPromise)return dumpPromise;
 dumpPromise=(async()=>{let last;
  for(const url of [FULL_ITEM_DUMP,FULL_ITEM_DUMP_BACKUP])try{
   const res=await requester(url,{signal:AbortSignal.timeout(28000),headers:{Accept:'application/json'}});
   if(!res.ok)throw Error('HTTP '+res.status);
   const data=await res.json();if(!data?.items||Object.keys(data.items).length<4)throw Error('Dump de objetos incompleto');
   return data;
  }catch(e){last=e;}
  throw Error('No se pudo acceder al dump: '+(last?.message||'sin conexión'));
 })().catch(e=>{dumpPromise=null;throw e;});
 return dumpPromise;
}
export async function loadGameRecipes(kind,ids=[],requester=fetch){
 if(kind==='refining'){
  const reference=referenceRefiningRecipes();
  try{const dump=await getGameDump(requester),actual=extractBinRecipes(dump,{onlyIds:Object.keys(reference),existingRecipes:reference});
   return {recipes:{...reference,...actual},source:'ao-bin-dumps + referencia oficial',verified:Object.keys(actual).length};
  }catch(e){return {recipes:reference,source:'referencia-oficial-albion (sin conexión al dump)',verified:0,warning:e.message};}
 }
 if(kind==='verify'){
  const dump=await getGameDump(requester);
  const recipes=extractBinRecipes(dump,{onlyIds:ids});
  return {recipes,source:'ao-bin-dumps',verified:Object.keys(recipes).length};
 }
 throw Error('Operación de datos del juego desconocida');
}
function result(obj,status=200){return new Response(JSON.stringify(obj),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':status===200?'public, max-age=600, s-maxage=3600':'no-store'}});}
export async function loadCatalog(type,requester=fetch){const origins=SOURCES[type];if(!origins)throw Error('Archivo no permitido');
 const cached=cache.get(type);if(cached&&Date.now()-cached.at<24*3600000)return cached.data;
 let last;for(const url of origins){try{
  const res=await requester(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(type==='special'?25000:16000)});
  if(!res.ok)throw Error('HTTP '+res.status);const payload=await res.json();const data=type==='special'?extractSpecialRecipes(payload):payload;
  if(type==='special')for(const recipe of Object.values(data)){
   // Bonus locales especiales NO verificados en el dump: aplicar solamente base Royal.
   recipe.specialtyEnabled=false;recipe.city=recipe.city||'Caerleon';
  }
  if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).length<15)throw Error('Catálogo incompleto');
  cache.set(type,{data,at:Date.now()});return data;
 }catch(e){last=e;}}
 if(cached)return cached.data;
 throw Error('No se pudo obtener '+type+': '+(last?.message||'fuente inaccesible'));
}
export default async function handler(request){if(request.method!=='GET')return result({error:'Método no permitido'},405);
 const params=new URL(request.url).searchParams,type=params.get('file');
 try{
  if(type==='refining')return result(await loadGameRecipes('refining'));
  if(type==='verify'){
   const ids=(params.get('items')||'').split(',').filter(Boolean);
   if(!ids.length||ids.length>150||ids.some(id=>!/^[A-Z0-9_@-]{3,100}$/.test(id)))return result({error:'IDs no permitidos'},400);
   return result(await loadGameRecipes('verify',ids));
  }
  if(!Object.hasOwn(SOURCES,type||''))return result({error:'Archivo no permitido'},400);
  return result(await loadCatalog(type));
 }catch(e){return result({error:e.message},503);}
}

export const config={path:'/.netlify/functions/catalog'};
