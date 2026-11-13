// Optional production-city consolidation for Royal Craft.  First judge
// routes by viable NET profit, then choose up to N crafting cities BEFORE
// assigning capital. This is a transparent heuristic, not an exact optimizer.
const nonneg=x=>Number.isFinite(Number(x))?Math.max(0,Number(x)):0;
export function chooseCraftingCities(routes=[],{maxCities=1,budget=20_000_000}={}){
 if(maxCities==='all')return {routes:[...routes],cities:[...new Set(routes.map(r=>r.craftCity).filter(Boolean))],removed:0,method:'sin límite'};
 const limit=Math.max(1,Math.min(8,Number(maxCities)||1));
 const grouped=new Map();
 for(const r of routes){if(!r?.craftCity||!(r.profit>0)||!(r.capitalPerUnit>0))continue;
  const key=r.craftCity,perItem=grouped.get(key)||new Map();
  const available=r.marketCapacity!=null&&Number.isFinite(Number(r.marketCapacity))?nonneg(r.marketCapacity):
   r.activity?.observations?Math.floor(nonneg(r.activity.observedDaily)*.1/Math.max(1,nonneg(r.craftAmount)||1)):0;
  const cap=Math.min(4,available,Math.floor(nonneg(budget)*.15/r.capitalPerUnit));
  const score=nonneg(r.profit)*cap;
  const prior=perItem.get(r.id)||0;
  if(score>prior)perItem.set(r.id,score);
  grouped.set(key,perItem);
 }
 const ranks=[...grouped.entries()].map(([city,byItem])=>({city,score:[...byItem.values()].sort((a,b)=>b-a).slice(0,10).reduce((s,v)=>s+v,0)}));
 ranks.sort((a,b)=>b.score-a.score||a.city.localeCompare(b.city));
 const cities=ranks.slice(0,limit).map(r=>r.city),set=new Set(cities);
 const included=routes.filter(r=>set.has(r.craftCity));
 return {routes:included,cities,removed:routes.length-included.length,method:'máximo '+limit+' ciudades, puntuadas por beneficio prudente y capacidad observada'};
}
