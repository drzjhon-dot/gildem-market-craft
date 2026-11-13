// Diarios por rama y tier: si el dump completo está disponible se usa ratio
// observado; en su defecto se muestra una ESTIMACIÓN, no fama exacta del juego.
import {itemTier,itemEnch} from './engine.js';
export const JOURNAL_CAPACITY={4:3600,5:7200,6:14400,7:28380,8:58590};
export const JOURNAL_NPC_REFERENCE={4:2000,5:4000,6:8000,7:16000,8:32000};
const metal=new Set(['axe','sword','crossbow','mace','hammer','gloves','boots_plate','heads_plate','chests_plate']);
const hunter=new Set(['bow','spear','dagger','quarterstaff','nature','shapeshifter','boots_leather','heads_leather','chests_leather']);
const mage=new Set(['fire','ice','holy','curse','arcane','boots_cloth','heads_cloth','chests_cloth']);
const names={WARRIOR:'Diario del herrero',HUNTER:'Diario del flechero',MAGE:'Diario del herrero mágico',TOOLMAKER:'Diario del hojalatero'};
export function journalCode(id,branch){
 if(metal.has(branch))return 'WARRIOR';if(hunter.has(branch))return 'HUNTER';if(mage.has(branch))return 'MAGE';
 if(branch==='bags'||branch==='capes')return 'TOOLMAKER';
 const s=String(id);
 if(/^T\d+_(SHOES_|HEAD_|ARMOR_)/.test(s))return s.includes('_PLATE_')?'WARRIOR':s.includes('_LEATHER_')?'HUNTER':s.includes('_CLOTH_')?'MAGE':null;
 if(branch==='offhand'){if(/SHIELD|HORN|SARCO|TOTEM|MUISAK/.test(s))return 'WARRIOR';if(/TORCH|MISTCALLER|LEERINGCANE|TALISMAN/.test(s))return 'HUNTER';if(/BOOK|TOME|ORB|CENSER|EYE|SKULL|CRYPTCANDLE/.test(s))return 'MAGE';}
 return null;
}
function fallbackFame(id,recipe){
 const bases={4:22.5,5:90,6:270,7:645,8:1395};const base={METALBAR:1,PLANKS:1,CLOTH:1,LEATHER:1};
 let fame=0;
 for(const m of recipe?.materials||[]){const match=String(m.id).match(/^T([4-8])_(METALBAR|PLANKS|CLOTH|LEATHER)(?:_|@|$)/);
  if(match)fame+=(bases[Number(match[1])]||0)*Math.pow(2,itemEnch(m.id))*Number(m.count||0);
  else if(m.ret!==false)return null;
 }
 return fame>0?fame:null;
}
export function journalInfo(id,recipe,branch,advanced){
 const tier=itemTier(id),code=journalCode(id,branch),capacity=JOURNAL_CAPACITY[tier];
 if(!code||!capacity)return null;
 if(advanced?.max>0&&advanced?.per>0){
  // El dump avanzado especifica qué diario se llena realmente.
  return {id,code,tier,empty:advanced.journal+'_EMPTY',full:advanced.journal+'_FULL',ratio:advanced.per/advanced.max,exact:true,source:'datos avanzados del juego',name:names[code],capacity:advanced.max};
 }
 const fame=fallbackFame(id,recipe);
 if(!(fame>0))return {id,code,tier,empty:`T${tier}_JOURNAL_${code}_EMPTY`,full:`T${tier}_JOURNAL_${code}_FULL`,ratio:null,exact:false,source:'fama no verificable',name:names[code],capacity};
 return {id,code,tier,empty:`T${tier}_JOURNAL_${code}_EMPTY`,full:`T${tier}_JOURNAL_${code}_FULL`,ratio:fame/capacity,exact:false,source:'estimación por recursos',name:names[code],capacity};
}
export function journalSummary(rows){
 const groups=new Map(),unknown=[];
 for(const r of rows||[]){const j=r.journal;if(!j||!(r.qty>0))continue;
  if(!(j.ratio>0)){unknown.push({id:r.id,qty:r.qty,reason:'fama sin verificar'});continue;}
  const key=j.empty;const old=groups.get(key)||{...j,partialAmount:0,crafts:0,qty:0,price:Number(j.price)||JOURNAL_NPC_REFERENCE[j.tier]||0,buyCity:j.buyCity||'Trabajador (referencia)',priceSource:j.price?'cotización':'referencia de trabajador',marketValue:j.fullPrice||null,fullPrice:j.fullPrice||0,fullTaxRate:j.fullTaxRate||0};
  old.partialAmount+=r.qty*j.ratio;old.crafts+=r.qty;groups.set(key,old);
 }
 const items=[...groups.values()].map(j=>({...j,qty:Math.ceil(j.partialAmount-1e-9),full:Math.floor(j.partialAmount+1e-9),partial:(j.partialAmount-Math.floor(j.partialAmount+1e-9))>1e-8?1:0,
  purchaseCost:Math.ceil(j.partialAmount-1e-9)*j.price}));
 return {items,unknown,cost:items.reduce((s,j)=>s+j.purchaseCost,0),fractionalCost:items.reduce((s,j)=>s+j.partialAmount*j.price,0)};
}
