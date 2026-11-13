// Gildem Craft Pro v9.5.0 · Craft Cal. — calculadora de crafteo por lotes.
// Mismas reglas que el motor de planes: retorno con bono de ciudad y Focus
// (craftingReturnRate) y comisiones de Ajustes. Precios de AODP (West): se usa la
// última cotización vista aunque sea antigua (marcando su edad) y cualquier precio
// puede corregirse a mano; lo que no existe queda vacío, nunca se inventa.
import {craftProfit,craftingReturnRate,CITIES} from './engine.js';
import {journalInfo} from './journals.js';
import {craftingFameFromRecipe} from './level-craft.js';
import {branchForItem} from './top-market.js';
import {itemStem} from './item-selection.js';
const n=x=>Number.isFinite(Number(x))?Math.max(0,Number(x)):0;
const HOUR=3600000;

// Índice de cotizaciones del endpoint /stats/prices. No descarta las antiguas:
// guarda la mejor cotización por ciudad con su antigüedad y marca `stale` cuando
// supera la ventana pedida.
export function quoteIndex(rows=[],{maxAgeHours=24,now=Date.now()}={}){
 const map=new Map();
 const ageOf=at=>{const t=Date.parse(at);return Number.isFinite(t)?Math.max(0,(now-t)/HOUR):null;};
 for(const r of rows||[]){
  if(Number(r?.quality||1)!==1)continue;
  const id=r?.item_id,city=r?.city||r?.location;
  if(!id||!city)continue;
  const e=map.get(id)||{ask:new Map(),bm:null};
  const ask=n(r.sell_price_min),bid=n(r.buy_price_max);
  if(city==='Black Market'){
   const age=ageOf(r.buy_price_max_date);
   if(bid>0&&age!==null){
    const cand={price:bid,at:r.buy_price_max_date,ageHours:age,stale:age>maxAgeHours};
    const cur=e.bm;
    // preferencia: fresca sobre antigua; a igual frescura, la puja más alta.
    if(!cur||(cur.stale&&!cand.stale)||(cur.stale===cand.stale&&cand.price>cur.price))e.bm=cand;
   }
  }else if(CITIES.includes(city)&&ask>0){
   const age=ageOf(r.sell_price_min_date);
   if(age!==null)e.ask.set(city,{price:ask,at:r.sell_price_min_date,ageHours:age,stale:age>maxAgeHours});
  }
  map.set(id,e);
 }
 return map;
}
const pickAsk=(quotes,id,better)=>{
 const e=quotes.get(id);if(!e)return null;
 let best=null;
 for(const [city,q] of e.ask){
  const cand={...q,city};
  if(!best||(best.stale&&!cand.stale)||(best.stale===cand.stale&&better(cand,best)))best=cand;
 }
 return best;
};
const cheapestAsk=(quotes,id)=>pickAsk(quotes,id,(a,b)=>a.price<b.price);
const highestAsk=(quotes,id)=>pickAsk(quotes,id,(a,b)=>a.price>b.price);

// ── Variantes de tier y encantamiento ───────────────────────────────────────
export function variantId(id,tier,ench){
 const stem=itemStem(id);
 if(!stem)return null;
 return `T${Math.max(1,Math.min(8,Math.floor(n(tier))||4))}_${stem}`+(n(ench)>0?'@'+Math.min(4,Math.floor(n(ench))):'');
}
export function availableTiers(recipes,id){
 const out=[];
 for(let t=4;t<=8;t++){const stem=itemStem(id);if(!stem)break;
  if([0,1,2,3,4].some(e=>recipes[variantId(id,t,e)]?.materials?.length))out.push(t);}
 return out;
}
export function availableEnchants(recipes,id,tier){
 const t=n(tier)||Number(String(id).match(/^T([1-8])_/)?.[1])||4;
 return [0,1,2,3,4].filter(e=>recipes[variantId(id,t,e)]?.materials?.length);
}

// Calcula un lote. items: [{id, qty, noBonus}]. `noBonus` = craftear fuera de la
// ciudad con bono de esa receta (sin el 15 % de especialidad; a veces compensa
// por logística o por las tasas de la estación). Nunca se rinde por falta de cotización:
// un material sin precio entra a 0, se lista en missingPrices y la fila queda
// marcada como incompleta hasta que el usuario escriba el precio.
export function calcBatch(items=[],{recipes={},quotes=new Map(),journalLookup=()=>null,
 premium=true,focus=false,dailyBonus=0,tax=4,setup=2.5,stationFee=0,maxAgeHours=24,overrides={}}={}){
 const over={buy:overrides?.buy||{},sellBM:overrides?.sellBM||{},sellRoyal:overrides?.sellRoyal||{}};
 const buyPrice=id=>n(over.buy[id])>0?{price:n(over.buy[id]),city:'Manual',manual:true,ageHours:0,stale:false}:cheapestAsk(quotes,id);
 const taxRate=n(tax)/100,setupRate=n(setup)/100;
 const rows=[],materials=new Map(),journals=new Map();
 for(const item of items||[]){
  const id=item?.id,qty=Math.max(0,Math.floor(n(item?.qty)));
  if(!id||!qty)continue;
  const recipe=recipes[id];
  if(!recipe?.materials?.length){rows.push({id,qty,ok:false,reason:'Sin receta cargada para este objeto.'});continue;}
  const noBonus=item?.noBonus===true;
  const specialty=!!recipe.city&&!noBonus&&recipe.specialtyEnabled!==false;
  const rate=craftingReturnRate({specialty,dailyBonus,focus}).returnRate;
  // Coste material a material; un precio ausente cuenta como 0 y se señala.
  const parts=[];let netCost=0,rawCost=0,oldest=0;const missingPrices=[];
  for(const m of recipe.materials){
   const q=buyPrice(m.id);
   const price=q?n(q.price):0;
   if(!(price>0))missingPrices.push(m.id);
   else if(!q.manual)oldest=Math.max(oldest,q.ageHours||0);
   const refunded=m.ret===false?0:Math.min(m.count*rate/100,Number.isFinite(m.maxReturn)?m.maxReturn:Infinity);
   const used=m.count-refunded;
   netCost+=used*price;rawCost+=m.count*price;
   parts.push({id:m.id,count:m.count,returned:refunded,used,unitPrice:price,city:q?.city||null,
    manual:!!q?.manual,stale:!!q?.stale,ageHours:q?.ageHours??null,ret:m.ret!==false,cost:used*price});
  }
  const cost={materials:parts,materialCost:netCost,rawMaterials:rawCost,total:netCost+n(stationFee),stationFee:n(stationFee)};
  const incomplete=missingPrices.length>0;
  // v9.10 · Salida por craft del juego (@amountcrafted): pociones y comida dan 5–10 por craft.
  const amount=Math.max(1,n(recipe.amountCrafted)||n(recipe.amount)||1);
  const bmManual=n(over.sellBM[id])>0,royalManual=n(over.sellRoyal[id])>0;
  const bmQuote=quotes.get(id)?.bm||null;
  const bm=bmManual?n(over.sellBM[id]):(bmQuote?.price||0);
  const royal=royalManual?{price:n(over.sellRoyal[id]),city:'Manual',stale:false}:highestAsk(quotes,id);
  const profitBM=!incomplete&&bm>0?craftProfit(cost,bm*amount,{tax:taxRate,mode:'instant'}):null;
  const profitRoyal=!incomplete&&royal?craftProfit(cost,royal.price*amount,{tax:taxRate,setup:setupRate,mode:'listed'}):null;
  const fame=craftingFameFromRecipe(id,recipe,{premium});
  const branch=branchForItem(id);
  const journal=journalInfo(id,recipe,branch?.key||'',journalLookup(id));
  const journalsPerCraft=journal?.ratio>0?journal.ratio:0;
  rows.push({id,qty,ok:true,incomplete,missingPrices,priceAgeHours:oldest,craftCity:recipe.city||null,noBonus,specialty,returnRate:rate,amount,
   unitCost:cost.total,totalCost:cost.total*qty,rawPerCraft:cost.rawMaterials,
   bmBid:bm>0?bm:null,bmManual,bmStale:!!bmQuote?.stale&&!bmManual,
   royalAsk:royal?.price||null,royalCity:royal?.city||null,royalManual,royalStale:!!royal?.stale&&!royalManual,
   profitBM:profitBM?profitBM.profit*qty:null,profitRoyal:profitRoyal?profitRoyal.profit*qty:null,
   famePerCraft:fame?.value||0,fameTotal:(fame?.value||0)*qty,fameEstimated:!!fame?.estimated,
   journalsNeeded:journalsPerCraft*qty,journalEmpty:journal?.empty||null});
  for(const m of cost.materials){
   const key=m.id+'|'+(m.city||'');
   const e=materials.get(key)||{id:m.id,city:m.city||null,manual:m.manual,stale:m.stale,ageHours:m.ageHours,missing:!(m.unitPrice>0),gross:0,used:0,lastReturn:0,unitPrice:m.unitPrice,usedBy:new Set()};
   e.gross+=m.count*qty;e.used+=m.used*qty;e.lastReturn=Math.max(e.lastReturn,m.returned||0);
   e.unitPrice=Math.max(e.unitPrice,n(m.unitPrice));e.usedBy.add(id);
   materials.set(key,e);
  }
  if(journalsPerCraft>0&&journal?.empty){
   const e=journals.get(journal.empty)||{empty:journal.empty,name:journal.name||journal.code,tier:journal.tier,needed:0,exact:journal.exact,usedBy:new Set()};
   e.needed+=journalsPerCraft*qty;e.exact=e.exact&&journal.exact;e.usedBy.add(id);
   journals.set(journal.empty,e);
  }
 }
 // v9.8.0 · «A comprar» tiene en cuenta el retorno: los recursos devueltos por la
 // estación se reutilizan mientras crafteas, así que se compra el consumo neto.
 // El bruto de la receta queda como referencia (es lo que pasa por tus manos).
 const materialList=[...materials.values()].map(m=>{
  // v9.10 · El retorno del ÚLTIMO craft ya no se reutiliza: se compra el neto + el
  // retorno de un craft (nunca más que el bruto). Antes faltaba material al final del lote.
  const gross=Math.ceil(m.gross-1e-9),buy=Math.min(gross,Math.ceil(m.used+m.lastReturn-1e-9));
  return {...m,usedBy:[...m.usedBy].sort(),gross,buy,reused:Math.max(0,gross-buy),
   spare:Math.max(0,gross-buy),buyCost:buy*m.unitPrice,grossCost:gross*m.unitPrice,netCost:m.used*m.unitPrice};
 });
 const journalList=[...journals.values()].map(j=>{
  const price=buyPrice(j.empty);
  const count=Math.ceil(j.needed-1e-9);
  return {...j,usedBy:[...j.usedBy].sort(),count,manual:!!price?.manual,stale:!!price?.stale,unitPrice:price?.price||null,buyCity:price?.city||null,
   totalCost:price?count*price.price:null};
 });
 const ok=rows.filter(r=>r.ok);
 const totals={
  crafts:ok.reduce((a,r)=>a+r.qty,0),
  netCost:ok.reduce((a,r)=>a+r.totalCost,0),
  buyCapital:materialList.reduce((a,m)=>a+m.buyCost,0),
  grossCapital:materialList.reduce((a,m)=>a+m.grossCost,0),
  journalCost:journalList.reduce((a,j)=>a+(j.totalCost||0),0),
  profitBM:ok.some(r=>r.profitBM!=null)?ok.reduce((a,r)=>a+(r.profitBM??0),0):null,
  profitRoyal:ok.some(r=>r.profitRoyal!=null)?ok.reduce((a,r)=>a+(r.profitRoyal??0),0):null,
  bmMissing:ok.filter(r=>r.profitBM===null).length,
  royalMissing:ok.filter(r=>r.profitRoyal===null).length,
  incomplete:ok.filter(r=>r.incomplete).length,
  missingPriceIds:[...new Set(ok.flatMap(r=>r.missingPrices))],
  oldestAgeHours:Math.max(0,...ok.map(r=>r.priceAgeHours||0)),
  fame:ok.reduce((a,r)=>a+r.fameTotal,0)
 };
 return {rows,materials:materialList.sort((a,b)=>b.grossCost-a.grossCost),journals:journalList,totals};
}

// IDs cuyo precio hay que pedir a AODP para calcular un lote.
export function calcPriceIds(items=[],recipes={},journalLookup=()=>null){
 const ids=new Set();
 for(const item of items||[]){
  const id=item?.id;const recipe=recipes[id];
  if(!id||!recipe?.materials?.length)continue;
  ids.add(id);
  for(const m of recipe.materials)ids.add(m.id);
  const branch=branchForItem(id);
  const j=journalInfo(id,recipe,branch?.key||'',journalLookup(id));
  if(j?.empty)ids.add(j.empty);
 }
 return [...ids];
}
