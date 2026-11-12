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
/**
 * Individual item picker works on PRODUCT FAMILIES rather than SKUs.
 * e.g. MAIN_MACE selects T4_MAIN_MACE, T8_MAIN_MACE and available enchants.
 * Market Top still displays every tier/enchantment separately.
 */
export function familyKey(id){
 const m=/^T[1-8]_([A-Z0-9_]+?)(?:@[1-4])?$/.exec(String(id||''));
 return m?.[1]||null;
}
export function familyDisplayName(label,family=''){
 const raw=String(label||'').trim();
 // Remove the Spanish tier descriptor only when it closes the name.
 const simplified=raw.replace(/\s+(?:del|de la|de los|de las)\s+(?:iniciado|novato|adepto|experto|maestro|gran maestro|anciano|principiante)(?:s|as)?$/i,'').replace(/\s+T[1-8](?:\.[0-4])?$/i,'').trim();
 if(simplified && simplified!==family)return simplified;
 return String(family).split('_').filter(Boolean).map(x=>x[0]+x.slice(1).toLowerCase()).join(' ');
}
export function catalogFamilies({ids=[],names={},branchKeys=[],search='',selectedOnly=false,selectedFamilies=[],maxResults=64}={}){
 const branches=branchKeys.map(k=>BRANCH_BY_KEY.get(k)).filter(Boolean);
 const chosen=new Set(selectedFamilies.map(x=>familyKey(x)||String(x)));
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const searchTerm=norm(search), grouped=new Map();
 for(const id of ids){
  const key=familyKey(id);if(!key||!variant(id)||!branches.some(b=>b.test(id)))continue;
  let family=grouped.get(key);
  if(!family){family={key,id,name:'',count:0,searchText:'',score:Infinity};grouped.set(key,family);}
  const v=variant(id),score=(v.tier===4?0:10+v.tier)*10+v.ench;
  // Prefer T4.0 as icon/label; fallback to the lowest known variant.
  if(score<family.score){family.id=id;family.score=score;}
  family.count++;
  const localized=String(names[id]||'');
  if(localized)family.searchText+=' '+localized;
  family.searchText+=' '+id;
 }
 const families=[];
 for(const f of grouped.values()){
  if(selectedOnly&&!chosen.has(f.key))continue;
  f.name=familyDisplayName(names[f.id],f.key);
  if(searchTerm&&!norm(f.searchText+' '+f.name+' '+f.key).includes(searchTerm))continue;
  families.push({key:f.key,id:f.id,label:f.name,variants:f.count,selected:chosen.has(f.key)});
 }
 families.sort((a,b)=>Number(b.selected)-Number(a.selected)||a.label.localeCompare(b.label,'es')||a.key.localeCompare(b.key));
 return {families:families.slice(0,maxResults),total:families.length,showing:Math.min(maxResults,families.length)};
}
export function expandSelectedFamilies({ids=[],branchKeys=[],selectedFamilies=[],offset=0,limit=240}={}){
 const selected=new Set(selectedFamilies.map(x=>familyKey(x)||String(x)));
 const branches=branchKeys.map(k=>BRANCH_BY_KEY.get(k)).filter(Boolean);
 const all=ids.filter(id=>selected.has(familyKey(id))&&branches.some(b=>b.test(id))&&variant(id));
 // Cross-tier and cross-enchantment interleaving avoids cutting a big family at T4.
 const lines=new Map();for(const id of all){const v=variant(id),lane=`${v.tier}.${v.ench}`;if(!lines.has(lane))lines.set(lane,[]);lines.get(lane).push(id);}
 const ordered=[];const queues=[...lines].sort((a,b)=>a[0].localeCompare(b[0])).map(x=>x[1].sort());
 for(let i=0;queues.some(x=>i<x.length);i++)for(const queue of queues)if(queue[i])ordered.push(queue[i]);
 return {ids:ordered.slice(offset,offset+limit),total:ordered.length,offset,nextOffset:Math.min(ordered.length,offset+limit),complete:offset+limit>=ordered.length};
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
