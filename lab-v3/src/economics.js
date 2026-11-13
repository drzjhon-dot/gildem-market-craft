/**
 * Gildem 2.5 · Economía adicional del craft (solo datos observados de AODP West).
 *  - Diarios: valor neto de llenar un diario (lleno vendido − vacío comprado).
 *  - Compras: cuántos días de mercado hacen falta para comprar un material y su sobrecoste estimado.
 *  - Cotizaciones de materiales: antigüedad y precio inflado frente a su historial.
 *  - Calidades: extra esperado en Mercado Negro por piezas de calidad 2–5 (opcional).
 *  - Premium: impuesto de venta 4 % con Premium, 8 % sin Premium.
 */
import {freshestQuotes,purchaseQuote,HOUR} from './market.js';
import {bookEntry,walkAsks} from './orderbook.js';
const ROYAL_SELL=['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford','Caerleon'];
const num=x=>Number.isFinite(Number(x))?Number(x):0;

/** Impuesto de venta del juego: 4 % con Premium y 8 % sin Premium. */
export function premiumTax(premium){return premium===false?8:4;}

export const fullJournalId=emptyId=>String(emptyId||'').replace(/_EMPTY$/,'_FULL');
/**
 * Precio neto al vender un diario lleno: el mejor entre vender a una orden de compra (solo impuesto)
 * o publicar una orden de venta al precio mínimo actual (impuesto + publicación). Solo ciudades Royal.
 */
export function bestFullJournalSale(quotes,fullId,config={},now=Date.now()){
 const tax=num(config.tax)/100,listing=num(config.listingFee)/100,hours=num(config.maxQuoteHours)||48;let best=null;
 for(const city of ROYAL_SELL){
  for(const q of freshestQuotes(quotes,fullId,city,'bid',hours,now)){const net=q.price*(1-tax);if(!best||net>best.net)best={city,net,price:q.price,mode:'orden de compra',time:q.time};}
  for(const q of freshestQuotes(quotes,fullId,city,'ask',hours,now)){const net=q.price*(1-tax-listing);if(!best||net>best.net)best={city,net,price:q.price,mode:'orden de venta',time:q.time};}
 }
 return best;
}
/**
 * Valor neto por craft de los diarios que llena ese craft.
 * fractionPerCraft: parte de un diario que llena un craft (fama del craft / capacidad del diario).
 */
export function journalValue({quotes,journal,craftCity,config={},now=Date.now()}){
 if(!journal?.id||!(journal.fractional>0))return null;
 const empty=purchaseQuote(quotes,journal.id,craftCity,config,now),fullId=fullJournalId(journal.id),full=bestFullJournalSale(quotes,fullId,config,now);
 if(!empty||!full)return {id:journal.id,fullId,fractionPerCraft:journal.fractional,missing:!empty?'vacío':'lleno',valuePerCraft:0,emptyCostPerCraft:0};
 const margin=full.net-empty.landedUnitPrice;
 return {id:journal.id,fullId,name:journal.name,fractionPerCraft:journal.fractional,emptyPrice:empty.landedUnitPrice,emptyCity:empty.city,
  fullNet:full.net,fullCity:full.city,fullMode:full.mode,margin,
  valuePerCraft:Math.max(0,margin)*journal.fractional,emptyCostPerCraft:empty.landedUnitPrice*journal.fractional};
}

/**
 * Viabilidad de compra de un material en una ciudad según su historial (unidades/día y precio medio).
 * Comprar más de lo que el mercado mueve en un día obliga a subir de precio en el libro:
 * sobrecoste estimado = 5 % por cada día de mercado adicional, con tope del 25 %.
 */
export const SLIPPAGE_PER_DAY=.05,SLIPPAGE_CAP=.25,INFLATED_RATIO=1.25;
/**
 * v2.6: con libro de órdenes de la ciudad de compra, el coste se calcula recorriendo las ofertas reales.
 * Las unidades que el libro no cubre se estiman con el sobrecoste por días de mercado.
 */
export function purchaseAssessment({buy,unitPrice,history,observedAt,book=null,now=Date.now()}){
 const base=purchaseAssessmentHistory({buy,unitPrice,history,observedAt,now});
 if(!book?.length||!(buy>0))return base;
 const w=walkAsks(book,buy),covered=w.units,rest=w.remaining;
 const restPart=rest>0?purchaseAssessmentHistory({buy:rest,unitPrice:book[book.length-1][0],history,observedAt,now}):null;
 const bookExtra=w.cost-covered*num(unitPrice),restExtra=rest>0?rest*(book[book.length-1][0]-num(unitPrice))+(restPart?.extraCost||0):0;
 return {...base,book:{covered,remaining:rest,avgPrice:w.avg,depth:book.reduce((s,[,a])=>s+a,0)},
  extraCost:Math.max(0,bookExtra+restExtra),level:rest>0?(restPart?.level==='hard'?'hard':'large'):'ok',
  slippagePct:covered?Math.max(0,(w.cost/covered)/num(unitPrice)-1):base.slippagePct};
}
function purchaseAssessmentHistory({buy,unitPrice,history,observedAt,now=Date.now()}){
 const daily=num(history?.averageDailyUnits),avg=num(history?.averageUnitPrice);
 const days=daily>0?buy/daily:null;
 const slippagePct=days===null?null:Math.min(SLIPPAGE_CAP,Math.max(0,(days-1)*SLIPPAGE_PER_DAY));
 const extraCost=slippagePct===null?0:buy*num(unitPrice)*slippagePct;
 const ageHours=observedAt?Math.max(0,(now-Date.parse(observedAt))/HOUR):null;
 const priceRatio=avg>0&&unitPrice>0?unitPrice/avg:null;
 const level=days===null?'unknown':days>3?'hard':days>1?'large':'ok';
 return {marketDaily:daily||null,historyAvgPrice:avg||null,daysOfMarket:days,slippagePct,extraCost,ageHours,priceRatio,
  inflated:priceRatio!==null&&priceRatio>=INFLATED_RATIO,level};
}
export function assessPurchases(materials,historyRows,now=Date.now(),orderbook=null){
 const index=new Map((historyRows||[]).map(h=>[h.id+'|'+h.city,h]));
 return materials.map(m=>{if(m.journal||m.pending||m.manual||!(m.buy>0))return m;
  const book=orderbook?.available?bookEntry(orderbook,m.id,m.city,1,now)?.o||null:null;
  const a=purchaseAssessment({buy:m.buy,unitPrice:m.unitPrice,history:index.get(m.id+'|'+m.city),observedAt:m.observedAt,book,now});
  return {...m,purchase:a};});
}
export function purchaseSummary(materials){
 const rows=materials.filter(m=>m.purchase);
 return {extraCost:rows.reduce((s,m)=>s+m.purchase.extraCost,0),large:rows.filter(m=>m.purchase.level==='large').length,
  hard:rows.filter(m=>m.purchase.level==='hard').length,inflated:rows.filter(m=>m.purchase.inflated).length,unknown:rows.filter(m=>m.purchase.level==='unknown').length};
}

/**
 * Calidades superiores (opcional). Probabilidades de calidad aproximadas sin bono de calidad;
 * editables por el usuario. Una pieza de calidad q puede venderse a la mejor orden de calidad ≤ q.
 * Devuelve el extra esperado por unidad sobre el precio de calidad 1 usado en el plan.
 */
export const QUALITY_PROBS_DEFAULT=Object.freeze([.689,.25,.055,.005,.001]);
export function qualityBids(rows,market='Black Market',now=Date.now(),maxAgeHours=48){
 const out=new Map();
 for(const r of rows||[]){const q=Number(r.quality),city=r.city||r.location;if(city!==market||!(q>=1&&q<=5))continue;
  const price=num(r.buy_price_max),time=Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(r.buy_price_max_date||'')?r.buy_price_max_date:(r.buy_price_max_date||'')+'Z');
  if(!(price>0)||!Number.isFinite(time)||now-time>maxAgeHours*HOUR)continue;
  const key=r.item_id;const prev=out.get(key)||{};if(!prev[q]||price>prev[q])prev[q]=price;out.set(key,prev);}
 return out;
}
export function qualityExtraPerUnit(bids,basePrice,probs=QUALITY_PROBS_DEFAULT){
 if(!bids||!(basePrice>0))return 0;let best=basePrice,extra=0;
 for(let q=2;q<=5;q++){best=Math.max(best,num(bids[q-1]??0),num(bids[q]??0));extra+=num(probs[q-1])*Math.max(0,best-basePrice);}
 // Cap prudente: el extra nunca supera el 15 % del precio base.
 return Math.min(extra,basePrice*.15);
}
