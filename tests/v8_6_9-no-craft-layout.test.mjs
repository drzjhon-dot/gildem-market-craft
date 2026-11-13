import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');

test('el estado sin crafting ocupa todo el ancho de page-grid',()=>{
 assert.match(app,/<section class="panel gcp-no-craft-plan col-12"/);
 assert.match(css,/\.page-grid > \.gcp-no-craft-plan\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/s);
});
test('los botones del estado sin crafting se adaptan a pantallas estrechas',()=>{
 assert.match(css,/\.gcp-no-craft-plan \.button-row > \.btn\s*\{[^}]*white-space:\s*normal/s);
 assert.match(css,/@media\s*\(max-width:\s*600px\)[\s\S]*?\.gcp-no-craft-plan \.button-row > \.btn\s*\{\s*width:\s*100%/);
});
