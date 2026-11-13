import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {materialUsage} from '../core/production-view.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('materialUsage: cada material sabe para qué objetos del plan sirve',()=>{
 const rows=[{id:'T4_SHOES_A',qty:3,materials:[{id:'T4_METALBAR',city:'Fort Sterling',count:8,used:6}]},
  {id:'T4_SHOES_B',qty:2,materials:[{id:'T4_METALBAR',city:'Fort Sterling',count:8,used:6},{id:'T4_ARTEFACT',city:'Caerleon',count:1,used:1,ret:false}]},
  {id:'T5_IGNORED',qty:0,materials:[{id:'T5_METALBAR',city:'Thetford',count:8,used:6}]}];
 const usage=materialUsage(rows);
 assert.deepEqual(usage.get('T4_METALBAR|Fort Sterling'),['T4_SHOES_A','T4_SHOES_B']);
 assert.deepEqual(usage.get('T4_ARTEFACT|Caerleon'),['T4_SHOES_B']);
 assert.equal(usage.has('T5_METALBAR|Thetford'),false);
});
test('Resultados: listas en filas, ordenadas por tier, con «Para», «sobran» y «No se devuelve»',()=>{
 const app=read('app.js');
 assert(app.includes('groupProduction(rows).sort(byTier)'));
 assert(app.includes('groupLogistics(rows).sort(byTier)'));
 assert(app.includes('[...supply].sort(byTier)'));
 assert(app.includes('itemTier(id)*10+itemEnch(id)'));
 for(const text of ['gx-count','data-label="Para"','reutilizas ${fmt(reused)}','No se devuelve','data-label="Vender en"','data-plan-group'])assert(app.includes(text),text);
 assert(!app.includes('marketNeedsHtml'));
 assert(!app.includes('gcp-compact-card gcp-production-card'));
});
test('tema: tipografías propias precacheadas, color por ciudad y movimiento respetuoso',()=>{
 const css=read('styles.css'),sw=read('sw.js'),html=read('index.html');
 for(const f of ['fonts/bricolage-grotesque-latin-wght-normal.woff2','fonts/grenze-gotisch-latin-wght-normal.woff2']){
  assert(existsSync(new URL('../'+f,import.meta.url)),f);assert(sw.includes('./'+f));assert(css.includes('./'+f));
 }
 assert(!html.includes('fonts.googleapis.com'),'sin dependencias externas de fuentes');
 for(const city of ['bridgewatch','lymhurst','martlock','thetford','fortsterling','caerleon','brecilien','blackmarket'])assert(css.includes('.gx-city-'+city),city);
 assert(css.includes('prefers-reduced-motion:reduce'));
 assert(read('app.js').includes('document.body.dataset.page=page'));
 assert(read('scripts/build.mjs').includes("'fonts'"));
});
