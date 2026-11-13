import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const root=new URL('../',import.meta.url);
const read=x=>readFileSync(new URL(x,root),'utf8');
// Test the actual integrated application, not obsolete installer fragments.
// The published GitHub project must be self-contained and need no `parts/`.
const app=read('app.js');
function section(start,end){
 const a=app.indexOf(start),b=app.indexOf(end,a+start.length);
 assert(a>=0&&b>a,`No se encuentra la sección integrada: ${start}`);
 return app.slice(a,b);
}
const core=section('const QC_TIERS=[','async function refreshCraftItems(){');
const black=section('function craftPage(){','const AUTO_CATEGORIES=');
const royal=section('function autoPage(){','// Level Craft uses the same verified catalog');
const pickers=section('function itemPickerHtml(','// v8.5.4: Controles compactos');
const branches=section('function qcAutoBranchInit(){','function autoPage(){');
const markup=core+black+royal+pickers+branches;

test('solo se ven las opciones esenciales; destinos fijos',()=>{
 assert(!markup.includes('auto-branch-search'));
 assert(!markup.includes('craft-branch-search'));
 assert(!markup.includes('auto-item-search'));
 assert(!markup.includes('craft-item-search'));
 assert(!markup.includes('Solo los que marco'));
 assert(markup.includes('Todos los objetos'));
 assert(black.includes('Mercado Negro'));
 assert(royal.includes('Mercados Royal'));
 assert(core.includes("prefix==='craft'?'black':'royal'"));
});

test('las casillas permiten tiers y encantamientos NO consecutivos',()=>{
 const choices={
  'craft-tier':[4,6], 'craft-ench':[1,3],
  'auto-tier':[5,8], 'auto-ench':[2,4]
 };
 const context={
  craftPrefs:{tiersSelected:[4,6],enchSelected:[1,3]},
  autoPrefs:{tiersSelected:[5,8],enchSelected:[2,4]},
  document:{querySelectorAll(selector){const key=selector.match(/\[data-qc-multi="([^"]+)"\]/)?.[1];return (choices[key]||[]).map(value=>({value:String(value)}));}},
  itemTier(id){return Number(id.match(/^T([1-8])_/)[1]);},
  itemEnch(id){return Number(id.split('@')[1]||0);},
  categoryForBranch(x){return x==='alchemy'?'potions':'weapons';},
  branchByKey(){return {city:'Martlock'};},
  val(){return 'boots_plate';},
  control(){return null;},
  checked(){return false;},
  h:s=>String(s)
 };
 const probe=`${core}\n;({qcArray,qcVariantIncluded,qcChoices})`;
 const api=runInNewContext(probe,context);
 assert.equal(api.qcVariantIncluded('craft','T4_MAIN_AXE@1','axes'),true);
 assert.equal(api.qcVariantIncluded('craft','T6_MAIN_AXE@3','axes'),true);
 assert.equal(api.qcVariantIncluded('craft','T5_MAIN_AXE@1','axes'),false);
 assert.equal(api.qcVariantIncluded('craft','T4_MAIN_AXE@2','axes'),false);
 assert.equal(api.qcVariantIncluded('craft','T4_MAIN_AXE','axes'),false);
 assert.equal(api.qcVariantIncluded('auto','T5_MAIN_AXE@2','axes'),true);
 assert.equal(api.qcVariantIncluded('auto','T8_MAIN_AXE@4','axes'),true);
 assert.equal(api.qcVariantIncluded('auto','T6_MAIN_AXE@4','axes'),false);
 assert.equal(api.qcVariantIncluded('auto','T5_POTION_HEAL','alchemy'),false);
 assert(api.qcChoices('craft','budget',[[5000000,'5M'],[10000000,'10M']],10000000).includes('data-qc-single="craft-budget"'));
 assert.deepEqual(Array.from(api.qcArray([1,3,3,9],[1,2,3,4],[1,2])),[1,3]);
});
