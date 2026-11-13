import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
test('v8.4.1: filtros de ciudad, tier y encantamiento contenidos en un único bloque compacto',()=>{
 assert.match(app,/qcControls\('craft'\)/);
 for(const id of ['craft-city','craft-tiermin','craft-tiermax','craft-ench-exact'])assert.match(app,new RegExp("'"+id+"'"));
 assert.match(css,/#craft-form \.craft-filter-row/);
});
test('v8.4.1: las tres categorías no se estiran hasta llenar toda la pantalla',()=>{
 assert.match(css,/#craft-form \.branch-group-grid \{/);
 assert.match(css,/grid-template-columns: repeat\(3, minmax\(0, 210px\)\)/);
 assert.match(css,/#craft-form \.branch-choice-grid \{[\s\S]*?display: flex/);
});
test('v8.4.1: diseño responsive y refinamiento como oportunidad conservado',()=>{
 assert.match(css,/@media \(max-width: 740px\)/);
 assert.match(app,/\['refining','Refinamiento'/);
});
