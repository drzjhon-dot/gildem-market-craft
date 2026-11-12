// Metadatos de recetas/idioma del juego. No aportan cifras de mercado.
import {extractSpecialRecipes,FULL_ITEM_DUMP,FULL_ITEM_DUMP_BACKUP} from '../../src/recipe-extractor.js';
const SOURCES={
 recipes:['https://raw.githubusercontent.com/vkorne-web/albion-market/main/recipes.json','https://cdn.jsdelivr.net/gh/vkorne-web/albion-market@main/recipes.json'],
 names:['https://raw.githubusercontent.com/vkorne-web/albion-market/main/names_es.json','https://cdn.jsdelivr.net/gh/vkorne-web/albion-market@main/names_es.json'],
 special:[FULL_ITEM_DUMP,FULL_ITEM_DUMP_BACKUP]
};
const cache=new Map();
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
 const type=new URL(request.url).searchParams.get('file');if(!Object.hasOwn(SOURCES,type||''))return result({error:'Archivo no permitido'},400);
 try{return result(await loadCatalog(type));}catch(e){return result({error:e.message},503);}
}
export const config={path:'/.netlify/functions/catalog'};
