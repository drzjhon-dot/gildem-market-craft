// Demand-first discovery for BOTH Black Market and Royal markets.
// Historical market counts are a liquidity signal, not committed orders or guaranteed sales.
import {historyMetrics} from './optimizer.js';
import {diversifiedRecipeIds} from './craft-plan-controls.js';
import {effectiveDaily} from './market-impact.js';

const finite=x=>Number.isFinite(Number(x))?Math.max(0,Number(x)):0;
const key=(id,city)=>`${id}|${city}`;
export const DEFAULT_HORIZON_DAYS=14;
export function demandHistoryIndex(rows=[]){
 const series=new Map(),seen=new Map();
 for(const r of rows||[]){
  if(Number(r.quality??1)!==1||!r.item_id)continue;
  const city=r.location||r.city;
  if(!city)continue;
  const k=key(r.item_id,city);
  const arr=series.get(k)||[];
  const keys=seen.get(k)||new Set();
  for(const row of (Array.isArray(r.data)?r.data:[])){
   // Duplicate API rows are not independent trading activity. Preserve distinct
   // observations and markets, but do not count an identical day twice.
   const signature=[row.timestamp,row.item_count,row.avg_price].join('|');
   if(keys.has(signature))continue;
   keys.add(signature);arr.push(row);
  }
  seen.set(k,keys);series.set(k,arr);
 }
 return series;
}
export function discoverDemand(ids=[],series=new Map(),cities=['Black Market'],now=Date.now()){
 const byMarket=new Map(),leaders=[];
 for(const id of [...new Set(ids||[])])for(const city of cities){
  const observations=series.get(key(id,city))||[];
  const a14=historyMetrics(observations,14,now);
  const a7=historyMetrics(observations,7,now);
  const a30=historyMetrics(observations,30,now);
  const daysCovered=a14.activeDays;
  // The 30-day window rescues intermittent observed history without treating
  // missing days as proof of zero demand. Never create a number from no records.
  const daily=a14.observations>0?a14.observedDaily:a30.observations>0?a30.observedDaily:null;
  const hit={id,city,daily,observed14:a14.count,observed30:a30.count,activeDays:daysCovered,activity:a14,activity7:a7,activity30:a30,source:'AODP · historial',verified:daily!==null};
  byMarket.set(key(id,city),hit);
  if(daily!==null&&daily>0)leaders.push(hit);
 }
 leaders.sort((a,b)=>b.daily-a.daily||b.observed14-a.observed14);
 return {byMarket,leaders};
}
// A full 14-day demand scan must cover the chosen recipes, including .0,
// rather than only the variants with the highest price-based ROI.
export function chosenDemandIds(ids,limit=900){
 const unique=[...new Set(ids||[])];
 if(unique.length<=limit)return unique;
 // No dedicar el cupo completo a T4/T5 .0: una muestra equilibrada
 // contiene primero representantes de CADA tier y encantamiento elegido.
 const chosen=diversifiedRecipeIds(unique,{limit:Math.max(1,Math.floor(limit))});
 return chosen;
}

export function listingCapacity(route,{horizonDays=DEFAULT_HORIZON_DAYS,share=.06,maxPerRoute=6000,unknownCap=1}={}){
 if(!route)return 0;
 if(route.city==='Black Market'&&route.mode==='instant')return route.depthVerified?Math.max(0,Math.floor(finite(route.marketCapacity))):0;
 if(Number.isFinite(route?.hardMarketCapacity))return Math.max(0,Math.floor(route.hardMarketCapacity));
 const effective=effectiveDaily(route);
 if(effective===null)return Math.max(0,Math.min(2,Math.floor(unknownCap)));
 if(!effective)return 0;
 const days=Math.min(30,Math.max(1,finite(horizonDays)||14));
 const shareCap=Math.min(.35,Math.max(.005,finite(share)));
 const products=Math.max(1,finite(route.craftAmount)||1);
 // Only a slice of observed turnover, spread over the selected selling window.
 let cap=Math.max(1,Math.floor(effective*days*shareCap/products));
 // Competition affects exposure but isn't a blanket one-unit veto on busy items.
 if(route.competition?.known&&finite(route.competition.unitsAhead)>effective*days*.5)cap=Math.max(1,Math.floor(cap*.5));
 if(route.ageHours>24||(Number.isFinite(route.confidence?.score)&&route.confidence.score<45))cap=Math.max(1,Math.floor(cap*.5));
 // User-pasted market reports are less independently verifiable; halve
 // exposure and always mark the purchase plan as provisional.
 if(route.externalDemand)cap=Math.max(1,Math.floor(cap*.5));
 return Math.min(Math.max(1,Math.floor(maxPerRoute)),cap);
}
export function demandExplanation(route,{horizonDays=14,share=.06}={}){
 const day=route?.demandDaily??(route?.activity?.observations>0?route.activity.observedDaily:null);
 const max=listingCapacity(route,{horizonDays,share,maxPerRoute:6000});
 if(day===null)return {daily:null,max,reason:'Sin historial suficiente: exposición provisional, no demanda confirmada',source:'No verificada'};
 return {daily:day,max,reason:`Límite indicativo: ${Math.round(share*100)}% de la actividad observada durante ${horizonDays} días`,source:route.demandSource||'AODP · historial'};
}
