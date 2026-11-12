import {captureMarketSignals} from './market-intelligence.js';
const validId=id=>typeof id==='string'&&/^[A-Z0-9_@-]{3,100}$/.test(id);
/** Preserves the existing basket and attaches each explicitly selected item-city observation. */
export function markedItemsForPlanner(rows=[],marks=new Set(),recipes={},existing=[],limit=150,priorSignals=[]){
 const selected=new Set(existing.filter(validId));let rejectedNoRecipe=0,skippedLimit=0;
 for(const row of rows){if(!validId(row?.id)||!marks.has(row.id+'|'+row.city))continue;
  if(!recipes[row.id]?.materials?.length){rejectedNoRecipe++;continue;}
  if(selected.has(row.id))continue;if(selected.size>=limit){skippedLimit++;continue;}selected.add(row.id);}
 const accepted=new Set(selected);
 const filtered=new Set([...marks].filter(x=>accepted.has(x.split('|')[0])&&rows.some(r=>r.id+'|'+r.city===x)));
 return {items:[...selected],added:selected.size-existing.length,rejectedNoRecipe,skippedLimit,
  signals:captureMarketSignals(rows,filtered,priorSignals).filter(s=>accepted.has(s.id))};
}
export function transferPlanRows(rows=[],{maxItems=150,maxCrafts=100000}={}){
 if(!Array.isArray(rows)||!rows.length)throw Error('Genera primero un plan con rutas rentables.');
 const grouped=new Map(),cities=new Map();
 for(const row of rows){if(!validId(row?.id))throw Error('ID de artículo no válido');const qty=Number(row.qty);
  if(!Number.isSafeInteger(qty)||qty<1)throw Error('Cantidad inválida en el plan');
  grouped.set(row.id,(grouped.get(row.id)||0)+qty);
  if(!cities.has(row.id))cities.set(row.id,new Set());if(row.city)cities.get(row.id).add(row.city);}
 if(grouped.size>maxItems)throw Error('Demasiadas variantes para Calculadora');
 if([...grouped.values()].some(q=>q>maxCrafts))throw Error('La cantidad supera 100.000 fabricaciones');
 return {items:[...grouped].map(([id,qty])=>({id,qty,noBonus:false})),summary:[...grouped].map(([id,qty])=>({id,qty,cities:[...cities.get(id)]})),totalCrafts:[...grouped.values()].reduce((a,b)=>a+b,0)};
}
