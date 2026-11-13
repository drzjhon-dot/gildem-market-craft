// v9.11 · Importación del CSV de «Trades» del Albion Free Market Data Client
// (github.com/JPCodeCraft/AlbionDataAvalonia → Trades → Export CSV).
// Columnas: Server, Player, Received, Type, Operation, Quality, Item, Location,
//           Full Location, Amount, Unit Silver, Total Silver, Order Amount
// El separador y el decimal dependen del idioma de Windows (",", ";" o tabulador).
// «Item» es el nombre en inglés + «[tier.encantamiento]». Las órdenes caducadas sin
// llenar vienen con Amount 0 (pagaron la tasa de publicación).
// Solo se registran VENTAS reales en carteras marcadas como compradas: nunca se inventan.
const QUALITY={normal:1,good:2,outstanding:3,excellent:4,masterpiece:5};
const MARKETS=['Black Market','Bridgewatch','Caerleon','Fort Sterling','Lymhurst','Martlock','Thetford','Brecilien'];

/** Parser CSV con comillas ("a;b" y comillas dobles escapadas). */
export function parseCsv(text,delimiter){
 const rows=[];let row=[],cell='',q=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(q){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else q=false;}else cell+=c;continue;}
  if(c==='"'){q=true;continue;}
  if(c===delimiter){row.push(cell);cell='';continue;}
  if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);cell='';if(row.some(x=>x!==''))rows.push(row);row=[];continue;}
  cell+=c;}
 row.push(cell);if(row.some(x=>x!==''))rows.push(row);
 return rows;
}
export function detectDelimiter(header){
 const counts=[',',';','\t'].map(d=>[d,header.split(d).length]);counts.sort((a,b)=>b[1]-a[1]);return counts[0][0];
}
function number(raw,decimal){
 let s=String(raw||'').trim().replace(/\s| /g,'');if(!s)return null;
 if(decimal===',')s=s.replace(/\./g,'').replace(',','.');else s=s.replace(/,/g,'');
 const n=Number(s);return Number.isFinite(n)?n:null;
}
/** Fecha según el idioma del PC: «auto» decide día/mes mirando todas las filas. */
export function parseDate(raw,order='dmy'){
 const s=String(raw||'').trim();const iso=Date.parse(s);
 if(/^\d{4}-\d{2}-\d{2}/.test(s)&&Number.isFinite(iso))return iso;
 const m=s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})[ T,]*(\d{1,2})?:?(\d{2})?:?(\d{2})?\s*([AaPp]\.?\s?[Mm]\.?)?/);
 if(!m)return Number.isFinite(iso)?iso:null;
 let [a,b]=[Number(m[1]),Number(m[2])];const day=order==='mdy'?b:a,month=order==='mdy'?a:b;
 let year=Number(m[3]);if(year<100)year+=2000;let hour=Number(m[4]||0);const min=Number(m[5]||0),sec=Number(m[6]||0);
 const ampm=(m[7]||'').toLowerCase().replace(/[.\s]/g,'');if(ampm==='pm'&&hour<12)hour+=12;if(ampm==='am'&&hour===12)hour=0;
 if(month<1||month>12||day<1||day>31)return null;
 return new Date(year,month-1,day,hour,min,sec).getTime();
}
function dateOrderFor(values){
 let dmy=false,mdy=false;for(const v of values){const m=String(v).match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-]/);if(!m)continue;if(Number(m[1])>12)dmy=true;if(Number(m[2])>12)mdy=true;}
 return mdy&&!dmy?'mdy':'dmy';
}
export function normalizeMarket(raw){
 const s=String(raw||'').trim();if(!s)return null;
 const hit=MARKETS.find(m=>s.toLowerCase().startsWith(m.toLowerCase()));if(hit)return hit;
 if(/black\s*market/i.test(s))return 'Black Market';return s;
}
/** «Adept's Broadsword [4.1]» → T4_MAIN_SWORD@1 (con el mapa de nombres en inglés). */
export function resolveItemId(name,namesEn){
 const s=String(name||'').trim();if(/^T[1-8]_[A-Z0-9_]+(@[1-4])?$/.test(s))return s;
 const m=s.match(/^(.*?)\s*\[(\d)\.(\d)\]\s*$/);const base=(m?m[1]:s).trim(),ench=m?Number(m[3]):0;
 const id=namesEn?.[base];if(!id)return null;
 if(!ench)return id;
 if(/_LEVEL\d$/.test(id))return `${id}@${ench}`;
 return `${id}@${ench}`;
}
/**
 * @returns {trades,skipped,servers,dateOrder}
 */
export function parseAfmTradesCsv(text,{namesEn={},dateOrder='auto'}={}){
 const clean=String(text||'').replace(/^﻿/,'');const firstLine=clean.split(/\r?\n/)[0]||'';
 const delimiter=detectDelimiter(firstLine);const rows=parseCsv(clean,delimiter);
 if(!rows.length)throw Error('El archivo está vacío.');
 const head=rows[0].map(x=>x.trim().toLowerCase());
 const col=name=>head.indexOf(name);
 const need=['received','operation','item','location','amount','unit silver'];
 const missing=need.filter(n=>col(n)<0);
 if(missing.length)throw Error('No parece el CSV de Trades del AFM Data Client (faltan columnas: '+missing.join(', ')+').');
 const decimal=delimiter===';'?',':'.';
 const order=dateOrder==='auto'?dateOrderFor(rows.slice(1).map(r=>r[col('received')])):dateOrder;
 const trades=[],skipped=[],servers=new Set();
 rows.slice(1).forEach((r,i)=>{const line=i+2,get=n=>col(n)>=0?(r[col(n)]??'').trim():'';
  const server=get('server');if(server)servers.add(server);
  const op=get('operation').toLowerCase(),type=get('type').toLowerCase();
  const at=parseDate(get('received'),order),amount=number(get('amount'),decimal),unit=number(get('unit silver'),decimal),orderAmount=number(get('order amount'),decimal);
  const id=resolveItemId(get('item'),namesEn),market=normalizeMarket(get('location'));
  const quality=QUALITY[get('quality').toLowerCase()]||1;
  if(!['buy','sell'].includes(op))return skipped.push({line,reason:'Operación desconocida'});
  if(!id)return skipped.push({line,reason:`Objeto no reconocido: ${get('item')}`});
  if(!market)return skipped.push({line,reason:'Sin mercado'});
  if(at==null)return skipped.push({line,reason:`Fecha no reconocida: ${get('received')}`});
  if(!(amount>=0))return skipped.push({line,reason:'Cantidad inválida'});
  const t={line,server,player:get('player'),at,type:type==='order'?'order':type==='instant'?'instant':'unknown',op,quality,id,market,amount,unit:unit||0,
   orderAmount:orderAmount??null,expired:amount===0};
  t.signature=[t.server,t.player,t.at,t.type,t.op,t.quality,t.id,t.market,t.amount,t.unit,t.orderAmount].join('|');
  trades.push(t);});
 return {trades,skipped,servers:[...servers],dateOrder:order,delimiter};
}
/** Resumen de tus ventas y compras reales por objeto y mercado. */
export function summarizeTrades(trades){
 const map=new Map();
 for(const t of trades){const k=t.id+'|'+t.market+'|'+t.op;const o=map.get(k)||{id:t.id,market:t.market,op:t.op,units:0,silver:0,trades:0,orders:0,orderUnits:0,expiredOrders:0,first:t.at,last:t.at,qualities:new Set()};
  if(t.expired){o.expiredOrders++;}else{o.units+=t.amount;o.silver+=t.amount*t.unit;o.trades++;}
  if(t.type==='order'&&t.orderAmount>0){o.orders++;o.orderUnits+=t.orderAmount;o.orderFilled=(o.orderFilled||0)+t.amount;}
  o.first=Math.min(o.first,t.at);o.last=Math.max(o.last,t.at);o.qualities.add(t.quality);map.set(k,o);}
 return [...map.values()].map(o=>({...o,qualities:[...o.qualities].sort(),avgPrice:o.units?o.silver/o.units:null,
  fillRate:o.orderUnits?Math.min(1,(o.orderFilled||0)/o.orderUnits):null,days:Math.max(1,(o.last-o.first)/86400000)})).sort((a,b)=>b.silver-a.silver);
}
/**
 * Registra las ventas reales en los lotes de carteras ya compradas (mismo objeto y mercado,
 * fecha posterior a la compra). Cada operación se importa una sola vez (firma guardada).
 */
export function applyTradesToPortfolios(portfolios,trades,{recordSale}){
 const out=(portfolios||[]).map(p=>structuredClone(p));const report={recorded:0,units:0,duplicates:0,unmatched:0,lots:new Set()};
 const used=new Set(out.flatMap(p=>p.importedTrades||[]));
 for(const t of [...trades].filter(x=>x.op==='sell'&&!x.expired&&x.amount>0).sort((a,b)=>a.at-b.at)){
  if(used.has(t.signature)){report.duplicates++;continue;}
  let left=t.amount,matched=false;
  for(const p of out){if(p.started!==true)continue;const start=Date.parse(p.startedAt||p.createdAt||'');if(Number.isFinite(start)&&t.at<start)continue;
   for(const lot of p.lots||[]){if(left<=0)break;if(lot.id!==t.id||lot.market!==t.market)continue;
    const sold=(lot.sales||[]).reduce((s,x)=>s+Number(x.qty),0),room=lot.qty-sold;if(room<=0)continue;
    const qty=Math.min(room,left),gross=qty*t.unit;
    const fees=gross*(Number(lot.feesRate)||0)+(t.type==='order'?gross*(Number(lot.setupRate)||0):0);
    const next=recordSale(p,lot.lotId,{qty,price:t.unit,fees:Math.round(fees),transport:0,at:new Date(t.at).toISOString()});
    Object.assign(p,next);left-=qty;matched=true;report.recorded++;report.units+=qty;report.lots.add(p.id+'|'+lot.lotId);}
   if(left<=0)break;}
  if(matched){for(const p of out)if(p.lots?.some(l=>l.id===t.id&&l.market===t.market)){p.importedTrades=[...(p.importedTrades||[]),t.signature];break;}used.add(t.signature);}
  else report.unmatched++;
 }
 return {portfolios:out,report:{...report,lots:report.lots.size}};
}
