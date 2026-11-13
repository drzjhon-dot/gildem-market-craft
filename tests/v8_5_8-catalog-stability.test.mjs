import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fetchCatalogFile} from '../netlify/functions/catalog.mjs';
import {validCatalogPayload} from '../core/catalog.js';
import {RECIPE_SUPPLEMENT} from '../core/recipe-supplement.js';

const goodRecipes={
 'T4_MAIN_AXE':{materials:[{id:'T4_METALBAR',count:12,ret:true}],city:'Martlock'},
 'T5_MAIN_AXE':{materials:[{id:'T5_METALBAR',count:12,ret:true}],city:'Martlock'}
};
const goodNames={'T4_MAIN_AXE':'Hacha de adepto','T5_MAIN_AXE':'Hacha del experto'};

function response(data,ok=true){return {ok,status:ok?200:503,json:async()=>data};}

// El navegador puede prohibir IndexedDB por privacidad o modo restringido.
// Eso nunca debe impedir que las recetas descargadas aparezcan en las pestañas.
test('si IndexedDB lanza SecurityError, el catálogo y las ramas siguen cargando',async()=>{
 const originalFetch=globalThis.fetch,originalIndexedDb=globalThis.indexedDB;
 const originalLocation=globalThis.location;
 try{
  Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open(){throw new DOMException('Acceso denegado','SecurityError');}}});
  globalThis.location={href:'https://gildem.example/'};
  const calls=[];
  globalThis.fetch=async url=>{
   calls.push(String(url));
   return response(String(url).includes('names_es.json')?goodNames:goodRecipes);
  };
  const catalog=await import('../core/catalog.js?catalog-stability-1');
  const result=await catalog.loadCatalog(true);
  assert.equal(result.recipes,2+Object.keys(RECIPE_SUPPLEMENT).length); // v9.10: + objetos nuevos del juego
  assert.equal(result.names,2);
  assert.equal(catalog.recipes.T4_MAIN_AXE.city,'Martlock');
  assert(calls.some(x=>x.includes('/.netlify/functions/catalog?file=recipes.json')));
 }finally{
  globalThis.fetch=originalFetch;
  if(originalLocation===undefined)delete globalThis.location;else globalThis.location=originalLocation;
  if(originalIndexedDb===undefined)delete globalThis.indexedDB;else Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:originalIndexedDb});
 }
});

test('si fallan los nombres en español pero no las recetas, todavía se puede escoger un objeto',async()=>{
 const previousFetch=globalThis.fetch;
 try{
  globalThis.fetch=async url=>String(url).includes('names_es.json')?response({error:'sin traducción'},false):response(goodRecipes);
  const catalog=await import('../core/catalog.js?catalog-stability-2');
  const result=await catalog.loadCatalog(true);
  assert.equal(result.recipes,2+Object.keys(RECIPE_SUPPLEMENT).length); // v9.10: + objetos nuevos del juego
  assert.match(result.warning,/nombres en español/);
  assert.equal(catalog.recipes.T5_MAIN_AXE.city,'Martlock');
 }finally{globalThis.fetch=previousFetch;}
});

test('si el proxy falla, se intenta la fuente pública sin inventar una receta',async()=>{
 const previousFetch=globalThis.fetch,previousLocation=globalThis.location;
 try{
  globalThis.location={href:'https://gildem.example/'};
  const called=[];
  globalThis.fetch=async url=>{
   called.push(String(url));
   if(String(url).includes('/.netlify/functions/catalog'))return response({error:'503'},false);
   return response(String(url).includes('names_es.json')?goodNames:goodRecipes);
  };
  const catalog=await import('../core/catalog.js?catalog-stability-3');
  const result=await catalog.loadCatalog(true);
  assert.equal(result.recipes,2+Object.keys(RECIPE_SUPPLEMENT).length); // v9.10: + objetos nuevos del juego
  assert(called.some(x=>x.startsWith('https://cdn.jsdelivr.net/')));
 }finally{globalThis.fetch=previousFetch;if(previousLocation===undefined)delete globalThis.location;else globalThis.location=previousLocation;}
});

test('el proxy no acepta nombres arbitrarios ni datos incompletos',async()=>{
 await assert.rejects(fetchCatalogFile('https://evil.invalid'),/Archivo no permitido/);
 const fetcher=async()=>response({one:'fragmento'});
 await assert.rejects(fetchCatalogFile('recipes.json',fetcher),/Fuente insuficiente/);
});

test('recuperación visible, precache de todos los módulos y versión sin estado viejo',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 const netlify=readFileSync(new URL('../netlify.toml',import.meta.url),'utf8');
 assert.match(html,/id="gildem-boot"/);
 assert.match(html,/data-boot-repair/);
 assert.match(html,/app\.js\?v=9\.11\.0/);
 assert.match(app,/data-action="retry-catalog"/);
 assert.match(app,/if\(action==='retry-catalog'\)syncCatalog\(true\)/);
 assert.match(sw,/gildem-craft-pro-v9\.11\.0/);
 for(const match of app.matchAll(/from ['"]\.\/(core\/[^'"]+)['"]/g))assert(sw.includes("'./"+match[1]+"'"),match[1]+' no está en la caché');
 assert.match(netlify,/for = "\/app\.js"/);
});

test('si una caché responde JSON de error o sin recetas, no vacía los selectores',()=>{
 assert.equal(validCatalogPayload('recipes.json',{error:'error 503'}),false);
 assert.equal(validCatalogPayload('recipes.json',{}),false);
 assert.equal(validCatalogPayload('recipes.json',goodRecipes),true);
 assert.equal(validCatalogPayload('names_es.json',goodNames),true);
});
