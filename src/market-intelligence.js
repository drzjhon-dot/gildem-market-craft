/**
 * Gildem Market Intelligence: auditable Top → Planner evidence bridge.
 * AODP History reflects sell-order observations, not guaranteed executed sales.
 * Demand for Q1 crafted items MUST be based on Q1 history; never apply Q2–5 units to Q1.
 */
import {variant,BRANCH_BY_KEY} from './branches.js';
import {utcRange} from './market.js';

const safeId=id=>typeof id==='string'&&/^[A-Z0-9_@-]{3,100}$/.test(id);
const safeNum=x=>Number.isFinite(Number(x))&&Number(x)>=0?Number(x):0;
export const marketKey=(id,city)=>`${id}|${city}`;
export const observedWindow=(days,now=Date.now())=>{const r=utcRange(days,now);return {from:r.date,to:new Date(r.end-86400000).toISOString().slice(0,10),days:r.days};};
export function captureMarketSignals(rows=[],marks=new Set(),prior=[],capturedAt=new Date().toISOString()){
 const result=new Map((prior||[]).filter(x=>safeId(x?.id)&&typeof x?.city==='string').map(x=>[marketKey(x.id,x.city),x]));
 for(const row of rows){if(!safeId(row?.id)||!marks.has(marketKey(row.id,row.city)))continue;
 const days=Math.max(1,Number(row.days)||7);
 result.set(marketKey(row.id,row.city),{
  id:row.id,city:row.city,from:row.from||null,to:row.to||null,days,
  allDaily:safeNum(row.averageDailyUnits),q1Daily:safeNum(row.quality1DailyUnits),
  allActiveDays:safeNum(row.activeDays),q1ActiveDays:safeNum(row.quality1ActiveDays),
  allAvgPrice:safeNum(row.averageUnitPrice),q1AvgPrice:safeNum(row.quality1AveragePrice),
  latestObservation:row.latestObservation||null,capturedAt,
  // only carry source evidence; no constructed orders, prices or future sales
  source:'AODP History · Top Mercado'
 });
 }
 return [...result.values()].slice(0,300);
}
export function catalogItemMatches({ids=[],names={},branchKeys=[],search='',selectedOnly=false,selectedIds=[],maxResults=72}={}){
 const branches=branchKeys.map(k=>BRANCH_BY_KEY.get(k)).filter(Boolean);
 const chosen=new Set(selectedIds);
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const q=norm(search);
 const matches=[];
 for(const id of ids){if(!safeId(id)||!variant(id)||!branches.some(b=>b.test(id)))continue;
  if(selectedOnly&&!chosen.has(id))continue;
  if(q&&!norm(id).includes(q)&&!norm(names[id]).includes(q))continue;
  matches.push(id);
 }
 matches.sort((a,b)=>Number(chosen.has(b))-Number(chosen.has(a))||Number(names[a]===undefined)-Number(names[b]===undefined)||a.localeCompare(b));
 return {ids:matches.slice(0,maxResults),total:matches.length,showing:Math.min(matches.length,maxResults)};
}
export function reconcileMarketEvidence({snapshots=[],queried=[],ids=[],markets=[],days=7,now=Date.now()}={}){
 const window=observedWindow(days,now),included=new Set(ids),destinations=new Set(markets),out=new Map(),discrepancies=[];
 // Fresh data is only applicable when it describes exactly the same complete UTC days.
 for(const h of queried){if(!included.has(h.id)||!destinations.has(h.city))continue;
  if(h.from!==window.from||h.to!==window.to)continue;
  out.set(marketKey(h.id,h.city),{...h,evidenceSource:'Destinos · consulta Q1',snapshotMatch:false});
 }
 let fromTop=0;
 for(const s of snapshots){if(!included.has(s.id)||!destinations.has(s.city))continue;
  if(s.from!==window.from||s.to!==window.to||s.days!==window.days)continue;
  const key=marketKey(s.id,s.city),other=out.get(key);
  const top={id:s.id,city:s.city,days:s.days,from:s.from,to:s.to,
   averageDailyUnits:s.allDaily,quality1DailyUnits:s.q1Daily,
   activeDays:s.allActiveDays,quality1ActiveDays:s.q1ActiveDays,
   averageUnitPrice:s.allAvgPrice,quality1AveragePrice:s.q1AvgPrice||null,
   latestObservation:s.latestObservation,topReference:s.allDaily,
   evidenceSource:'Top Mercado · selección',snapshotMatch:true};
  if(other&&Math.abs(other.quality1DailyUnits-s.q1Daily)>.05)
    discrepancies.push({id:s.id,city:s.city,topQ1:s.q1Daily,queryQ1:other.quality1DailyUnits});
  // The top observation is the user's selection, so it is authoritative for this snapshot.
  out.set(key,top);fromTop++;
 }
 const missing=[];for(const id of included)for(const city of destinations){if(!out.has(marketKey(id,city)))missing.push({id,city});}
 return {rows:[...out.values()],missing,fromTop,fromAdditional:[...out.values()].filter(x=>!x.snapshotMatch).length,discrepancies,window};
}
export function trafficSignal(row){const avg=safeNum(row?.quality1DailyUnits??row?.q1Daily),active=safeNum(row?.quality1ActiveDays??row?.q1ActiveDays),days=Math.max(1,Number(row?.days)||7);
 const ratio=active/days;
 if(!avg)return {label:'Sin actividad Q1',level:'none',confidence:0};
 if(active<2||ratio<.30)return {label:'Actividad irregular',level:'thin',confidence:.45};
 if(ratio<.65)return {label:'Actividad parcial',level:'medium',confidence:.75};
 return {label:'Actividad frecuente',level:'high',confidence:1};
}
