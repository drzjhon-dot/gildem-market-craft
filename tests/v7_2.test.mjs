import test from 'node:test';
import assert from 'node:assert/strict';
import {FULL_ITEM_DUMP,FULL_ITEM_DUMP_BACKUP,extractSpecialRecipes} from '../core/special-recipes.js';
import {BRANCH_CATEGORIES,BRANCHES,categoryIconId,branchIconId} from '../core/branches.js';
import {fetchAndExtract} from '../netlify/functions/recipes.mjs';
import {readFileSync} from 'node:fs';

function fixture(){
 const potions=[0,1,2,3,4].map(i=>({'@uniquename':`T${4+i}_POTION_HEAL`,craftingrequirements:{'@amountcrafted':'5',craftresource:[{'@uniquename':'T4_BURDOCK','@count':'24'},{'@uniquename':'T3_EGG','@count':'6','@maxreturnamount':'0'}]}}));
 const mounts=[3,4,5,6].map(t=>({'@uniquename':`T${t}_MOUNT_HORSE`,craftingrequirements:{craftresource:[{'@uniquename':`T${t}_FARM_HORSE_GROWN`,'@count':'1','@maxreturnamount':'0'},{'@uniquename':`T${t}_LEATHER`,'@count':'20'}]}}));
 const equipment=[4,5,6,7].map(t=>({'@uniquename':`T${t}_ARMOR_GATHERER_WOOD`,craftingrequirements:{craftresource:[{'@uniquename':`T${t}_LEATHER`,'@count':'8'}]}}));
 const foods=[{'@uniquename':'T4_MEAL_SALAD',craftingrequirements:{'@amountcrafted':'10',craftresource:[{'@uniquename':'T4_TURNIP','@count':'16'}]}},{'@uniquename':'T5_MEAL_PIE',craftingrequirements:{'@amountcrafted':'10',craftresource:[{'@uniquename':'T5_MEAT','@count':'16'}]}}];
 return {items:{consumableitem:[...potions,...foods],mount:mounts,equipmentitem:equipment}};
}

test('v7.2 source URL apunta a items.json RAW y no al archivo formatted de nombres',()=>{
 for(const u of [FULL_ITEM_DUMP,FULL_ITEM_DUMP_BACKUP]){
  assert.ok(u.endsWith('/items.json'));
  assert.equal(u.includes('/formatted/'),false);
 }
});
test('v7.2 Netlify extrae un catálogo compacto y válido del dump realista',async()=>{
 let seen=0;const fetcher=async(url)=>{seen++;assert.ok([FULL_ITEM_DUMP,FULL_ITEM_DUMP_BACKUP].includes(url));return {ok:true,json:async()=>fixture()};};
 const result=await fetchAndExtract(fetcher);
 assert.equal(seen,1);
 assert.equal(result.count,15);
 assert.equal(result.recipes.T4_POTION_HEAL.amountCrafted,5);
 assert.equal(result.recipes.T3_MOUNT_HORSE.specialtyEnabled,false);
 assert.equal(result.recipes.T4_ARMOR_GATHERER_WOOD.market,'royal');
 assert.equal(result.updatedAt.length>10,true);
});
test('v7.2 fuentes fallback: intenta raw GitHub si falla CDN',async()=>{
 let calls=0;
 const result=await fetchAndExtract(async url=>{calls++;if(calls===1)return {ok:false,status:503};return {ok:true,json:async()=>fixture()};});
 assert.equal(calls,2);
 assert.equal(result.source,FULL_ITEM_DUMP_BACKUP);
});
test('v7.2 rechaza payload sin recetas oficiales, sin inventar items',()=>{
 assert.deepEqual(extractSpecialRecipes({items:[]}),{});
});
test('v7.2 imágenes configuradas para todas las categorías y subramas',()=>{
 for(const b of BRANCH_CATEGORIES){assert.match(categoryIconId(b.key),/^T\d+_/);assert.equal(b.iconId,categoryIconId(b.key));}
 for(const b of BRANCHES){assert.match(branchIconId(b.key),/^T\d+_/);assert.equal(b.iconId,branchIconId(b.key));}
});
test('v7.2 respaldo exportado puede restaurarse al importar versión 7',()=>{
 const src=readFileSync(new URL('../app.js',import.meta.url),'utf-8');
 assert.match(src,/version:8,exported:|version:8,exported:new Date/);
 assert.match(src,/\[4,6,7,8\]\.includes\(payload\.version\)/);
});
test('v7.2 Netlify incluye función de recetas y fallback de iconos',()=>{
 const build=readFileSync(new URL('../package.json',import.meta.url),'utf-8');
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf-8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf-8');
 assert.ok(build.includes('node --check netlify/functions/recipes.mjs'));
 assert.ok(app.includes("data-icon-step"));
 assert.ok(readFileSync(new URL("../core/icons.js",import.meta.url),"utf8").includes("item-fallback.svg"));
 assert.ok(sw.includes('gildem-craft-pro-v9.11.0'));
});
