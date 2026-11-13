// Recetas especiales desde el archivo RAW de ao-bin-dumps.
// Esta función entrega solo las recetas relevantes para reducir la descarga del navegador.
import {extractSpecialRecipes, FULL_ITEM_DUMP, FULL_ITEM_DUMP_BACKUP} from '../../core/special-recipes.js';

const SOURCES=[FULL_ITEM_DUMP,FULL_ITEM_DUMP_BACKUP];
const TTL=24*3600000;
const REVISION_URL='https://api.github.com/repos/ao-data/ao-bin-dumps/commits?path=items.json&per_page=1';
let revisionCache=null;
async function gameRevision(fetcher=fetch,force=false){
 if(!force&&revisionCache&&Date.now()-revisionCache.checked<3600000)return revisionCache.value;
 try{const r=await fetcher(REVISION_URL,{headers:{'Accept':'application/vnd.github+json'},signal:AbortSignal.timeout(7000)});
 if(!r.ok)throw Error('GitHub '+r.status);const list=await r.json();
 const rev=Array.isArray(list)&&list[0]?.sha?{sha:list[0].sha,date:list[0].commit?.committer?.date||null}:null;
 if(rev)revisionCache={value:rev,checked:Date.now()};
 return rev;
 }catch{return null;}
}
let memory=null;
let fetching=null;
const reply=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300, s-maxage=3600',...headers}});
async function store(){try{const {getStore}=await import('@netlify/blobs');return getStore({name:'gildem-crafting-recipes'});}catch{return null;}}
async function fetchAndExtract(fetcher=fetch){let failure;
 for(const url of SOURCES){
  try{
   const response=await fetcher(url,{headers:{Accept:'application/json','Accept-Encoding':'gzip, deflate, br'},signal:AbortSignal.timeout(26000)});
   if(!response.ok)throw Error('HTTP '+response.status);
   const raw=await response.json();
   const recipes=extractSpecialRecipes(raw);
   const types=new Set(Object.values(recipes).map(x=>x.kind));
   if(!recipes||Object.keys(recipes).length<10||!['potion','mount','gather','food'].every(x=>types.has(x)))throw Error('Datos de crafting incompletos');
   return {version:3,source:url,updatedAt:new Date().toISOString(),count:Object.keys(recipes).length,recipes};
  }catch(e){failure=e;}
 }
 throw Error('No se pudo procesar el catálogo de recetas: '+(failure?.message||'sin respuesta'));
}
export default async function handler(request){
 if(request.method!=='GET')return reply({error:'Método no permitido'},405);
 const now=Date.now();const refresh=new URL(request.url).searchParams.get('refresh')==='1';
 const rev=await gameRevision(fetch,refresh);
 const validCache=v=>v?.recipes&&['gather','kit','siege'].every(type=>Object.values(v.recipes).some(x=>x?.kind===type))&&Date.now()-Date.parse(v.updatedAt)<TTL&&(!rev?.sha||v.sourceRevision===rev.sha);
 if(!refresh&&validCache(memory))return reply(memory);
 const savedStore=await store();
 try{
  if(savedStore){const saved=await savedStore.get('special-recipes-v5-kits-siege-offhands',{type:'json'});
   if(!refresh&&validCache(saved)){memory=saved;return reply(saved);}
   if(saved?.recipes)memory=saved;
  }
 }catch(e){console.warn('No se pudo leer caché de recetas:',String(e.message||e));}
 try{
  if(!fetching)fetching=fetchAndExtract().finally(()=>{fetching=null;});
  const fresh=await fetching;
  fresh.sourceRevision=rev?.sha||null;fresh.sourceCommitDate=rev?.date||null;
  memory=fresh;
  try{if(savedStore)await savedStore.setJSON('special-recipes-v5-kits-siege-offhands',fresh);}catch(e){console.warn('No se pudo guardar caché:',String(e.message||e));}
  return reply(fresh);
 }catch(e){
  console.error('Error cargando recetas especiales:',String(e.message||e));
  if(memory?.recipes)return reply({...memory,warning:'Se están utilizando recetas guardadas; actualización no disponible.'},200,{'x-gildem-cache':'STALE'});
  return reply({error:'No se pudieron actualizar recetas verificables: '+String(e.message||e)},503,{'cache-control':'no-store'});
 }
}
export const config={path:'/.netlify/functions/recipes'};
export {fetchAndExtract,gameRevision};
