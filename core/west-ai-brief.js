// Consultas históricas legibles compatibles con la política AODP-only.
const safeText=x=>String(x??'').replace(/[\r\n\t<>]/g,' ').slice(0,100);
export function makeWestResearchBrief({market='black',branch='',rows=[],observedAt=null}={}){
 const ids=[...new Set(rows.map(r=>safeText(r?.id)).filter(x=>/^T[1-8]_[A-Z0-9_@-]+$/.test(x)))].slice(0,18);
 return ['Servidor obligatorio: AMÉRICA (WEST).','Única fuente numérica: Albion Online Data Project (AODP West).',
 'API: https://west.albion-online-data.com/api-docs',
 'Mercado: '+(market==='royal'?'Royal':'Mercado Negro'),
 'Rama: '+safeText(branch),'IDs: '+ids.join(', '),
 'Referencia: '+(observedAt||'sin fecha'),
 'Distingue precios de publicación, pujas y observaciones del historial. No garantizar ventas.'].join('\n');
}
