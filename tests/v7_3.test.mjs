import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {iconSources,nextIconSource,validIconId,FALLBACK_ICON} from '../core/icons.js';
import iconProxy,{resolveIcon,imageUpstreams} from '../netlify/functions/item-image.mjs';
import {BRANCHES,BRANCH_CATEGORIES} from '../core/branches.js';

const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0,73,72,68,82,0,0,0,1,0,0,0,1]);
const headers={get:key=>key==='content-type'?'image/png':'0'};

test('v9.11.0 iconos usan render oficial de Albion y respaldo local',()=>{
 const sources=iconSources('T4_BAG',84);
 assert.equal(sources.length,3);
 assert.match(sources[0],/^\.\/\.netlify\/functions\/item-image/);
 assert.match(sources[1],/^https:\/\/render\.albiononline\.com\/v1\/item\//);
 assert.equal(sources[2],FALLBACK_ICON);
});
test('v7.3 icono local precede las fuentes externas cuando compilado en Netlify',()=>{
 const src=iconSources('T4_MAIN_AXE',128,{localIcons:new Set(['T4_MAIN_AXE'])});
 assert.equal(src[0],'./item-icons/T4_MAIN_AXE.png');
 assert.equal(src[src.length-1],FALLBACK_ICON);
});
test('v7.3 protege IDs de ítems y tamaños, sin URLs externas arbitrarias',()=>{
 assert.equal(validIconId('T4_MOUNT_HORSE'),true);
 assert.equal(validIconId('T4_BAG@1'),true);
 assert.equal(validIconId('https://example.com/mal.png'),false);
 assert.deepEqual(iconSources('../evil',84),[FALLBACK_ICON]);
 assert.match(iconSources('T4_BAG',9999)[0],/size=192/);
});
test('v7.3 fallback avanza sin cambiar el ID del objeto',()=>{
 const first=nextIconSource('T4_BAG@1',90,0);
 assert.match(first.src,/T4_BAG%401/);
 assert.equal(first.step,1);
 assert.equal(nextIconSource('T4_BAG',90,2).final,true);
});
test('v9.11.0 proxy admite PNG y valida firmas del renderer oficial',async()=>{
 let calls=0;
 const fetched=await resolveIcon('T4_POTION_HEAL',90,async()=>{calls++;return {ok:true,headers,arrayBuffer:async()=>png.buffer};});
 assert.ok(fetched);
 assert.equal(calls,1);
 assert.equal(fetched.contentType,'image/png');
 assert.equal(fetched.bytes.length,png.length);
 assert.equal(imageUpstreams('T4_BAG@1',84).every(x=>x.includes('T4_BAG%401')),true);
});
test('v7.3 proxy rechaza IDs inválidos y no permite SSRF',async()=>{
 const response=await iconProxy(new Request('https://example.net/.netlify/functions/item-image?id=https%3A%2F%2Fevil.com&size=84'));
 assert.equal(response.status,400);
 assert.equal(await resolveIcon('../etc/passwd',60,async()=>{throw Error('No debería consultar');}),null);
});
test('v7.3 un fallo del renderer no impide navegar o usar la calculadora',()=>{
 const src=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(src,/data-icon-step/);
 assert.match(src,/document\.addEventListener\('error',/);
 assert.match(src,/data-action="test-icons"/);
 assert.match(src,/runIconDiagnostics\(\)/);
});
test('v7.3 todas las categorías tienen icono verificable sin mezclar recipes ni market logic',()=>{
 for(const x of [...BRANCH_CATEGORIES,...BRANCHES])assert.equal(validIconId(x.iconId),true);
 const build=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');
 assert.match(build,/NETLIFY/);
 assert.match(build,/icon-manifest\.js/);
});
