// Shared procurement guard for Black Craft and Royal Craft.
// Limits initial purchasing to a modest fraction of HISTORIC trades.
// It does NOT claim those items are currently offered at the quoted ask.
import {purchaseComponents} from './refining-integration.js';
import {prudentDailyVolume} from './market-volume.js';
const n=x=>Number.isFinite(Number(x))?Math.max(0,Number(x)):0;
const key=m=>m.id+'|'+m.city;
export function limitRowsByMaterialVolume(rows, historyByMaterial=new Map(), {
  fraction=.08, unknownCraftCap=1, maxPurchasePriceToMedian=1.20, days=1, cutOnPriceAlert=true
}={}) {
  // v9.1.0 · `days` reparte la compra a lo largo de la ventana de venta: un lote que
  // se vende en 14 días puede comprarse en varios días, no en uno solo.
  const window=Math.max(1,Math.min(30,n(days)||1));
  const unknownCap=unknownCraftCap===Infinity?Infinity:Math.max(0,Math.floor(n(unknownCraftCap)));
  const present=new Map();
  for (const row of rows||[]) {
    for (const mat of row.materials||[]) for (const part of purchaseComponents(mat)) {
      if (!(part?.id && part?.city && n(part.count)>0)) continue;
      const k=key(part), prev=present.get(k)||{id:part.id,city:part.city,unitPrice:0};
      prev.unitPrice=Math.max(prev.unitPrice,n(part.originalPrice)||n(part.unitPrice));
      present.set(k,prev);
    }
  }
  const limits=new Map(),unverified=[],priceAlerts=[];
  for(const [k,m] of present){
    const h=historyByMaterial.get(k);
    const daily=prudentDailyVolume(h?.d14,h?.d7);
    // Four observed days keeps a single trade from becoming a firm capacity.
    if(daily===null||!(h?.d14?.activeDays>=4)) {unverified.push(m);continue;}
    limits.set(k,Math.floor(daily*window*Math.max(0,Math.min(.25,n(fraction)))));
    const median=n(h?.d14?.medianPrice);
    if(median>0&&m.unitPrice>median*maxPurchasePriceToMedian)
      priceAlerts.push({...m,medianPrice:median,premiumPercent:100*(m.unitPrice/median-1)});
  }
  const result=(rows||[]).map(r=>({...r}));
  const sorted=result.map((row,i)=>({row,i})).sort((a,b)=>
    (n(b.row.profit)/Math.max(1,n(b.row.capitalPerUnit)))-(n(a.row.profit)/Math.max(1,n(a.row.capitalPerUnit))));
  const changed=[];
  for(const {row} of sorted){
    const parts=new Map();
    for(const mat of row.materials||[])for(const item of purchaseComponents(mat)){
      if(!(item?.id&&item?.city&&n(item.count)>0))continue;
      const k=key(item);parts.set(k,(parts.get(k)||0)+n(item.count));
    }
    const before=Math.max(0,Math.floor(n(row.qty)));
    let allowed=before;
    for(const [k,count] of parts){
      if(limits.has(k)) allowed=Math.min(allowed,Math.floor((limits.get(k)+1e-9)/count));
      else if(unverified.some(x=>key(x)===k))allowed=Math.min(allowed,unknownCap);
    }
    const suspicious=priceAlerts.some(p=>parts.has(key(p)));
    if(suspicious&&cutOnPriceAlert)allowed=Math.min(allowed,1);
    row.qty=Math.max(0,Math.min(before,allowed));
    for(const [k,count] of parts)if(limits.has(k))limits.set(k,Math.max(0,limits.get(k)-row.qty*count));
    if(row.qty!==before)changed.push({id:row.id,city:row.city,from:before,to:row.qty});
  }
  return {rows:result,changed,unverified,priceAlerts,verified:present.size-unverified.length,
    checked:present.size,remaining:limits};
}

// Executable purchase-depth guard. Material book levels are observed, not reserved.
// Only count offers AT or BELOW the unit price budgeted by the recipe.
export function limitRowsByMaterialBook(rows,sellLevels=new Map(),{
  fraction=.60,unknownCraftCap=1,priceCeilingByMaterial=new Map()
}={}){
 const safeFraction=Math.max(0,Math.min(1,Number(fraction)||0));
 const limits=new Map(),visible=[],missing=[],rejected=[];
 const required=new Map();
 for(const row of rows||[])for(const material of row.materials||[])for(const part of purchaseComponents(material)){
  if(!(part?.id&&part?.city&&n(part.count)>0))continue;
  const k=key(part),old=required.get(k)||{id:part.id,city:part.city,unitPrice:Infinity};
  old.unitPrice=Math.min(old.unitPrice,n(part.originalPrice)||n(part.unitPrice)||Infinity);
  required.set(k,old);
 }
 for(const [k,m] of required){
  const book=sellLevels.get(k);
  if(!book?.length){missing.push(m);continue;}
  const ceiling=Math.max(m.unitPrice,n(priceCeilingByMaterial.get(k))||0);
  const cheap=book.filter(level=>Number(level.price)>0&&level.price<=ceiling+1e-7).reduce((sum,level)=>sum+n(level.amount),0);
  const max=Math.floor(cheap*safeFraction);
  limits.set(k,max);
  visible.push({...m,available:cheap,max});
 }
 const out=(rows||[]).map(r=>({...r}));
 const sorted=[...out].sort((a,b)=>
  (n(b.profit)/Math.max(1,n(b.capitalPerUnit)))-(n(a.profit)/Math.max(1,n(a.capitalPerUnit))));
 for(const row of sorted){
  const parts=new Map();
  for(const m of row.materials||[])for(const part of purchaseComponents(m)){
   if(!(part?.id&&part?.city&&n(part.count)>0))continue;
   const k=key(part);parts.set(k,(parts.get(k)||0)+n(part.count));
  }
  const prev=Math.floor(n(row.qty));let allowance=prev;
  for(const [k,count] of parts){
   if(limits.has(k))allowance=Math.min(allowance,Math.floor(limits.get(k)/count+1e-9));
   else allowance=Math.min(allowance,Math.floor(n(unknownCraftCap)));
  }
  row.qty=Math.max(0,allowance);
  for(const [k,count] of parts)if(limits.has(k))limits.set(k,Math.max(0,limits.get(k)-row.qty*count));
  if(row.qty<prev)rejected.push({id:row.id,from:prev,to:row.qty,city:row.city});
 }
 return {rows:out,visible,missing,rejected,checked:required.size};
}
