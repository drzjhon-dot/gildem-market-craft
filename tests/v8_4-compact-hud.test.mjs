import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {refinedBonusCity,materialPurchaseCities,REFINED_BONUS_CITY} from '../core/material-cities.js';
import {itemMatches} from '../core/item-selection.js';
import {refinementScanIds} from '../core/refining-opportunities.js';
const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
const styles=await readFile(new URL('../styles.css',import.meta.url),'utf8');

test('v8.4: materiales refinados en las cinco ciudades con bono, no infiere bono para artefactos',()=>{
 assert.deepEqual(REFINED_BONUS_CITY,{METALBAR:'Thetford',PLANKS:'Fort Sterling',CLOTH:'Lymhurst',LEATHER:'Martlock',STONEBLOCK:'Bridgewatch'});
 for(const [id,city] of [['T5_METALBAR','Thetford'],['T8_PLANKS_LEVEL3@3','Fort Sterling'],['T4_CLOTH','Lymhurst'],['T6_LEATHER_LEVEL2@2','Martlock'],['T7_STONEBLOCK','Bridgewatch']])assert.equal(refinedBonusCity(id),city);
 for(const id of ['T5_ORE','T5_RUNE','T6_SHOES_PLATE_SET1','T4_STONEBLOCK@1'])assert.equal(refinedBonusCity(id),null);
});
test('v8.4: elección de ciudad por material refinado se puede cambiar a mejor mercado',()=>{
 const cities=['Martlock','Thetford','Lymhurst','Fort Sterling','Bridgewatch'];
 assert.deepEqual(materialPurchaseCities('T5_METALBAR','bonus',cities),['Thetford']);
 assert.deepEqual(materialPurchaseCities('T5_RUNE','bonus',cities),cities);
 assert.deepEqual(materialPurchaseCities('T5_METALBAR','all',cities),cities);
 assert.deepEqual(materialPurchaseCities('T5_METALBAR','Martlock',cities),['Martlock']);
});
test('v8.4: un solo encantamiento por pestaña, acepta .0–.4 y todos',()=>{
 assert(app.includes('QC_ENCH=[1,2,3,4]'));
 assert(!app.includes("selectField('Encantamiento máximo'"));
 for(let e=0;e<=4;e++){
  assert(itemMatches('T6_SHOES_PLATE_SET1'+(e?'@'+e:''),{enchExact:String(e)}));
  assert(!itemMatches('T6_SHOES_PLATE_SET1'+(e?'@'+e:''),{enchExact:String((e+1)%5)}));
 }
 assert(itemMatches('T6_SHOES_PLATE_SET1@4',{enchExact:'all'}));
});
test('v8.4: no se muestran opciones de refinado previo a fabricar ni en el escáner',()=>{
 assert(!app.includes("selectField('Modo de materiales','auto-refining-mode'"));
 assert(!app.includes("selectField('Cómo obtener materiales','craft-refining-mode'"));
 assert(!app.includes("selectField('Encantamiento máximo'"));
 assert(app.includes("refiningMode:'off',refiningFee:0,refiningDaily:0,refiningFocus:false"));
 assert(app.includes("const refiningMode='off',refiningFee=0"));
 assert(app.includes("materialPurchase:'bonus'"));
});
test('v8.4: refinamiento para vender continúa independiente en Encontrar oportunidades',()=>{
 assert(app.includes("['refining','Refinamiento'"));
 assert(app.includes('createRefiningCandidates'));
 assert(refinementScanIds({families:['CLOTH'],tierMin:4,tierMax:4,enchant:0}).some(x=>x.id==='T4_CLOTH'));
});
test('v8.4: bonificaciones e inversión en tarjetas compactas con comportamiento responsivo',()=>{
 for(const selector of ['.craft-compact-grid','.craft-compact-card','.craft-mini-fields','.craft-market-note'])assert(styles.includes(selector));
 assert(app.includes("qcControls('craft')"));
 assert(app.includes("qcControls('auto')"));
 assert(styles.includes('@media(max-width:1250px){.craft-compact-grid{grid-template-columns:1fr}'));
 assert(styles.includes('.craft-bonus-card .craft-mini-fields,.craft-invest-card .craft-mini-fields{grid-template-columns:1fr}'));
});
