import {cp,mkdir,rm,stat,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {BRANCHES,BRANCH_CATEGORIES} from '../core/branches.js';
import {imageUpstreams} from '../netlify/functions/item-image.mjs';

const OUTPUT='dist';
const assets=['index.html','app.js','styles.css','lab-v3.css','sw.js','manifest.webmanifest'];
const folders=['core','icons','assets','fonts'];
await rm(OUTPUT,{recursive:true,force:true});
await mkdir(OUTPUT,{recursive:true});
for(const file of assets){await stat(file);await cp(file,join(OUTPUT,file));}
for(const dir of folders){await stat(dir);await cp(dir,join(OUTPUT,dir),{recursive:true});}
// Solo publicar los motores v3 reutilizados, nunca una segunda app o sus tests.
await mkdir(join(OUTPUT,'lab-v3'),{recursive:true});
await cp('lab-v3/src',join(OUTPUT,'lab-v3/src'),{recursive:true});

// Netlify can prebundle representative Albion item icons into the published
// site. Static hosting then works even when a visitor blocks external hosts.
// Never fail a crafting deployment because an image service is unavailable.
const prefetch=process.env.GILDEM_PREFETCH_ICONS==='1'||(!!process.env.NETLIFY&&process.env.GILDEM_PREFETCH_ICONS!=='0');
const stored=[];
if(prefetch){
 const ids=[...new Set([...BRANCH_CATEGORIES,...BRANCHES].map(x=>x.iconId))].filter(Boolean);
 await mkdir(join(OUTPUT,'item-icons'),{recursive:true});
 let offset=0;
 async function worker(){
  while(offset<ids.length){
   const id=ids[offset++];
   for(const url of imageUpstreams(id,128)){
    try{
     const res=await fetch(url,{headers:{Accept:'image/png'},signal:AbortSignal.timeout(3000)});
     if(!res.ok||!(res.headers.get('content-type')||'').startsWith('image/'))continue;
     const bytes=Buffer.from(await res.arrayBuffer());
     if(bytes.byteLength<24||bytes.byteLength>750_000||bytes[0]!==137||bytes[1]!==80||bytes[2]!==78||bytes[3]!==71)continue;
     await writeFile(join(OUTPUT,'item-icons',encodeURIComponent(id)+'.png'),bytes);
     stored.push(id);break;
    }catch{}
   }
  }
 }
 await Promise.all(Array.from({length:Math.min(8,ids.length)},()=>worker()));
}
// Catálogo estático opcional publicado junto con la web.
// La primera apertura no dependerá del almacenamiento del navegador ni de
// una solicitud CORS a un CDN. Si falla en Netlify, la función server-side
// y las otras fuentes siguen disponibles. Jamás usar recetas fabricadas.
const prefetchCatalog=!!process.env.NETLIFY&&process.env.GILDEM_PREFETCH_CATALOG!=='0';
const catalogStored=[];
if(prefetchCatalog){
 const sources=[
  'https://raw.githubusercontent.com/vkorne-web/albion-market/main/',
  'https://cdn.jsdelivr.net/gh/vkorne-web/albion-market@main/'
 ];
 async function cacheOne(file){
  for(const origin of sources){
   try{
    const res=await fetch(origin+file,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(6500)});
    if(!res.ok)continue;
    const raw=await res.text();
    if(raw.length<1000||raw.length>10_000_000)continue;
    const payload=JSON.parse(raw);
    if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).length<100)continue;
    await mkdir(join(OUTPUT,'catalog'),{recursive:true});
    await writeFile(join(OUTPUT,'catalog',file),raw);catalogStored.push(file);return;
   }catch{}
  }
 }
 await Promise.all(['names_es.json','recipes.json'].map(cacheOne));
}
await writeFile(join(OUTPUT,'version.json'),JSON.stringify({app:'Gildem Albion Lab Unificado',version:'9.11.0',edition:'unified-1.0',build:'github-netlify',api:'west / AODP',publishedAt:new Date().toISOString()},null,2)+'\n');
await writeFile(join(OUTPUT,'core/icon-manifest.js'),`export const LOCALLY_CACHED_ICONS = new Set(${JSON.stringify(stored)});\n`);
console.log(`Gildem Albion Lab Unificado: dist/ preparado. Iconos locales: ${stored.length}. Catálogos estáticos: ${catalogStored.length}. Proxy AODP West para mercado y catálogos de recetas del juego.`);
