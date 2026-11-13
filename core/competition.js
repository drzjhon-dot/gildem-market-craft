// Ordenes de venta OBSERVADAS para señalizar presión de competencia Royal.
// NO son ventas confirmadas ni predicen plazos de ejecución.
import {parsedTime} from './depth.js';
export function normalizeSellBook(raw,ids=[],cities=[],maxAgeHours=24,now=Date.now()){
 const items=new Set(ids),places=new Set(cities),out=new Map();
 const rows=Array.isArray(raw)?raw:Array.isArray(raw?.data)?raw.data:Array.isArray(raw?.rows)?raw.rows:Array.isArray(raw?.items)?raw.items:Array.isArray(raw?.results)?raw.results:[];
 for(const r of rows){const id=r.item_id||r.itemId||r.id,city=r.city||r.location||r.city_name;
  if(!items.has(id)||!places.has(city)||Number(r.quality??r.quality_level??1)!==1)continue;
  const nested=[r.sell_orders,r.sellOrders,r.asks,r.sell].find(Array.isArray);
  const lines=nested||r.orders||[r];
  for(const v of lines){const side=String(nested?'sell':v.side??v.order_type??v.type??'').toLowerCase().replaceAll(/[ _]/g,'');
   if(!['sell','sellorder','ask','asks','2'].includes(side))continue;
   const count=Number(v.amount??v.quantity??v.count??v.item_count??v.volume);
   const price=Number(v.price??v.unit_price??v.price_per_unit);
   const at=parsedTime(v.updated_at||v.date||v.timestamp||r.updated_at||r.date||r.timestamp);
   if(!Number.isSafeInteger(count)||count<1||!(price>0)||!Number.isFinite(at)||(now-at)/3600000>maxAgeHours||at>now)continue;
   const key=id+'|'+city,list=out.get(key)||[];list.push({price,amount:count,at});out.set(key,list);
  }
 }
 for(const [key,list] of out){const byPrice=new Map();for(const x of list){const p=byPrice.get(x.price);if(!p||p.amount<x.amount)byPrice.set(x.price,x);}out.set(key,[...byPrice.values()].sort((a,b)=>a.price-b.price));}
 return out;
}
export function listingPressure(levels,ourPrice){
 if(!Array.isArray(levels)||!levels.length)return {known:false,unitsAhead:null,risk:'sin profundidad Royal observada',penalty:1};
 const ahead=levels.filter(l=>l.price<=ourPrice).reduce((s,l)=>s+l.amount,0);
 // Penalización de prioridad, no predicción de unidades efectivamente vendidas.
 return {known:true,unitsAhead:ahead,levels:levels.length,risk:ahead>=40?'competencia alta':ahead>=12?'competencia media':'competencia baja',penalty:ahead>=40?.35:ahead>=12?.65:1};
}
