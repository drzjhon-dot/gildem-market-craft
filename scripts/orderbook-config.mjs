/**
 * Dónde lee la web el libro de órdenes publicado por GitHub Actions (rama «orderbook-data»).
 * Prioridad: orderbook.config.json en la raíz → variable GILDEM_ORDERBOOK_BASE → repositorio de Netlify (REPOSITORY_URL).
 */
export function githubRawBase(repositoryUrl,branch='orderbook-data'){
 const m=/github\.com[/:]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(String(repositoryUrl||''));
 return m?`https://raw.githubusercontent.com/${m[1]}/${m[2]}/${branch}`:null;
}
export function orderbookConfig({fileConfig=null,env={}}={}){
 if(fileConfig?.base)return {base:String(fileConfig.base).replace(/\/$/,''),source:'orderbook.config.json'};
 if(fileConfig?.repo){const base=githubRawBase('https://github.com/'+fileConfig.repo,fileConfig.branch||'orderbook-data');if(base)return {base,source:'orderbook.config.json'};}
 if(env.GILDEM_ORDERBOOK_BASE)return {base:env.GILDEM_ORDERBOOK_BASE.replace(/\/$/,''),source:'GILDEM_ORDERBOOK_BASE'};
 const base=githubRawBase(env.REPOSITORY_URL);return base?{base,source:'REPOSITORY_URL (Netlify)'}:{};
}
