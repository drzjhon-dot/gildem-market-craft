// Gildem Craft Pro v9.2.0 · Top de ventas del mercado (América / West).
// La misma información que las webs de «top selling items», calculada aquí desde
// el historial público de AODP, siempre en el servidor West y conectada a los
// planes de crafteo. Son observaciones del mercado, no ventas garantizadas.
import {BRANCHES} from './branches.js';
import {toEpoch} from './optimizer.js';
const n=x=>Number.isFinite(Number(x))?Math.max(0,Number(x)):0;
const DAY=86400000;

// Top de mercado: dias UTC COMPLETOS (no mezcla un día parcialmente abierto).
// AODP ofrece historial por calidad; las calidades 1..5 son mercados distintos.
// Deduplicar registros repetidos antes de sumar evita inflar una cantidad por caché.
function utcTimestamp(value){
 if(typeof value==='number')return toEpoch(value); // respeta ticks .NET además de milisegundos
 if(typeof value!=='string')return NaN;
 const v=value.trim();
 if(/^\d+$/.test(v))return toEpoch(Number(v)); // incluye ticks .NET
 return Date.parse(/(?:Z|[+-]\d\d:?\d\d)$/.test(v)?v:v+'Z');
}
export function aggregateTopMarket(rows=[],{days=7,now=Date.now()}={}){
 const window=Math.max(1,Math.min(30,Math.floor(n(days))||7));
 const end=Math.floor(now/DAY)*DAY,start=end-window*DAY;
 const bucket=new Map(),seen=new Set();
 for(const row of rows||[]){
  const id=row?.item_id,city=row?.location||row?.city,q=Number(row?.quality??1);
  if(!id||!city||!Number.isInteger(q)||q<1||q>5||!Array.isArray(row.data))continue;
  const key=id+'|'+city;
  const entry=bucket.get(key)||{id,city,units:0,silver:0,observations:0,activeDays:new Set(),qualities:new Set()};
  for(const point of row.data){
   const at=utcTimestamp(point?.timestamp);
   if(!Number.isFinite(at)||at<start||at>=end)continue;
   const count=n(point.item_count),price=n(point.avg_price);
   if(!(count>0&&price>0))continue;
   const signature=[id,city,q,at,count,price].join('|');
   if(seen.has(signature))continue;seen.add(signature);
   entry.units+=count;entry.silver+=count*price;entry.observations++;
   entry.qualities.add(q);
   entry.activeDays.add(new Date(at).toISOString().slice(0,10));
  }
  bucket.set(key,entry);
 }
 const out=[];
 for(const e of bucket.values()){
  if(!(e.units>0))continue;
  out.push({id:e.id,city:e.city,days:window,
   dailyAmount:e.units/window,dailySilver:e.silver/window,unitPrice:e.silver/e.units,
   totalUnits:e.units,observations:e.observations,activeDays:e.activeDays.size,
   qualities:[...e.qualities].sort((a,b)=>a-b),periodStart:new Date(start).toISOString().slice(0,10),periodEnd:new Date(end-DAY).toISOString().slice(0,10)});
 }
 return out;
}

// El ranking NO es una lista de recetas: también debe consultar IDs conocidos
// que no tengan materiales descargados. Solo genera IDs desde catálogos reales.
// La selección reparte cupos por rama y tier, priorizando .0 y .1 sin ocultar
// un tier entero detrás de cientos de variantes de otro.
export function topMarketCatalogIds(recipes={},names={},branchKeys=[],{limit=450}={}){
 const universe=[...new Set([...Object.keys(recipes||{}),...Object.keys(names||{})])];
 const chosen=branchKeys.map(key=>BRANCHES.find(b=>b.key===key)).filter(Boolean);
 const lists=chosen.map(b=>{
  const records=[];
  for(const id of universe){
   const m=id.match(/^T([2-8])_([A-Z0-9_]+)(?:@([1-4]))?$/);
   if(!m)continue;
   const tier=Number(m[1]);
   const matches=b.test(id)||(tier===3&&b.test(id.replace(/^T3_/,'T4_')));
   if(!matches)continue;
   records.push({id,tier,ench:Number(m[3]||0)});
  }
  records.sort((a,b)=>a.ench-b.ench||a.tier-b.tier||a.id.localeCompare(b.id));
  return records.map(x=>x.id);
 });
 const result=[],seen=new Set(),cap=Math.max(1,Math.floor(n(limit))||450);
 for(let pos=0;result.length<cap&&lists.some(list=>pos<list.length);pos++){
  for(const list of lists){const id=list[pos];if(!id||seen.has(id))continue;
   seen.add(id);result.push(id);if(result.length>=cap)break;
  }
 }
 return {ids:result,available:[...new Set(lists.flat())].length,truncated:result.length<[...new Set(lists.flat())].length};
}

export const TOP_SORTS=Object.freeze({
 silver:{label:'Silver por día',field:'dailySilver'},
 amount:{label:'Unidades por día',field:'dailyAmount'},
 price:{label:'Precio por unidad',field:'unitPrice'}
});
export function rankTopMarket(entries=[],{sortBy='silver',limit=60,cities=null,minDaily=0}={}){
 const field=(TOP_SORTS[sortBy]||TOP_SORTS.silver).field;
 const allowed=cities&&cities.length?new Set(cities):null;
 return (entries||[])
  .filter(e=>(!allowed||allowed.has(e.city))&&e.dailyAmount>=n(minDaily))
  .sort((a,b)=>n(b[field])-n(a[field])||n(b.dailySilver)-n(a.dailySilver))
  .slice(0,Math.max(1,Math.floor(n(limit))||60));
}

// Rama concreta (no agregada) a la que pertenece un objeto, para saltar al plan.
const aggregate=key=>key==='weapons_all'||String(key).endsWith('_all')||key==='gather_tools';
export function branchForItem(id){
 for(const b of BRANCHES){
  if(aggregate(b.key))continue;
  try{if(b.test(id))return {key:b.key,label:b.label,market:b.market==='royal'?'royal':'black'};}catch{}
 }
 const fallback=BRANCHES.find(b=>{try{return b.test(id);}catch{return false;}});
 return fallback?{key:fallback.key,label:fallback.label,market:fallback.market==='royal'?'royal':'black'}:null;
}
