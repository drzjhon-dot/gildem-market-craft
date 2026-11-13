// Materias existentes no se compran de nuevo. Su valor económico se mantiene
// en el profit: disponer de inventario NO implica costo de oportunidad cero.
export const ITEM_PATTERN=/^T[1-8]_[A-Z0-9_]+(?:@[1-4])?$/;
export function validateEntry(entry){const id=String(entry?.id||'').trim().toUpperCase(),city=String(entry?.city||'').trim();const qty=Number(entry?.qty),unitCost=Number(entry?.unitCost);
 if(!ITEM_PATTERN.test(id)||!city||!Number.isSafeInteger(qty)||qty<0||!Number.isFinite(unitCost)||unitCost<0)throw Error('Material, ciudad, cantidad o costo inválidos');
 return {id,city,qty,unitCost};
}
const key=(id,city)=>id+'|'+city;
export function reservationMap(portfolios=[],ignoreId=null){const res=new Map();
 for(const p of portfolios){if(p?.started||p?.id===ignoreId)continue;
  for(const x of p.inventoryAllocations||[]){const k=key(x.id,x.city);res.set(k,(res.get(k)||0)+x.qty);}
 }return res;
}
export function availableInventory(entries=[],portfolios=[]){const reserved=reservationMap(portfolios);
 return entries.map(x=>({...validateEntry(x),reserved:reserved.get(key(x.id,x.city))||0,available:Math.max(0,x.qty-(reserved.get(key(x.id,x.city))||0))}));
}
export function procurementPlan(materials=[],entries=[],portfolios=[]){const inventory=availableInventory(entries,portfolios);
 const stock=new Map(inventory.map(x=>[key(x.id,x.city),x.available]));
 const needed=[],allocations=[];let cashSaved=0;
 for(const mat of materials){const id=mat.id,city=mat.city,qty=Math.ceil(Number(mat.qtyGross)||0);if(qty<=0)continue;
  const k=key(id,city),available=stock.get(k)||0,fromStock=Math.min(qty,available),buy=qty-fromStock;
  stock.set(k,available-fromStock);
  if(fromStock){allocations.push({id,city,qty:fromStock});cashSaved+=fromStock*(Number(mat.unitPrice)||0);}
  needed.push({id,city,need:qty,stock:fromStock,buy,price:Number(mat.unitPrice)||0});
 }
 return {needed,allocations,cashSaved};
}
export function consumeAllocations(entries,allocations){const stock=entries.map(validateEntry);
 for(const x of allocations){const item=stock.find(a=>a.id===x.id&&a.city===x.city);
  if(!item||item.qty<x.qty)throw Error('El inventario cambió: faltan unidades de '+x.id+' en '+x.city);
  item.qty-=x.qty;
 }
 return stock;
}
