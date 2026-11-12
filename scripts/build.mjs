import {rm,mkdir,cp,writeFile} from 'node:fs/promises';
import {basename} from 'node:path';
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});
for(const file of ['index.html','styles.css','manifest.webmanifest','sw.js'])await cp(file,`dist/${file}`);
// Exclude obsolete source/assets when files remain in an incrementally updated GitHub repo.
const deprecated=new Set(['flipping.js','flips.svg','refining.svg']);
for(const dir of ['src','assets'])await cp(dir,`dist/${dir}`,{recursive:true,filter:path=>!deprecated.has(basename(path))});
await writeFile('dist/version.json',JSON.stringify({name:'Gildem Market & Craft',version:'2.0.1',builtAt:new Date().toISOString()},null,2));
console.log('dist/ lista para Netlify');
