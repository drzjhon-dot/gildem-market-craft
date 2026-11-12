/**
 * Gildem · Núcleo del recolector del libro de órdenes de AODP West.
 * Funciones puras (sin red) para que se puedan probar: normalizar, fusionar, medir ventas, podar y resumir.
 *
 * Mensaje de AODP (albiondata-client, lib/market.go): MarketOrder {Id, ItemTypeId, LocationId, QualityLevel,
 * EnchantmentLevel, UnitPriceSilver, Amount, AuctionType ("offer" = venta, "request" = compra), Expires}.
 * El juego envía UnitPriceSilver multiplicado por 10.000; se detecta la escala con las propias órdenes.
 */
export const LOCATIONS=Object.freeze({'3003':'Black Market','2004':'Bridgewatch','5003':'Brecilien','3005':'Caerleon','4002':'Fort Sterling','1002':'Lymhurst','3008':'Martlock','7':'Thetford'});
const HOUR=3600_000,DAY=86400_000;
export const MAX_UNSEEN_MS=72*HOUR;      // una orden no vista en 72 h se descarta
export const BOOK_FRESH_MS=48*HOUR;      // el resumen solo incluye órdenes vistas en 48 h
export const FILL_DAYS=7;                // ventas medidas en los últimos 7 días
export const LEVELS=15;                  // niveles de precio por lado en el resumen
const validItem=id=>typeof id==='string'&&/^[A-Z0-9_@-]{3,100}$/.test(id);

export function cityOf(locationId){
 const raw=String(locationId??'').trim();if(!raw||raw.includes('@'))return null;
 const base=raw.split('-')[0];if(!/^\d+$/.test(base))return null;
 return LOCATIONS[String(Number(base))]||null;
}
/** Escala del precio: si casi todas las órdenes son múltiplos de 10.000, vienen en unidades del juego (×10.000). */
export function detectScale(orders){
 const prices=orders.map(o=>Number(o?.UnitPriceSilver)).filter(p=>Number.isFinite(p)&&p>0);
 if(prices.length<20)return null;
 const multiples=prices.filter(p=>p%10000===0).length/prices.length;
 return multiples>=.95?10000:1;
}
export function flattenMessage(msg){
 if(!msg||typeof msg!=='object')return [];
 if(Array.isArray(msg))return msg.flatMap(flattenMessage);
 if(Array.isArray(msg.Orders))return msg.Orders;
 if(msg.ItemTypeId)return [msg];
 return [];
}
/** Orden compacta: [item, ciudad, calidad, precio, cantidad, tipo 'o'|'r', expiraMs, primeraVez, últimaVez] */
export function normalizeOrder(o,scale,now){
 const item=o?.ItemTypeId,city=cityOf(o?.LocationId),q=Number(o?.QualityLevel),amount=Number(o?.Amount),raw=Number(o?.UnitPriceSilver);
 const type=o?.AuctionType==='offer'?'o':o?.AuctionType==='request'?'r':null;
 if(!validItem(item)||!city||!type||!(q>=1&&q<=5)||!(amount>0)||!(raw>0)||!Number.isFinite(Number(o?.Id)))return null;
 const price=raw/(scale||1);if(!(price>=1)||price>1e10)return null;
 const exp=Date.parse(o?.Expires&&!/[zZ]|[+-]\d{2}:?\d{2}$/.test(o.Expires)?o.Expires+'Z':o?.Expires);
 return {id:String(o.Id),row:[item,city,q,Math.round(price),Math.round(amount),type,Number.isFinite(exp)?exp:now+30*DAY,now,now]};
}
export function emptyState(){return {v:1,scale:null,orders:{},fills:{},updatedAt:null,runs:0};}
const fillKey=(row)=>`${row[0]}|${row[1]}|${row[2]}|${row[5]}`;
const dayIndex=t=>Math.floor(t/DAY);
/**
 * Fusiona órdenes vistas. Si una orden ya conocida reaparece con MENOS cantidad, la diferencia
 * se vendió (orden de compra: el mercado compró; orden de venta: alguien compró). Es una venta segura,
 * a diferencia de una orden que desaparece (puede haberse cancelado o simplemente no haberse vuelto a ver).
 */
export function mergeOrders(state,normalized,now){
 let added=0,updated=0,filledUnits=0;
 for(const n of normalized){if(!n)continue;const prev=state.orders[n.id];
  if(!prev){state.orders[n.id]=n.row;added++;continue;}
  const before=prev[4],after=n.row[4];
  if(after<before&&prev[3]===n.row[3]){const sold=before-after;filledUnits+=sold;
   const key=fillKey(prev),d=dayIndex(now),list=state.fills[key]||[];
   const last=list[list.length-1];if(last&&last[0]===d)last[1]+=sold;else list.push([d,sold]);state.fills[key]=list;}
  state.orders[n.id]=[...n.row.slice(0,7),prev[7],now];updated++;
 }
 return {added,updated,filledUnits};
}
export function pruneState(state,now){
 let removed=0;
 for(const [id,row] of Object.entries(state.orders)){if(row[6]<=now||now-row[8]>MAX_UNSEEN_MS){delete state.orders[id];removed++;}}
 const minDay=dayIndex(now)-FILL_DAYS+1;
 for(const [k,list] of Object.entries(state.fills)){const kept=list.filter(x=>x[0]>=minDay);if(kept.length)state.fills[k]=kept;else delete state.fills[k];}
 return removed;
}
export const shardOf=item=>{const m=/^T([1-8])_/.exec(item);return m?'T'+m[1]:'other';};
/**
 * Resumen por shard (tier): para cada artículo|ciudad|calidad, niveles de precio agregados.
 *  r: órdenes de compra (precio desc) · o: órdenes de venta (precio asc) · s: última vez visto (s) ·
 *  f: unidades vendidas en 7 días {r: a órdenes de compra, o: de órdenes de venta} y días con datos.
 */
export function buildShards(state,now){
 const books=new Map();
 for(const row of Object.values(state.orders)){
  if(row[6]<=now||now-row[8]>BOOK_FRESH_MS)continue;
  const key=`${row[0]}|${row[1]}|${row[2]}`;let b=books.get(key);
  if(!b){b={r:new Map(),o:new Map(),s:0};books.set(key,b);}
  const side=row[5]==='r'?b.r:b.o;side.set(row[3],(side.get(row[3])||0)+row[4]);b.s=Math.max(b.s,row[8]);
 }
 for(const [k,list] of Object.entries(state.fills)){const [item,city,q,type]=k.split('|');const key=`${item}|${city}|${q}`;
  let b=books.get(key);if(!b){b={r:new Map(),o:new Map(),s:0};books.set(key,b);}
  b.f=b.f||{r:0,o:0,d:0};b.f[type]+=list.reduce((a,x)=>a+x[1],0);b.f.d=Math.max(b.f.d,list.length);}
 const shards={};let entries=0;
 for(const [key,b] of books){const item=key.split('|')[0],shard=shardOf(item);
  const r=[...b.r].sort((a,c)=>c[0]-a[0]).slice(0,LEVELS),o=[...b.o].sort((a,c)=>a[0]-c[0]).slice(0,LEVELS);
  if(!r.length&&!o.length&&!b.f)continue;
  (shards[shard]||(shards[shard]={}))[key]={...(r.length?{r}:{}),...(o.length?{o}:{}),...(b.s?{s:Math.round(b.s/1000)}:{}),...(b.f?{f:b.f}:{})};entries++;}
 const meta={v:1,generatedAt:new Date(now).toISOString(),entries,orders:Object.keys(state.orders).length,
  shards:Object.fromEntries(Object.entries(shards).map(([k,v])=>[k,Object.keys(v).length])),freshHours:BOOK_FRESH_MS/HOUR,fillDays:FILL_DAYS,
  source:'AODP West · NATS marketorders.deduped (Gildem collector)'};
 return {meta,shards};
}
