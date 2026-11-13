// Market-price interpretation for ALL crafting tabs.  AODP collects market
// observations, not reserved or guaranteed executions.  Market data is never
// fetched from the external tool used as a design reference.
import {quote} from './engine.js';

export function marketQuoteSignals(priceMap,id,city,maxAgeHours=24){
 if(!priceMap||!id||!city)return {bid:null,ask:null,spreadPercent:null};
 const buy=quote(priceMap,id,city,'buy_price_max',maxAgeHours);
 const sell=quote(priceMap,id,city,'sell_price_min',maxAgeHours);
 const bid=buy?.price>0?buy.price:null;
 const ask=sell?.price>0?sell.price:null;
 const spreadPercent=bid!==null&&ask!==null?100*(ask-bid)/ask:null;
 return {bid,ask,spreadPercent,bidAgeHours:buy?.ageHours??null,
   askAgeHours:sell?.ageHours??null,bidAt:buy?.at??null,askAt:sell?.at??null};
}
export function attachMarketIntelligence(routes,priceMap,maxAgeHours=24){
 for(const route of routes||[]){
  if(route?.studyOnly||!route?.id||!route?.city)continue;
  route.marketSignals=marketQuoteSignals(priceMap,route.id,route.city,maxAgeHours);
 }
 return routes;
}
export function evaluateListingSpread(route,{strict=false}={}){
 const s=route?.marketSignals;
 if(!s||route?.mode!=='listed'||route?.city==='Black Market')return {ok:true,reason:null};
 const spread=Number(s.spreadPercent),bid=Number(s.bid),ask=Number(s.ask);
 if(!(bid>0&&ask>0&&Number.isFinite(spread)))return {ok:true,reason:null}; // no invented order
 // Crossed / badly discordant quotes are usually snapshots taken at
 // different moments; do not build a craft plan from that anomaly.
 if(spread < -20)return {ok:false,reason:'órdenes de compra y venta discordantes; verifica el mercado'};
 const personal=Number(route?.personalLearning?.qtySold)||0;
 if(personal>=3)return {ok:true,reason:null}; // own executed sale history
 const activeDays=Number(route?.activity?.activeDays)||0;
 const history=Number(route?.activity?.medianPrice)||Number(route?.activity?.avgPrice)||0;
 const aboveHistory=history>0&&route.sell>history*1.12;
 const limit=strict?65:78;
 if(spread>=limit&&(aboveHistory||activeDays<(strict?10:7)||spread>=80))return {
  ok:false,reason:'diferencial Royal demasiado grande entre publicar y vender ahora'
 };
 return {ok:true,reason:null};
}
