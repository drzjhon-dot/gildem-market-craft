// Normalización de niveles de órdenes observadas (AODP), procedente de la idea
// del planificador v6. Nunca se deriva un volumen de órdenes solo del mejor bid.
import {saturationLoss} from './market-impact.js';
const priceNumber=value=>Number(value)||0;
export function parsedTime(value){if(!value||value==='0001-01-01T00:00:00')return NaN;const s=String(value);const ms=Date.parse(/[Zz]$|[+-]\d\d:\d\d$/.test(s)?s:s+'Z');return Number.isFinite(ms)?ms:NaN;}
export function normalizeOrderbook(raw,ids=[],cities=[],maxAgeHours=24,now=Date.now()){
 const idsAllowed=new Set(ids),citiesAllowed=new Set(cities);const out=new Map();
 const rows=Array.isArray(raw)?raw:Array.isArray(raw?.data)?raw.data:Array.isArray(raw?.rows)?raw.rows:Array.isArray(raw?.items)?raw.items:Array.isArray(raw?.results)?raw.results:[];
 const buySides=new Set(['buy','buyorder','buy_order','bids','bid','1']);
 for(const r of rows){
  if(!r||typeof r!=='object')continue;
  const id=r.item_id||r.itemId||r.id;
  const city=r.location||r.city||r.city_name;
  if(!idsAllowed.has(id)||!citiesAllowed.has(city)||Number(r.quality??r.quality_level??1)!==1)continue;
  function add(entry,sideForced){
   const side=String(sideForced??entry.side??entry.order_type??entry.type??'').toLowerCase().replaceAll(' ','');
   if(!buySides.has(side))return;
   const qty=Number(entry.amount??entry.quantity??entry.count??entry.item_count??entry.volume??entry.total_amount);
   const price=Number(entry.price??entry.unit_price??entry.price_per_unit);
   const date=entry.updated_at||entry.date||entry.timestamp||r.updated_at||r.date||r.timestamp;
   const at=parsedTime(date),age=(now-at)/3600000;
   if(!(Number.isSafeInteger(qty)&&qty>0&&price>0&&Number.isFinite(at)&&age>=0&&age<=maxAgeHours))return;
   const key=id+'|'+city;const list=out.get(key)||[];list.push({price,amount:qty,at,date});out.set(key,list);
  }
  let nested=false;
  for(const [side,entries] of [['buy',r.buy_orders],['buy',r.buyOrders],['buy',r.bids],['buy',r.buy]]){
   if(Array.isArray(entries)){nested=true;for(const entry of entries)add(entry,side);}
  }
  if(Array.isArray(r.orders)){nested=true;for(const entry of r.orders)add(entry);}
  if(!nested)add(r);
 }
 for(const [key,rows] of out){const levels=new Map();for(const x of rows){const prev=levels.get(x.price);if(!prev||x.amount>prev.amount)levels.set(x.price,x);}
  out.set(key,[...levels.values()].sort((a,b)=>b.price-a.price));}
 return out;
}
export function executeLevels(levels,quantity,taxPercent=2.5){
 let remain=Math.max(0,Math.floor(quantity)),gross=0,filled=0;
 for(const l of levels||[]){if(remain===0)break;const n=Math.min(remain,Math.floor(l.amount));if(n<1)continue;gross+=n*l.price;filled+=n;remain-=n;}
 return {filled,gross,net:gross*(1-priceNumber(taxPercent)/100),complete:remain===0};
}
export function profitableBookCapacity(levels,{costPerItem,taxPercent=2.5,craftAmount=1}={}){
 const netFactor=1-priceNumber(taxPercent)/100;let units=0;
 for(const l of levels||[]){if(!(l.price*netFactor>costPerItem))break;units+=l.amount;}
 return Math.floor(units/Math.max(1,craftAmount));
}
export function routeProfitAtQuantity(route,crafts){
 if(!(crafts>0))return 0;
 if(!route.depthVerified||!route.orderLevels?.length)return route.profit*crafts-saturationLoss(route,crafts);
 const amount=route.craftAmount||1,units=crafts*amount;
 const book=executeLevels(route.orderLevels,units,route.saleTaxPercent);
 if(!book.complete)return null;
 // La diferencia de ingreso sustituye el mejor precio fijo por la ejecución
 // ponderada; todos los demás costos del crafting permanecen iguales.
 const reference=route.sell*units*(1-route.saleTaxPercent/100);
 return crafts*route.profit+(book.net-reference);
}
export function enrichWithDepth(candidate,levels){
 const craftAmount=Math.max(1,candidate.craftAmount||1);
 if(!levels?.length||candidate.mode!=='instant'||candidate.qualityMode==='mix')return {...candidate,depthVerified:false,marketCapacity:candidate.mode==='instant'&&candidate.city==='Black Market'?1:null,bookCoverage:candidate.mode==='listed'?'Orden propia pendiente de comprador':'Sin profundidad verificada'};
 const tax=candidate.saleTaxPercent;
 // La ganancia incremental de cada nivel toma como base el profit del candidato.
 const perItemCost=(candidate.sell*(1-tax/100)-candidate.profit/craftAmount);
 const cap=profitableBookCapacity(levels,{costPerItem:perItemCost,taxPercent:tax,craftAmount});
 return {...candidate,depthVerified:true,orderLevels:levels,marketCapacity:cap,craftAmount,
  bookCoverage:levels.reduce((s,x)=>s+x.amount,0)+' unidades en órdenes observadas',
  bookDate:new Date(Math.min(...levels.map(x=>x.at))).toISOString()};
}
