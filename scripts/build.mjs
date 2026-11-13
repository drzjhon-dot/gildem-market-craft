import {rm,mkdir,cp,writeFile,readFile} from 'node:fs/promises';
import {orderbookConfig} from './orderbook-config.mjs';
import {basename} from 'node:path';
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});
for(const file of ['index.html','styles.css','manifest.webmanifest','sw.js'])await cp(file,`dist/${file}`);
// Exclude obsolete source/assets when files remain in an incrementally updated GitHub repo.
const deprecated=new Set(['flipping.js','flips.svg','refining.svg','portfolio-engine.js']);
for(const dir of ['src','assets'])await cp(dir,`dist/${dir}`,{recursive:true,filter:path=>!deprecated.has(basename(path))});
await writeFile('dist/version.json',JSON.stringify({name:'Gildem Albion Lab',version:'4.1.0',builtAt:new Date().toISOString()},null,2));
let fileConfig=null;try{fileConfig=JSON.parse(await readFile('orderbook.config.json','utf8'));}catch{}
const ob=orderbookConfig({fileConfig,env:process.env});
await writeFile('dist/orderbook.config.json',JSON.stringify(ob));
console.log(ob.base?`Libro de órdenes: ${ob.base} (${ob.source})`:'Libro de órdenes sin configurar: la web usará solo AODP REST.');
console.log('dist/ lista para Netlify');
