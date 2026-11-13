import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file, import.meta.url));
const css=read('styles.css').toString();
const html=read('index.html').toString();
const sw=read('sw.js').toString();
const pages={crafting:'black-craft',autocraft:'royal-craft',topmercado:'top-market',craftcal:'craft-cal',resultados:'results',ajustes:'settings'};
test('v9.11.0: los fondos son diferentes, locales, comprimidos y cargables',()=>{
 for(const [tab,name] of Object.entries(pages)){
  const path=`assets/scenes/${name}.webp`;
  assert(css.includes(`body[data-page="${tab}"]`),`sin regla CSS para ${tab}`);
  assert(css.includes(path),`sin ruta en CSS: ${path}`);
  assert(sw.includes(`'./${path}'`),`sin precaché: ${path}`);
  assert(existsSync(new URL('../'+path,import.meta.url)),`sin imagen: ${path}`);
  const image=read(path);
  assert.equal(image.toString('ascii',0,4),'RIFF',`${name} RIFF WebP`);
  assert.equal(image.toString('ascii',8,12),'WEBP',`${name} WebP`);
  assert(image.length>15000 && image.length<300000,`${name} debe estar optimizado`);
 }
});
test('v9.11.0: nuevo logo y accesos de copiar preservados',()=>{
 assert(html.includes('Gildem Albion Lab'));
 assert(html.includes('src="./assets/branding/gildem-sidebar-logo.webp"'));
 assert(!html.includes('class="brand-copy"'), 'No debe haber un bloque de texto junto al logo');
 assert(!html.includes('class="brand-lab"'), 'No debe haber un subtítulo duplicado junto al logo');
 assert(sw.includes("'./assets/branding/gildem-sidebar-logo.webp'"),'El logo nuevo debe estar precargado');
 assert(existsSync(new URL('../assets/branding/gildem-sidebar-logo.webp',import.meta.url)), 'Debe existir el logo nuevo');
 assert(html.includes('data-page="crafting"'));
 assert(sw.includes('gildem-craft-pro-v9.11.0'));
 assert(html.includes('app.js?v=9.11.0'));
 assert(css.includes('.gcp-copy-name'));
 assert(read('app.js').toString().includes("copyableItemCell(m.id)"));
});


test('v9.11.0: sidebar sin Mi taller y logo fusionado sin tarjeta rectangular',()=>{
 assert(!html.includes('<div class="nav-title">Mi taller</div>'),'«Mi taller» no debe aparecer en sidebar');
 assert(html.includes('class="brand brand-logo-only"'));
 assert(css.includes('.sidebar .brand-logo-only-img'));
 assert(css.includes('mask-image:radial-gradient('),'Logo debe desvanecerse hacia el sidebar');
 assert(css.includes('.sidebar .brand.brand-logo-only'));
});
