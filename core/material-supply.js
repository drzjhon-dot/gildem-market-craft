// Indicador de profundidad de venta al precio observado en compra de materiales.
// No supone que las órdenes observadas sigan disponibles ni exige libros si faltan.
export function checkMaterialSupply(materials,sellBook){const checked=[],missing=[],warnings=[];
 for(const m of materials||[]){const want=Math.ceil(Number(m.qtyGross)||0);if(want<1)continue;
  const levels=sellBook.get(m.id+'|'+m.city);
  if(!levels?.length){missing.push({id:m.id,city:m.city,qty:want});continue;}
  const rawPrice=Number(m.originalPrice)||Number(m.unitPrice)||0;
  const available=levels.filter(l=>l.price<=rawPrice).reduce((s,l)=>s+l.amount,0);
  const line={id:m.id,city:m.city,need:want,available,price:rawPrice};checked.push(line);
  if(available<want)warnings.push(`${m.id} (${m.city}): necesitas ${want}, pero solo ${available} aparecen a ${Math.round(rawPrice)} silver o menos en las órdenes observadas.`);
 }
 return {checked,missing,warnings,verified:checked.length,insufficient:checked.filter(x=>x.available<x.need).length};
}
