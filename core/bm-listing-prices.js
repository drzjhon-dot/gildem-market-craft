// Black Market listing-price scenario based on RECENT AODP history.
// This is an asking-price TARGET, never a live NPC bid or a guaranteed trade.
// The decision to craft must remain conditional on verifying that price in-game.
import {historyMetrics,toEpoch} from './optimizer.js';
const safe=(v,d=0)=>Number.isFinite(Number(v))?Math.max(0,Number(v)):d;
export function historicalBmListingTarget(series=[],currentBid=null,{
 now=Date.now(),days=14,minActiveDays=4,minWeekly=50,historyDiscount=.85,
 bidPremiumCap=1.40,maxAgeHours=72,maxPriceVariation=.45
}={}){
 const metric=historyMetrics(series,days,now);
 if(metric.activeDays<minActiveDays||metric.priceDays<minActiveDays||metric.count/days*7<=minWeekly||!(metric.medianPrice>0))return null;
 if(metric.priceVariation!==null&&metric.priceVariation>maxPriceVariation)return null;
 const latest=Math.max(0,...(series||[]).map(row=>toEpoch(row.timestamp)).filter(Number.isFinite));
 const ageHours=(now-latest)/3600000;
 if(!latest||ageHours<0||ageHours>maxAgeHours)return null;
 const bid=safe(currentBid?.price);
 // A high historical price is NOT proof that the NPC will buy at that price.
 // Cap uplift over a recent observed bid; when no recent bid exists, require
 // all the historical confidence checks and label it an unverified target.
 const base=Math.floor(metric.medianPrice*historyDiscount);
 const target=bid>0?Math.floor(Math.min(base,bid*bidPremiumCap)):base;
 if(!(target>0))return null;
 return {price:target,at:latest,ageHours,metric,bid:bid||null,
  reference:'historical-bm-target',provisional:true,
  warning:'Precio objetivo de orden BM derivado del historial West. NO hay comprador garantizado a este precio.'};
}
export function chooseBmListingPrice(currentBid,historicalTarget,{
 cost,units=1,taxPercent=4,setupPercent=2.5,stressSaleDrop=.08,stressMaterialRise=.07,materialsCost=0
}={}){
 const unitsPerCraft=Math.max(1,safe(units,1));
 const effective=price=>safe(price)*unitsPerCraft*(1-(safe(taxPercent)+safe(setupPercent))/100);
 const minStressCost=safe(cost)*(1+0)+safe(materialsCost)*safe(stressMaterialRise);
 if(currentBid?.price>0 && (effective(currentBid.price)*(1-safe(stressSaleDrop))-minStressCost)>0)
  return {quote:currentBid,provisional:false,source:'live-bid'};
 if(historicalTarget?.price>0 && effective(historicalTarget.price)*(1-safe(stressSaleDrop))-minStressCost>0)
  return {quote:historicalTarget,provisional:true,source:'historical-target'};
 return {quote:currentBid||null,provisional:false,source:'none'};
}
