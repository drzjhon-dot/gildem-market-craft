// v9.9.0-top.5: configuraciones duras y exploración balanceada.
// Ningún plan puede escapar de las opciones de tier, enchant, objeto ni capital.
const finite=x=>Number.isFinite(Number(x))?Number(x):NaN;
export const MIN_CRAFT_BUDGET=1_000;
export const MAX_CRAFT_BUDGET=1_000_000_000_000;
export function exactBudget(value){
 const n=finite(value);
 if(!Number.isSafeInteger(n)||n<MIN_CRAFT_BUDGET||n>MAX_CRAFT_BUDGET)throw Error('El presupuesto debe ser un entero entre 1.000 y 1.000.000.000.000 de silver.');
 return n;
}
export function variantParts(id){
 const m=String(id||'').match(/^T([1-8])_[A-Z0-9_]+(?:@([1-4]))?$/);
 return m?{tier:Number(m[1]),enchant:Number(m[2]||0)}:null;
}
// Comprueba DESPUÉS de asignar y aplicar restricciones de compras, no solo en el selector.
export function validateCraftPlan(rows,{tiers=[],enchants=[],ids=[],budget=0,market=null,focusLimit=null,totalCost=null}={}){
 const t=new Set(tiers.map(Number)),e=new Set(enchants.map(Number)),allowed=new Set(ids),problems=[];
 let committed=0,focus=0;
 for(const row of rows||[]){
  const part=variantParts(row?.id);
  if(!part||!t.has(part.tier)||!e.has(part.enchant))problems.push(`Variante fuera de filtros: ${row?.id||'desconocido'}`);
  if(!allowed.has(row?.id))problems.push(`Objeto fuera de la rama o selección: ${row?.id||'desconocido'}`);
  if(market==='black'&&row?.city!=='Black Market')problems.push(`Destino no autorizado: ${row?.city}`);
  if(market==='royal'&&row?.city==='Black Market')problems.push('El plan Royal contiene una ruta BM');
  if(!Number.isSafeInteger(row?.qty)||row.qty<1||!(finite(row.capitalPerUnit)>0))problems.push(`Cantidad o coste inválido: ${row?.id}`);
  committed+=Number(row?.qty||0)*Number(row?.capitalPerUnit||0);
  focus+=Number(row?.qty||0)*Number(row?.focusPerUnit||0);
 }
 const cap=finite(budget);
 if(!Number.isSafeInteger(cap)||cap<MIN_CRAFT_BUDGET)problems.push('Presupuesto inválido');
 if(committed>cap+.01)problems.push(`El plan excede el presupuesto (${Math.ceil(committed)} > ${cap})`);
 if(totalCost!==null&&(!Number.isFinite(Number(totalCost))||Number(totalCost)<0||Number(totalCost)>cap+.01))problems.push(`El coste bruto del lote excede el presupuesto o es inválido (${totalCost} > ${cap})`);
 if(focusLimit!==null&&focus>Number(focusLimit)+.01)problems.push('El plan excede el Focus disponible');
 return {ok:problems.length===0,problems,committed,remaining:Math.max(0,cap-committed),focus};
}
export function diversifiedRecipeIds(ids,{limit=Infinity}={}){
 const input=[...new Set(ids||[])],groups=new Map();
 for(const id of input){const part=variantParts(id);if(!part)continue;
  const lane=`T${part.tier}.${part.enchant}`,items=groups.get(lane)||[];items.push(id);groups.set(lane,items);
 }
 // Prioriza cobertura entre todas las combinaciones reales, no solo .0 / T4.
 const lanes=[...groups].sort((a,b)=>{
  const aa=variantParts(a[1][0]),bb=variantParts(b[1][0]);
  return aa.enchant-bb.enchant||aa.tier-bb.tier;
 }).map(([,a])=>a.sort());
 const output=[];let pass=0;
 while(output.length<limit){let changed=false;
  for(const lane of lanes)if(lane[pass]){output.push(lane[pass]);changed=true;if(output.length>=limit)break;}
  if(!changed)break;pass++;
 }
 return output;
}
export function portfolioSettings({style=2,fameGoal=1,eligibleItems=0}={}){
 const fame=[0,1,2].includes(Number(fameGoal))?Number(fameGoal):1;
 const mode=[1,2,3].includes(Number(style))?Number(style):2;
 const target=fame===2?32:fame===1?20:10;
 const adjusted=Math.max(1,target+(mode===1?4:mode===3?-4:0));
 return {targetDifferentItems:Math.min(60,adjusted,Math.max(1,eligibleItems)),
  diversityLanes:fame>=1||eligibleItems>=4, diversityWeight:fame===2?.13:fame===1?.07:.025,
  // El estilo mantiene su política de saturación; el objetivo cambia el reparto.
  itemFractionCeiling:fame===2?.22:fame===1?.34:.60};
}
