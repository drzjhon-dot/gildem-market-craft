import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const source=read('app.js');

test('v9.11.0: cinco pestañas usan miniaturas SVG locales que se precachean',()=>{
 const html=read('index.html'),sw=read('sw.js');
 for(const [nav,image] of Object.entries({crafting:'black-craft',autocraft:'royal-craft',topmercado:'top-market',craftcal:'craft-cal',ajustes:'settings'})){
  const path=`assets/tabs/${image}.svg`;
  assert(existsSync(new URL('../'+path,import.meta.url)),path);
  assert(html.includes(`data-nav="${nav}"`),nav);
  assert(html.includes(`./${path}`),path);
  assert(sw.includes(`'./${path}'`),path);
  const svg=read(path);assert(svg.includes('<svg ')&&svg.includes('</svg>'));
 }
 assert(!html.includes('data-nav="resultados"'));
 assert(sw.includes('gildem-craft-pro-v9.11.0'));
 assert(html.includes('app.js?v=9.11.0'));
});

test('v9.11.0: botones al lado de objetos, materiales y diarios sin cambiar la compra',()=>{
 for(const needle of ['copyableItemCell(m.id)','copyableItemCell(j.empty,j.name+\' T\'+j.tier)','copyableItemCell(id)','data-copy-item-name','data-label="A comprar"','data-plan-group','resultsCopyShopping(firstOnly=false)'])assert(source.includes(needle),needle);
 assert(source.includes("const copyButton=e.target.closest('[data-copy-item-name]')"));
 assert(source.includes('e.stopPropagation();void copySelectedItemName(copyButton);return;'));
 assert(!source.includes('function itemCell(id,label=\'\',sub=\'\',copy='),'No hay que modificar el renderizador base');
});

test('v9.11.0: copia el nombre mostrado con acentos y escapa los atributos HTML',async()=>{
 const start=source.indexOf('function copyableItemCell(id,label=');
 const end=source.indexOf('\nasync function copySelectedItemName',start);
 const secondEnd=source.indexOf('\n}',end)+2;
 assert(start>=0&&end>start&&secondEnd>end);
 const block=source.slice(start,secondEnd);
 const copy=[];const messages=[];
 const context={itemCell:(id,label)=>`<div class="item-cell">${label||id}</div>`,itemName:id=>id,
  h:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  navigator:{clipboard:{writeText:async s=>copy.push(s)}},showToast:s=>messages.push(s),setTimeout:()=>{}};
 vm.runInNewContext(block+'\nthis.ui={copyableItemCell,copySelectedItemName};',context);
 const html=context.ui.copyableItemCell('T5_JOURNAL',`Diario del herrero mágico T5`);
 assert.match(html,/data-copy-item-name="Diario del herrero mágico T5"/);
 const escaped=context.ui.copyableItemCell('T5_ITEM',`Telas "especiales" & más`);
 assert.match(escaped,/Telas &quot;especiales&quot; &amp; más/);
 const b={dataset:{copyItemName:'Diario del herrero mágico T5'},classList:{add(){}},setAttribute(){}};
 await context.ui.copySelectedItemName(b);
 assert.deepEqual(copy,['Diario del herrero mágico T5']);
 assert.equal(messages[0],'Nombre copiado: Diario del herrero mágico T5');
});
