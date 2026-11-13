// Controles de selección reutilizables por ambos planificadores.
// Una familia de objeto agrupa sus variantes por tier y encantamiento.
export const itemStem=id=>String(id||'').replace(/^T[1-8]_/, '').split('@')[0];
export const itemMatches=(id,{mode='all',stems=[],tierExact='all',enchExact='all'}={})=>{
 if(mode==='selected'&&!stems.includes(itemStem(id)))return false;
 const tier=Number(String(id).match(/^T([1-8])_/)?.[1]);
 const ench=Number(String(id).split('@')[1]||0);
 if(tierExact!=='all'&&tier!==Number(tierExact))return false;
 if(enchExact!=='all'&&ench!==Number(enchExact))return false;
 return true;
};
export function familyDisplayName(name){
 // itemName(id) appends " · 4.4" or " · T4.4" for a concrete variant.
 // A selector tile represents the entire family, so neither suffix belongs there.
 return String(name||'').replace(/\s*·\s*T?[1-8]\.[0-4]\s*$/i,'')
  .replace(/\s+d(?:el|e la|e los|e las)\s+(?:principiante|novato|obrero|iniciado|experto|maestro|gran maestro|anciano)\s*$/i,'').trim();
}
export function familyChoices(ids,nameOf=id=>id){
 const groups=new Map();
 for(const id of ids||[]){const stem=itemStem(id);if(!stem)continue;
  const tier=Number(String(id).match(/^T([1-8])_/)?.[1]);
  if(!Number.isInteger(tier))continue;
  const enchant=Number(id.split('@')[1]||0);
  const score=Math.abs(tier-4)*10+enchant;
  const current=groups.get(stem)||{stem,label:'',iconId:id.split('@')[0],tiers:new Set(),count:0,representativeScore:Infinity};
  current.tiers.add(tier);current.count++;
  if(score<current.representativeScore){
   current.label=familyDisplayName(nameOf(id)||stem);
   current.iconId=id.split('@')[0];current.representativeScore=score;
  }
  groups.set(stem,current);
 }
 return [...groups.values()].map(({representativeScore,...x})=>({...x,tiers:[...x.tiers].sort((a,b)=>a-b)})).sort((a,b)=>a.label.localeCompare(b.label,'es'));
}
export function filterIds(ids,filters){return (ids||[]).filter(id=>itemMatches(id,filters));}
