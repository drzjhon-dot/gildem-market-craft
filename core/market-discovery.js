// v8.5.6. Auditable market discovery, across the seven Royal markets and BM.
// Uses AODP per-item observations; NEVER asserts every observed order is a sale.
import {itemTier,itemEnch,quote} from './engine.js';
import {historyMetrics} from './optimizer.js';
const safeInt=x=>Number.isFinite(Number(x))?Math.max(0,Math.floor(Number(x))):0;
export function coverageByMarket(itemIds,priceMap,{cities=[],maxAge=24,history=null}={}){
 const ids=[...new Set(itemIds||[])];const markets=[];
 for(const city of [...new Set(cities)]){
  let bidItems=0,askItems=0,activeItems=0,observedQty14=0,ageMax=null;const activityLeaders=[];
  for(const id of ids){
   const bid=quote(priceMap,id,city,'buy_price_max',maxAge);
   const ask=quote(priceMap,id,city,'sell_price_min',maxAge);
   if(bid){bidItems++;ageMax=Math.max(ageMax??0,bid.ageHours);}
   if(ask){askItems++;ageMax=Math.max(ageMax??0,ask.ageHours);}
   const series=history?.get(id+'|'+city)||[];
   if(series.length){const hist=historyMetrics(series,14);if(hist.observations>0){activeItems++;observedQty14+=hist.count;activityLeaders.push({id,count:hist.count,daily:hist.observedDaily,activeDays:hist.activeDays,medianPrice:hist.medianPrice});}}
  }
  markets.push({city,bidItems,askItems,activeItems,observedQty14,ageMax,leaders:activityLeaders.sort((a,b)=>b.count-a.count).slice(0,4)});
 }
 return {items:ids.length,markets,source:'AODP',historyLoaded:!!history};
}
export function diagnoseScan({recipes=0,candidates=0,viable=null,recommendations=0,missing=null}={}){
 const reasons=(viable?.reasons||[]).map(x=>({reason:x.reason,count:x.count}));
 const m=missing||{};
 return {recipes:safeInt(recipes),candidates:safeInt(candidates),viable:safeInt(viable?.accepted?.length),recommendations:safeInt(recommendations),
  missingMaterials:safeInt(m.material),missingSales:safeInt(m.sale),missingFocus:safeInt(m.focus),reasons:reasons.slice(0,8)};
}
// When a single craft branch grows beyond API constraints, research multiple
// tiers/enchantments instead of taking only the highest theoretical ROI.
export function marketResearchIds(candidates,{maxItems=320}={}){
 const ids=new Map();
 for(const c of candidates||[]){if(!c?.id)continue;
  const score=Math.max(0,Number(c.profit)||0)/Math.max(1,Number(c.capitalPerUnit)||1);
  ids.set(c.id,Math.max(ids.get(c.id)||0,score));
 }
 const ranked=[...ids.keys()].sort((a,b)=>(ids.get(b)||0)-(ids.get(a)||0));
 if(ranked.length<=maxItems)return ranked;
 const lanes=new Map();
 for(const id of ranked){const key=itemTier(id); // Diversify tiers before picking more enchantment variants.
  const bucket=lanes.get(key)||[];bucket.push(id);lanes.set(key,bucket);}
 const out=[],groups=[...lanes.values()];let pass=0;
 while(out.length<maxItems){let count=0;for(const group of groups){if(group[pass]){out.push(group[pass]);count++;if(out.length>=maxItems)break;}}if(!count)break;pass++;}
 return out;
}

// Always investigate a representative slice of the requested branch even if
// no recipe currently has positive theoretical profit. An empty plan should
// not be mistaken for an inactive market. This is research, NOT guaranteed sales.
export function marketAuditIds(allSelectedIds,profitIds,{maxItems=250,maxExtra=70}={}){
 const selected=[...new Set(allSelectedIds||[])],preferred=[...new Set(profitIds||[])].slice(0,maxItems);
 const result=[...preferred],seen=new Set(preferred);
 const samples=marketResearchIds(selected.map(id=>({id,profit:1,capitalPerUnit:1})),{maxItems:Math.min(selected.length,maxExtra,maxItems)});
 for(const id of samples){if(result.length>=maxItems)break;if(!seen.has(id)){result.push(id);seen.add(id);}}
 return result;
}
