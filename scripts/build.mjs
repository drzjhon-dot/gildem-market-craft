import {rm,mkdir,cp,writeFile} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});
for(const file of ['index.html','styles.css','manifest.webmanifest','sw.js'])await cp(file,`dist/${file}`);
for(const dir of ['src','assets'])await cp(dir,`dist/${dir}`,{recursive:true});
await writeFile('dist/version.json',JSON.stringify({name:'Gildem Market & Craft',version:'1.9.0',builtAt:new Date().toISOString()},null,2));
console.log('dist/ lista para Netlify');
