// Precios, oro y alertas (v4.0) · lógica sin interfaz.
export const MARKETS=['Black Market','Caerleon','Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford','Brecilien'];
const num=x=>Number.isFinite(Number(x))?Number(x):0;
export const fold=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();

/** Busca por nombre en español o ID. Devuelve IDs base (sin encantamiento) ordenados por relevancia. */
export function searchItems(names,query,{limit=12}={}){
 const q=fold(query).trim();if(q.length<2)return [];
 const words=q.split(/\s+/).filter(Boolean),out=[];
 for(const [id,label] of Object.entries(names||{})){if(id.includes('@'))continue;
  const hay=fold(label)+' '+id.toLowerCase();if(!words.every(w=>hay.includes(w)))continue;
  const l=fold(label);out.push({id,name:label,score:(l.startsWith(q)?0:l.includes(q)?1:2)+id.length/1000});}
 return out.sort((a,b)=>a.score-b.score).slice(0,limit);
}
export const withEnchant=(id,ench)=>Number(ench)>0?`${id.replace(/@\d$/,'')}@${Number(ench)}`:id.replace(/@\d$/,'');

/** Tabla de precios por mercado a partir del mapa de cotizaciones (quoteMap). */
export function priceBoard(quotes,id,{now=Date.now(),maxAgeHours=24,markets=MARKETS}={}){
 const rows=markets.map(city=>{const q=quotes?.get?.(id+'|'+city)||{};
  const age=x=>x?.time?(now-x.time)/3600e3:null;
  const ask=q.ask?.price>0?{price:q.ask.price,ageH:age(q.ask)}:null,bid=q.bid?.price>0?{price:q.bid.price,ageH:age(q.bid)}:null;
  return {city,ask,bid,askFresh:!!ask&&ask.ageH<=maxAgeHours,bidFresh:!!bid&&bid.ageH<=maxAgeHours};});
 const buys=rows.filter(r=>r.askFresh&&r.city!=='Black Market').sort((a,b)=>a.ask.price-b.ask.price);
 const sells=rows.filter(r=>r.bidFresh).sort((a,b)=>b.bid.price-a.bid.price);
 return {rows,bestBuy:buys[0]||null,bestInstantSell:sells[0]||null};
}
/** Historial AODP crudo → serie diaria por mercado (precio medio y unidades). */
export function historySeries(raw=[],id){
 const by=new Map();
 for(const r of raw){if((r.item_id||r.itemId)!==id)continue;const city=r.location;const m=by.get(city)||new Map();
  for(const d of r.data||[]){const day=String(d.timestamp||'').slice(0,10);if(!day)continue;const e=m.get(day)||{day,units:0,silver:0};
   e.units+=num(d.item_count);e.silver+=num(d.item_count)*num(d.avg_price);m.set(day,e);}
  by.set(city,m);}
 const out={};
 for(const [city,m] of by){const days=[...m.values()].sort((a,b)=>a.day.localeCompare(b.day)).map(e=>({day:e.day,units:e.units,price:e.units?e.silver/e.units:null}));
  const units=days.reduce((s,d)=>s+d.units,0),silver=days.reduce((s,d)=>s+d.units*(d.price||0),0);
  out[city]={days,dailyUnits:days.length?units/days.length:0,avgPrice:units?silver/units:null};}
 return out;
}
/** Oro (AODP /stats/gold): [{price,timestamp}] → resumen. */
export function goldSummary(rows=[],{now=Date.now()}={}){
 const pts=rows.map(r=>({price:num(r.price),time:Date.parse(String(r.timestamp).replace(/(?<!Z)$/,'Z'))})).filter(p=>p.price>0&&Number.isFinite(p.time)).sort((a,b)=>a.time-b.time);
 if(!pts.length)return null;
 const last=pts.at(-1),dayAgo=pts.filter(p=>p.time<=last.time-20*3600e3).at(-1)||pts[0];
 const prices=pts.map(p=>p.price);
 return {latest:last.price,at:last.time,ageH:(now-last.time)/3600e3,change24h:dayAgo?last.price-dayAgo.price:0,changePct:dayAgo?.price?100*(last.price-dayAgo.price)/dayAgo.price:0,
  min:Math.min(...prices),max:Math.max(...prices),avg:prices.reduce((a,b)=>a+b,0)/prices.length,points:pts};
}
/** Polilínea SVG simple (sin dependencias). */
export function sparkline(values,{width=120,height=28,stroke='currentColor'}={}){
 const v=values.filter(x=>Number.isFinite(x));if(v.length<2)return '';
 const min=Math.min(...v),max=Math.max(...v),span=max-min||1;
 const pts=v.map((x,i)=>`${(i*(width-2)/(v.length-1)+1).toFixed(1)},${(height-1-(x-min)*(height-2)/span).toFixed(1)}`).join(' ');
 return `<svg class="spark" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true"><polyline fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round" points="${pts}"/></svg>`;
}

// ── Alertas ───────────────────────────────────────────────
export const ALERT_KINDS={bidAtLeast:'paga (orden de compra) ≥',askAtMost:'se vende (orden de venta) ≤'};
export function makeAlert({itemId,city,kind,price}){
 if(!/^[A-Z0-9_@-]{3,100}$/.test(itemId||''))throw Error('Elige un objeto.');
 if(!MARKETS.includes(city))throw Error('Mercado no válido.');
 if(!ALERT_KINDS[kind])throw Error('Condición no válida.');
 if(!(Number(price)>0))throw Error('Escribe un precio.');
 if(kind==='askAtMost'&&city==='Black Market')throw Error('El Mercado Negro no vende: usa «paga ≥».');
 return {id:`al-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,itemId,city,kind,price:Number(price),active:true,createdAt:new Date().toISOString(),lastHit:null,lastSeen:null};
}
/** Devuelve las alertas que se cumplen con cotizaciones recientes. */
export function checkAlerts(alerts,quotes,{now=Date.now(),maxAgeHours=6}={}){
 const hits=[];
 for(const a of alerts||[]){if(!a.active)continue;const q=quotes?.get?.(a.itemId+'|'+a.city);
  const side=a.kind==='bidAtLeast'?q?.bid:q?.ask;if(!side?.price||now-side.time>maxAgeHours*3600e3)continue;
  const ok=a.kind==='bidAtLeast'?side.price>=a.price:side.price<=a.price;
  if(ok)hits.push({alert:a,price:side.price,ageH:(now-side.time)/3600e3});}
 return hits;
}
