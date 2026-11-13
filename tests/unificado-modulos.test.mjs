import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRefinePage} from '../lab-v3/src/refine-page.js';
import {createBmPage} from '../lab-v3/src/bm-page.js';
const esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const ctx={escape:esc,silver:n=>Number(n||0).toLocaleString('es-ES'),small:n=>String(n),compact:n=>String(n),
 cityBadge:x=>esc(x),itemWithCopy:x=>esc(x),img:x=>esc(x),heading:(title,text,extra='')=>`<h2>${esc(title)}</h2><p>${esc(text)}</p>${extra}`,
 hero:x=>`<div class="hero">${esc(x)}</div>`,toast:()=>{},progress:()=>{},
 marketFetch:async()=>({rows:[],coverage:1,errors:[]}),summarizeHistory:()=>[],quoteMap:()=>new Map(),
 name:x=>x,recipes:()=>({}),names:()=>({}),save:()=>{},persisted:{},rerender:()=>{}};

test('Unificado: Refinamiento avanzado se monta sin otra aplicación y permite cambiar tipo',()=>{
 const page=createRefinePage(ctx);
 const html=page.render();
 assert.match(html,/id="refine-root"/);
 assert.match(html,/id="ref-run"/);
 for(const key of ['transmute','chain','focus','mountKg','buyCities','sellCities'])assert.ok(html.includes(key),key);
 assert.equal(page.onClick({dataset:{refType:'PLANKS'},id:'other'}),true);
 assert.equal(page.saveState().cfg.type,'PLANKS');
 assert.match(page.render(),/data-ref-type="PLANKS"/);
});

test('Unificado: BM 3.1 se monta y mantiene la selección de fuente',()=>{
 const page=createBmPage(ctx);
 assert.match(page.render(),/id="bm-root"/);
 assert.match(page.render(),/id="bm-run"/);
 assert.equal(page.onChange({dataset:{bm:'source'},type:'radio',value:'paste',checked:true}),true);
 assert.equal(page.saveState().cfg.source,'paste');
 assert.match(page.render(),/id="bm-paste"/);
});

test('Unificado: un solo index, estilos aislados y dos motores con el mismo proxy Netlify',()=>{
 const html=readFileSync('index.html','utf8');const app=readFileSync('app.js','utf8');
 const css=readFileSync('lab-v3.css','utf8'),netlify=readFileSync('netlify.toml','utf8');
 for(const nav of ['craftcal','crafting','autocraft','refinamiento','topmercado','ajustes'])assert.ok(html.includes('data-nav="'+nav+'"'),nav);
 assert(!html.includes('<iframe'));
 assert(app.includes('renderBlackUnified()')&&app.includes('renderRefiningUnified()'));
 assert(css.includes('.lab-module .refine-types')&&css.includes('.lab-module .bm-'));
 assert(netlify.includes('from = "/api/market"'));
});
