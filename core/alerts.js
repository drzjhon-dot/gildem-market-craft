// Alertas locales, consultadas solamente cuando la web está abierta o se vuelve a abrir.
import {qualityWeightedSale} from './optimizer.js';
export function addAlertFromRoute(route,{minRoi=10,minProfit=2000}={}){
 return {id:`a-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,itemId:route.id,city:route.city,craftCity:route.craftCity,
   mode:route.mode,qualityMode:route.qualityMode||'normal',qualityWeights:route.qualityWeights||[100,0,0,0,0],buyMode:route.buyMode||'instant',buySetup:route.buySetup??.025,materials:(route.materials||[]).map(m=>({id:m.id,city:m.city,count:m.count,ret:m.ret})),
   rate:route.returnRate,tax:route.taxRate??.04,setup:route.setupRate??.025,station:route.stationCost??0,transport:route.transportCost??0,riskCost:route.expectedRiskCost??0,journal:route.journal?.prices?route.journal:null,
   minRoi:Number(minRoi),minProfit:Number(minProfit),lastTriggered:null,enabled:true};
}
export function evaluateAlert(a,pricesByItem,maxAgeHours=24,now=Date.now()){
 function get(id,city,side){const r=pricesByItem.get(id+'|'+city+'|1');const price=Number(r?.[side]);const at=Date.parse(r?.[side+'_date']||'');
  if(!(price>0)||!Number.isFinite(at)||at>now||now-at>maxAgeHours*3600000)return null;
  return {price,at};}
 const side=a.mode==='listed'?'sell_price_min':'buy_price_max';
 let sell=get(a.itemId,a.city,side);
 if(a.qualityMode==='mix'){
  const q={};for(let i=1;i<=5;i++){if(!(a.qualityWeights?.[i-1]>0))continue;
   const r=pricesByItem.get(a.itemId+'|'+a.city+'|'+i);const price=Number(r?.[side]);const at=Date.parse(r?.[side+'_date']||'');
   if(!(price>0)||!Number.isFinite(at)||at>now||now-at>maxAgeHours*3600000)return null;
   q[i]={price,at};
  }
  sell=qualityWeightedSale(q,a.qualityWeights);
 }
 if(!sell)return null;
 let gross=0,net=0;
 for(const m of a.materials){const q=get(m.id,m.city,a.buyMode==='order'?'buy_price_max':'sell_price_min');if(!q)return null;const price=q.price*(a.buyMode==='order'?1+(a.buySetup||0):1);gross+=price*m.count;net+=price*m.count*(m.ret===false?1:1-a.rate/100);}
 let journalBonus=0;
 if(a.journal){const j=a.journal;const empty=get(j.empty,j.buyCity,'sell_price_min'),full=get(j.full,j.sellCity,'buy_price_max');if(!empty||!full)return null;journalBonus=(full.price*(1-a.tax)-empty.price)*j.ratio;}
 const cost=net+Number(a.station)+Number(a.transport)+Number(a.riskCost||0),revenue=sell.price*(1-a.tax-(a.mode==='listed'?a.setup:0));const profit=revenue+journalBonus-cost;
 const roi=cost>0?profit/cost*100:0;
 return {profit,roi,sale:sell.price,cost,trigger:profit>=a.minProfit&&roi>=a.minRoi};
}
