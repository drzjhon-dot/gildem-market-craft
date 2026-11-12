import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {familyKey,familyDisplayName,catalogFamilies,expandSelectedFamilies} from '../src/market-intelligence.js';

const ids=[
 'T4_MAIN_MACE','T4_MAIN_MACE@1','T5_MAIN_MACE','T5_MAIN_MACE@1',
 'T6_MAIN_MACE','T7_MAIN_MACE','T8_MAIN_MACE','T8_MAIN_MACE@1',
 'T4_2H_MACE','T5_2H_MACE','T8_2H_MACE','T4_MAIN_SWORD'
];
const names={
 T4_MAIN_MACE:'Maza del iniciado',
 T5_MAIN_MACE:'Maza del experto',
 T8_MAIN_MACE:'Maza del anciano',
 T4_2H_MACE:'Maza pesada del iniciado',
 T8_2H_MACE:'Maza pesada del anciano',
 T4_MAIN_SWORD:'Espada del iniciado'
};

test('familia se identifica por tipo de objeto sin tier ni encantamiento',()=>{
 assert.equal(familyKey('T4_MAIN_MACE'),'MAIN_MACE');
 assert.equal(familyKey('T8_MAIN_MACE@3'),'MAIN_MACE');
 assert.equal(familyKey('T8_2H_MACE'),'2H_MACE');
 assert.equal(familyKey('bad'),null);
 assert.equal(familyDisplayName('Maza del anciano','MAIN_MACE'),'Maza');
 assert.equal(familyDisplayName('Maza pesada del experto','2H_MACE'),'Maza pesada');
});
test('menú individual muestra un objeto por familia, sin repetir los tiers',()=>{
 const result=catalogFamilies({ids,names,branchKeys:['mace']});
 assert.equal(result.total,2);
 assert.deepEqual(new Set(result.families.map(x=>x.label)),new Set(['Maza','Maza pesada']));
 assert.equal(result.families.find(x=>x.key==='MAIN_MACE').variants,8);
 assert.equal(result.families.find(x=>x.key==='MAIN_MACE').id,'T4_MAIN_MACE');
 assert(!result.families.some(x=>x.key.includes('T8')));
});
test('buscar T8 por ID encuentra su tipo de objeto y lista variantes, incluso encantamientos',()=>{
 const found=catalogFamilies({ids,names,branchKeys:['mace'],search:'T8_MAIN_MACE'});
 assert.equal(found.total,1);
 assert.equal(found.families[0].label,'Maza');
 const page=expandSelectedFamilies({ids,branchKeys:['mace'],selectedFamilies:['MAIN_MACE'],limit:50});
 assert.equal(page.total,8);
 assert(page.ids.includes('T8_MAIN_MACE'));
 assert(page.ids.includes('T8_MAIN_MACE@1'));
 assert(!page.ids.includes('T8_2H_MACE'));
});
test('selecciones anteriores guardadas con ID tier se migran a familia y se conservan',()=>{
 const x=catalogFamilies({ids,names,branchKeys:['mace'],selectedOnly:true,selectedFamilies:['T8_MAIN_MACE']});
 assert.equal(x.total,1);
 assert.equal(x.families[0].key,'MAIN_MACE');
});
test('consultas individuales de muchos tipos pueden ampliarse por lotes sin perder tiers',()=>{
 const samples=[];
 for(let n=0;n<70;n++)for(let t=4;t<=8;t++)samples.push(`T${t}_MAIN_MACE_FAMILY${n}`);
 // Use real branch filtering: these additional stems are not recognized by the mace family.
 const first=expandSelectedFamilies({ids,branchKeys:['mace'],selectedFamilies:['MAIN_MACE'],limit:3});
 assert.equal(first.ids.length,3);
 assert(!first.complete);
 const pages=[...first.ids];let offset=first.nextOffset;
 while(offset<first.total){const next=expandSelectedFamilies({ids,branchKeys:['mace'],selectedFamilies:['MAIN_MACE'],offset,limit:3});pages.push(...next.ids);offset=next.nextOffset;}
 assert.equal(new Set(pages).size,8);
});
test('interfaz incluye modo por familias, frescura activada de entrada y ayuda sencilla',()=>{
 const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert(source.includes('forceFresh:persisted.forceFresh!==false'));
 assert(source.includes('Forzar datos frescos <span class="small-print">(activado por defecto)'));
 assert(source.includes('data-catalog-family='));
 assert(source.includes('expandSelectedFamilies({ids:pool()'));
 assert(!source.includes('data-catalog-pick='));
 assert(!source.includes('Escudo de rentabilidad'));
 for(const word of ['Compra +%','Venta -%','ROI mínimo','Capital por objeto','Protección del beneficio'])assert(source.includes(word),word);
 assert(source.includes('West Orderbook'));
});
