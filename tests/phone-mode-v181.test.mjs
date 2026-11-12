import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync('index.html','utf8');
const script=readFileSync('src/main.js','utf8');
const css=readFileSync('styles.css','utf8');
test('teléfono: dock accesible con las cinco rutas',()=>{
 for(const route of ['top','planner','calc','refine','flip'])assert.match(html,new RegExp('class="phone-tab[^\\"]*"[^>]*data-route="'+route+'"|data-route="'+route+'"[^>]*class="phone-tab'));
 assert.match(html,/aria-label="Herramientas para teléfono"/);
 assert.equal((html.match(/class="nav-link[^\"]*" data-route=/g)||[]).length,5);
});
test('teléfono: tarjetas y tablas seleccionables, preferencia persistente',()=>{
 assert.match(html,/id="mobile-cards-switch"/);
 assert.match(script,/mobileCards:persisted.mobileCards!==false/);
 assert.match(script,/schemaVersion:10,mobileCards:state.mobileCards/);
 assert.match(script,/function labelPhoneTables\(\)/);
 assert.match(css,/html\[data-mobile-cards="1"\] \.result-table/);
 assert.match(css,/@media \(max-width:800px\)/);
});
test('teléfono: menú accesible y manifest local sin datos falsos',()=>{
 assert.match(html,/aria-controls="main-navigation"/);
 assert.match(html,/id="mobile-backdrop"/);
 assert.match(script,/function syncPhoneMenu\(open=false\)/);
 const m=JSON.parse(readFileSync('manifest.webmanifest','utf8'));
 assert.equal(m.display,'standalone');
 assert.equal(m.lang,'es');
 assert.equal(m.icons.length,2);
 assert(!css.includes('http://'));
});

test('offline: service worker no almacena datos de mercado ni endpoints de Netlify',()=>{
 const sw=readFileSync('sw.js','utf8');
 assert.match(sw,/url\.pathname\.startsWith\('\/api\/'\)/);
 assert.match(sw,/url\.pathname\.startsWith\('\/\.netlify\/'\)/);
 assert.match(sw,/if\(url\.origin !== self\.location\.origin/);
 assert.match(sw,/fetch\(request\)/);
});
