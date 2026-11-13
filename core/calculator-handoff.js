// Transferencia de presentacion: del plan economico original a Calculadora de Craft.
// La cantidad de fabricaciones por ID se suma entre mercados, SIN recalcular
// demanda, compras, precio, inventario, recetas ni riesgo en el plan original.
export const CALCULATOR_ITEM_LIMIT=200;
export function prepareCalculatorHandoff(rows=[],{limit=CALCULATOR_ITEM_LIMIT}={}){
 if(!Array.isArray(rows))throw Error('El plan no tiene una lista valida de rutas.');
 const map=new Map();let crafts=0,units=0,refining=0;
 for(const route of rows){
  if(route==null||route.qty===0)continue;
  const id=route.id;
  if(typeof id!=='string'||!/^T[1-8]_[A-Z0-9_]+(?:@[1-4])?$/.test(id))throw Error('Un objeto del plan tiene un ID invalido.');
  const qty=Number(route.qty),multiple=Number(route.craftAmount||1);
  if(!Number.isSafeInteger(qty)||qty<1||!Number.isSafeInteger(multiple)||multiple<1)throw Error('El plan contiene cantidades no validas.');
  if((map.get(id)||0)+qty>99999)throw Error('El plan supera el maximo de 99.999 fabricaciones por objeto en la calculadora.');
  map.set(id,(map.get(id)||0)+qty);crafts+=qty;units+=qty*multiple;
  if(route.recipeKind==='refining')refining+=qty;
 }
 if(map.size>limit)throw Error(`El plan tiene ${map.size} objetos distintos. La calculadora admite hasta ${limit}; reduce el numero de objetos antes de transferir.`);
 return {items:[...map].map(([id,qty])=>({id,qty})),crafts,units,refining};
}
