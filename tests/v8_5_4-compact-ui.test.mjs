import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
test('Black y Royal Craft: formularios compactos y destinos exclusivos',()=>{
 assert(app.includes("qcControls('craft')"));
 assert(app.includes("qcControls('auto')"));
 assert(app.includes("market:'black'"));
 assert(app.includes("qcSetValue('auto-market','royal')"));
 assert(!app.includes('<input type="search" id="auto-branch-search"'));
 assert(!app.includes('id="craft-branch-search"'));
 assert(!app.includes('Solo los que marco'));
 assert(app.includes('data-qc-all'));
 assert(app.includes('qcRoyalBranchPicker()'));
});
test('selecciones reales de tiers, encantamientos, y uso de todo el presupuesto',()=>{
 assert(app.includes("recipeUniverse.slice(0,1800).filter(id=>qcVariantIncluded('craft'"));
 assert(app.includes("pick.chosen=pick.chosen.filter(x=>qcVariantIncluded('auto'"));
 assert(app.includes("QC_TIERS=[4,5,6,7,8]"));
 assert(app.includes("QC_ENCH=[1,2,3,4]"));
 assert(app.includes("QC_BUDGETS=[5000000,10000000,15000000,20000000]"));
 assert(app.includes("invest:input.invest")&&app.includes("useAll:invest==='all'"));
 assert(app.includes("invest:autoPrefs.invest")&&app.includes("useAll:invest==='all'"));
 assert(css.includes('.qc-settings-grid'));
 assert(css.includes('@media(max-width:510px)'));
});
