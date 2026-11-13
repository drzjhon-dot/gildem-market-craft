/**
 * Gildem 2.6 · Libro de órdenes de AODP West (resumen publicado por el recolector de GitHub Actions).
 * Formato por shard: { "ITEM|Ciudad|Calidad": { r:[[precio,cantidad]...] compras desc, o:[[precio,cantidad]...] ventas asc,
 *   s: última vez visto (segundos), f:{r,o,d} unidades vendidas detectadas en los últimos días } }
 * Solo describe órdenes VISTAS por jugadores con el cliente de datos: ausencia de órdenes no significa ausencia de mercado.
 */
import {variant} from './branches.js';
const HOUR=3600_000;
export const BOOK_MAX_AGE_HOURS=24;
const shardOf=id=>{const v=variant(id);return v?.tier?'T'+v.tier:'other';};
let config=null,metaCache=null;const shardCache=new Map();
/** Base del resumen: /orderbook.config.json (lo genera la compilación en Netlify a partir del repositorio). */
export async function orderbookBase(fetcher=fetch){
 if(config)return config.base||null;
 try{const r=await fetcher('/orderbook.config.json',{cache:'no-store'});config=r.ok?await r.json():{};}catch{config={};}
 return config.base||null;
}
export async function loadOrderbook(ids,{fetcher=fetch,now=Date.now()}={}){
 const base=await orderbookBase(fetcher);if(!base)return {available:false,reason:'sin configurar',books:new Map(),meta:null};
 try{
  if(!metaCache||now-metaCache.at>10*60_000){const r=await fetcher(`${base}/ob/meta.json`,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);metaCache={at:now,meta:await r.json()};}
  const meta=metaCache.meta,wanted=[...new Set(ids.map(shardOf))].filter(s=>meta.shards?.[s]);const books=new Map();
  for(const s of wanted){let entry=shardCache.get(s);
   if(!entry||now-entry.at>10*60_000||entry.generatedAt!==meta.generatedAt){const r=await fetcher(`${base}/ob/${s}.json`,{cache:'no-store'});if(!r.ok)continue;entry={at:now,generatedAt:meta.generatedAt,data:await r.json()};shardCache.set(s,entry);}
   for(const [k,v] of Object.entries(entry.data))books.set(k,v);}
  const ageHours=(now-Date.parse(meta.generatedAt))/HOUR;
  return {available:true,meta,ageHours,books};
 }catch(e){return {available:false,reason:e.message,books:new Map(),meta:null};}
}
/** Entrada del libro para artículo/ciudad/calidad, solo si se vio en las últimas BOOK_MAX_AGE_HOURS horas. */
export function bookEntry(ob,id,city,quality=1,now=Date.now()){
 const e=ob?.books?.get(`${id}|${city}|${quality}`);if(!e)return null;
 const age=e.s?(now/1000-e.s)/3600:null;if(age!==null&&age>BOOK_MAX_AGE_HOURS)return null;
 return {...e,ageHours:age};
}
/** Ofertas de venta de cualquier calidad en una ciudad (compiten con tu publicación Q1 si están más baratas). */
export function offersAnyQuality(ob,id,city,now=Date.now()){
 const all=[];for(let q=1;q<=5;q++){const e=bookEntry(ob,id,city,q,now);if(e?.o)all.push(...e.o);}return all.sort((a,b)=>a[0]-b[0]);
}
/** Vender N unidades a órdenes de compra (precio desc). Devuelve unidades cubiertas e ingreso bruto (antes de impuestos). */
export function walkBids(levels,units,priceCap=Infinity){
 let left=units,revenue=0;for(const [p,a] of levels||[]){if(left<=0)break;const take=Math.min(left,a);revenue+=take*Math.min(p,priceCap);left-=take;}
 return {units:units-Math.max(0,left),revenue,remaining:Math.max(0,left)};
}
/** Comprar N unidades a órdenes de venta (precio asc). */
export function walkAsks(levels,units){
 let left=units,cost=0;for(const [p,a] of levels||[]){if(left<=0)break;const take=Math.min(left,a);cost+=take*p;left-=take;}
 return {units:units-Math.max(0,left),cost,remaining:Math.max(0,left),avg:units-left>0?cost/(units-left):null};
}
export const depthUnits=(levels,minPrice=0)=>(levels||[]).filter(([p])=>p>=minPrice).reduce((s,[,a])=>s+a,0);
export const unitsBelow=(levels,maxPrice)=>(levels||[]).filter(([p])=>p<=maxPrice).reduce((s,[,a])=>s+a,0);
