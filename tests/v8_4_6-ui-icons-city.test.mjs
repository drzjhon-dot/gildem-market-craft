import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {familyChoices,familyDisplayName} from '../core/item-selection.js';
import {iconSources,iconBucket,FALLBACK_ICON} from '../core/icons.js';
import {resolveIcon} from '../netlify/functions/item-image.mjs';
import {createUniversalCandidates} from '../core/opportunity-scan.js';
import {rowMap} from '../core/engine.js';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('familias sin falsos 4.4 y sin título de rango en sus nombres',()=>{
 assert.equal(familyDisplayName('Capucha del experto · 4.4'),'Capucha');
 assert.equal(familyDisplayName('Botas de mercenario del Iniciado · T4.2'),'Botas de mercenario');
 const labels=familyChoices(['T6_HEAD_LEATHER_SET2@4','T4_HEAD_LEATHER_SET2@2','T5_HEAD_LEATHER_SET2'],id=>'Capucha de cazador del iniciado · '+id.slice(1,2)+'.'+(id.split('@')[1]||0));
 assert.equal(labels.length,1);
 assert.equal(labels[0].label,'Capucha de cazador');
 assert.deepEqual(labels[0].tiers,[4,5,6]);
 assert.equal(labels[0].iconId,'T4_HEAD_LEATHER_SET2');
});

test('el selector no imprime códigos internos y muestra tiers sin alterar el filtro',()=>{
 const picker=app.slice(app.indexOf('function renderItemChoices('),app.indexOf('async function refreshCraftItems'));
 assert(!picker.includes('<small>${h(x.stem)}'));
 assert(!picker.includes('title="${h(x.stem)}"'));
 // The new compact selection chooses tiers separately, and does not show
 // a misleading tier range in individual item-family labels.
 assert(picker.includes('data-pick-item'));
 assert(picker.includes('${h(x.label)}'));
 assert(picker.includes('itemimg(x.iconId,34)'));
});

test('el resultado mantiene cotizaciones y compra, sin los cuatro paneles solicitados',()=>{
 const result=app.slice(app.indexOf('function craftResult('),app.indexOf('function refinePage('));
 for(const forbidden of ['Rotación y silver por día:','Economía del lote:','Inventario y desembolso real','Ruta logística por ciudad','Antes de comprar materiales, pulsa'])assert(!result.includes(forbidden),forbidden);
 assert(result.includes('Verificar antes de comprar'));
 assert(result.includes('Lista de compras para comenzar'));
 assert(result.includes('id="preflight-results"'));
});

test('imagen de cualquier item: Netlify cache primero, buckets compartidos y fallbacks',()=>{
 for(const id of ['T4_BAG','T6_SHOES_PLATE_SET2@3','T7_2H_TOOL_PICK_AVALON','T8_OFF_SHIELD@4']){
  const a=iconSources(id,70);
  assert(a[0].startsWith('./.netlify/functions/item-image?id='),id);
  assert(a[0].includes('size=96'));
  assert(a.some(x=>x.includes('render.albiononline.com')));
  assert.equal(a.at(-1),FALLBACK_ICON);
 }
 assert.equal(iconBucket(64),96);
 assert.equal(iconBucket(192),192);
});

test('proxy: solo renderer oficial y caché reusable para todos los ids',async()=>{
 const src=readFileSync(new URL('../netlify/functions/item-image.mjs',import.meta.url),'utf8');
 assert(src.includes('Promise.any(attempts)'));
 assert(src.includes("Netlify-CDN-Cache-Control"));
 assert(src.includes('durable'));
 const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0,73,72,68,82,0,0,0,1,0,0,0,1]);
 let calls=0;
 const result=await resolveIcon('T6_2H_TOOL_AXE',96,async()=>{calls++;return {ok:true,headers:{get:x=>x==='content-type'?'image/png':'0'},arrayBuffer:async()=>png.buffer};});
 assert.equal(calls,1);
 assert.equal(result.contentType,'image/png');
});

test('selector ¿Dónde fabricar? guardado y aplicado al cálculo, sin bono falso',()=>{
 assert(app.includes("'auto-city'"));
 assert(app.includes("city=val('auto-city','auto')"));
 const now=new Date(Date.now()-20000).toISOString();
 const rec={'T5_SHOES_PLATE_SET1':{city:'Martlock',materials:[{id:'T5_METALBAR',count:8,ret:true}],amountCrafted:1}};
 const quotes=[];
 for(const city of ['Martlock','Caerleon','Lymhurst']){
  quotes.push({item_id:'T5_METALBAR',city,quality:1,sell_price_min:100,sell_price_min_date:now});
  quotes.push({item_id:'T5_SHOES_PLATE_SET1',city,quality:1,sell_price_min:2500,sell_price_min_date:now});
 }
 const map=rowMap(quotes);
 const input={market:'royal',cities:['Martlock','Caerleon','Lymhurst'],materialPurchase:'all',buyMode:'instant',saleMode:'listed',focus:false,daily:0,station:0,transport:0,materialShipping:0,listingFee:2.5,bmTax:2.5,royalTax:4,riskBM:0,riskRoyal:0,priceStress:8,resourceStress:7,refiningMode:'off'};
 const run=city=>createUniversalCandidates({selected:[{id:'T5_SHOES_PLATE_SET1',branch:'boots_plate'}],recipes:rec,priceMap:map,inputs:{...input,city}}).candidates.find(x=>x.city==='Lymhurst');
 const bonus=run('auto'),other=run('Caerleon'),comparison=run('compare');
 assert(bonus&&other&&comparison);
 assert.equal(bonus.craftCity,'Martlock');
 assert.equal(other.craftCity,'Caerleon');
 assert(bonus.returnRate>other.returnRate);
 assert(bonus.profit>other.profit);
 assert.equal(comparison.craftCity,'Martlock');
});
