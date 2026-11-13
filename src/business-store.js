// Mi negocio (v4.0) · almacenamiento local de inversiones y ventas reales.
// Los datos viven solo en este navegador (localStorage). Exportar/Importar JSON para copias.
const KEY='gildem-business-v1';
const MAX_TRADES=6000;
const finite=x=>Number.isFinite(Number(x))?Number(x):0;
const uid=p=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

export function emptyBusiness(){return {version:1,portfolios:[],trades:[],lastImport:null};}
export function sanitizeBusiness(x){
 const b=emptyBusiness();if(!x||typeof x!=='object')return b;
 b.portfolios=(Array.isArray(x.portfolios)?x.portfolios:[]).filter(p=>p&&Array.isArray(p.lots)).map(p=>({
  id:String(p.id||uid('p')),title:String(p.title||'Inversión').slice(0,120),source:String(p.source||'manual').slice(0,40),createdAt:p.createdAt||new Date().toISOString(),
  started:p.started===true,startedAt:p.startedAt||null,closed:p.closed===true,importedTrades:Array.isArray(p.importedTrades)?p.importedTrades.slice(-MAX_TRADES):[],
  lots:p.lots.filter(l=>l&&/^[A-Z0-9_@-]{3,100}$/.test(String(l.id))).map((l,i)=>({lotId:String(l.lotId||'lot-'+i),id:String(l.id),market:String(l.market||''),craftCity:l.craftCity?String(l.craftCity):null,
   qty:Math.max(0,Math.trunc(finite(l.qty))),unitCost:Math.max(0,finite(l.unitCost)),costSource:String(l.costSource||'estimado'),capitalPerUnit:Math.max(0,finite(l.capitalPerUnit??l.unitCost)),
   expectedPrice:Math.max(0,finite(l.expectedPrice)),expectedProfit:finite(l.expectedProfit),feesRate:Math.max(0,finite(l.feesRate)),setupRate:Math.max(0,finite(l.setupRate)),freightPerUnit:Math.max(0,finite(l.freightPerUnit)),
   sales:(Array.isArray(l.sales)?l.sales:[]).filter(s=>finite(s.qty)>0).map(s=>({qty:Math.trunc(finite(s.qty)),price:finite(s.price),fees:finite(s.fees),transport:finite(s.transport),at:s.at||null,source:s.source||'manual'}))}))}));
 b.trades=(Array.isArray(x.trades)?x.trades:[]).filter(t=>t&&t.id&&t.market).slice(-MAX_TRADES);
 b.lastImport=x.lastImport||null;return b;
}
export function loadBusiness(storage=globalThis.localStorage){
 try{return sanitizeBusiness(JSON.parse(storage?.getItem(KEY)||'null'));}catch{return emptyBusiness();}
}
export function saveBusiness(b,storage=globalThis.localStorage){
 try{storage?.setItem(KEY,JSON.stringify(sanitizeBusiness(b)));return true;}catch{return false;}
}
/** Lote genérico → lote de cartera. Tasa: impuesto de venta + tasa de publicar (solo Royal con orden). */
export function makeLot({id,market,craftCity=null,units,unitCost,expectedPrice,tax=4,listingFee=2.5,costSource='estimado del plan'},i=0){
 const royalOrder=market&&market!=='Black Market';
 return {lotId:'lot-'+i,id,market,craftCity,qty:Math.max(0,Math.round(finite(units))),unitCost:Math.max(0,finite(unitCost)),costSource,capitalPerUnit:Math.max(0,finite(unitCost)),
  expectedPrice:Math.max(0,finite(expectedPrice)),expectedProfit:finite(expectedPrice)*(1-finite(tax)/100-(royalOrder?finite(listingFee)/100:0))-finite(unitCost),
  feesRate:finite(tax)/100,setupRate:royalOrder?finite(listingFee)/100:0,freightPerUnit:0,sales:[]};
}
export function createPortfolio({title,source='manual',lots}){
 const clean=(lots||[]).filter(l=>l&&l.qty>0);if(!clean.length)throw Error('El plan no tiene unidades para registrar.');
 return {id:uid('p'),title:String(title||'Inversión').slice(0,120),source,createdAt:new Date().toISOString(),started:false,startedAt:null,closed:false,importedTrades:[],lots:clean.map((l,i)=>({...l,lotId:'lot-'+i}))};
}
/** Filas del Craft Planner (Motor 3.0) → lotes. */
export function lotsFromPlanner(rows=[],{tax=4,listingFee=2.5}={}){
 return rows.map((r,i)=>{const per=Math.max(1,Math.trunc(finite(r.craftAmount)||1)),units=Math.max(0,Math.trunc(finite(r.qty)))*per;
  return makeLot({id:r.id,market:r.city,craftCity:r.craftCity,units,unitCost:finite(r.grossCapitalPerCraft)/per,expectedPrice:finite(r.planningPrice),tax,listingFee},i);});
}
/** Plan Mercado Negro → lotes (venta instantánea: sin tasa de publicar). */
export function lotsFromBmPlan(result){
 const tax=finite(result?.config?.tax)||4;
 return (result?.rows||[]).map((r,i)=>makeLot({id:r.id,market:'Black Market',units:r.units,unitCost:r.units?r.capital/r.units:0,expectedPrice:r.price,tax,listingFee:0},i));
}
