/**
 * Gildem 2.2 · Filtros del ranking de Top Mercado.
 * Solo filtran la vista: no cambian los datos consultados ni el motor del plan.
 */
import {variant} from './branches.js';
import {demandSignals} from './demand-signals.js';
export const TOP_FILTER_DEFAULTS=Object.freeze({tiers:[],enchants:[],minQ1:0,minSilver:0,search:'',signal:'all',onlyMarked:false});
export const SILVER_PRESETS=Object.freeze([0,100_000,500_000,1_000_000,5_000_000,20_000_000]);
export const SIGNAL_OPTIONS=Object.freeze([
 ['all','Todas las señales'],
 ['clean','Sin pico ni caída'],
 ['stable','Solo estables'],
 ['warn','Solo con aviso']
]);
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
export function sanitizeTopFilter(raw={}){
 const f={...TOP_FILTER_DEFAULTS,...(raw&&typeof raw==='object'?raw:{})};
 const ints=(list,min,max)=>Array.isArray(list)?[...new Set(list.map(Number).filter(x=>Number.isInteger(x)&&x>=min&&x<=max))].sort((a,b)=>a-b):[];
 return {tiers:ints(f.tiers,1,8),enchants:ints(f.enchants,0,4),
  minQ1:Number.isFinite(Number(f.minQ1))&&Number(f.minQ1)>0?Number(f.minQ1):0,
  minSilver:Number.isFinite(Number(f.minSilver))&&Number(f.minSilver)>0?Number(f.minSilver):0,
  search:String(f.search||'').slice(0,60),signal:SIGNAL_OPTIONS.some(([k])=>k===f.signal)?f.signal:'all',onlyMarked:f.onlyMarked===true};
}
export function activeFilterCount(f){f=sanitizeTopFilter(f);
 return (f.tiers.length?1:0)+(f.enchants.length?1:0)+(f.minQ1>0?1:0)+(f.minSilver>0?1:0)+(f.search?1:0)+(f.signal!=='all'?1:0)+(f.onlyMarked?1:0);}
export function applyTopFilters(rows,raw,{names={},marked=new Set()}={}){
 const f=sanitizeTopFilter(raw),q=norm(f.search),tiers=new Set(f.tiers),enchants=new Set(f.enchants);
 return rows.filter(r=>{
  const v=variant(r.id);
  if(tiers.size&&!tiers.has(v?.tier))return false;
  if(enchants.size&&!enchants.has(v?.ench??0))return false;
  if(f.minQ1>0&&!(Number(r.quality1DailyUnits)>=f.minQ1))return false;
  if(f.minSilver>0&&!(Number(r.averageDailySilver)>=f.minSilver))return false;
  if(f.onlyMarked&&!marked.has(r.id+'|'+r.city))return false;
  if(q&&!norm(names[r.id]).includes(q)&&!norm(r.id).includes(q))return false;
  if(f.signal!=='all'){const s=demandSignals(r);
   if(f.signal==='clean'&&s&&(s.spike||s.falling))return false;
   if(f.signal==='stable'&&s?.label!=='Estable')return false;
   if(f.signal==='warn'&&!(s&&(s.spike||s.falling)))return false;
  }
  return true;
 });
}
/** Tiers presentes en la consulta, para mostrar solo chips útiles (incluye T2–T3 de refinamiento). */
export function tiersInRows(rows){return [...new Set(rows.map(r=>variant(r.id)?.tier).filter(Boolean))].sort((a,b)=>a-b);}
export function enchantsInRows(rows){return [...new Set(rows.map(r=>variant(r.id)?.ench??0))].sort((a,b)=>a-b);}
