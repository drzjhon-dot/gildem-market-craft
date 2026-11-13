// top.8 · Riesgo de saturación y reserva de diversidad por perfil.
// El historial comunitario de AODP refleja actividad observada, NO demanda
// contractual. Estas cuotas son estimaciones prudentes, no órdenes ejecutadas.
import {effectiveDaily} from './market-impact.js';
import {variantParts} from './craft-plan-controls.js';

export const DIVERSITY_POLICIES=Object.freeze({
  1:Object.freeze({name:'Prudente',lowTierBudgetShare:.24,activityShare:.012,lowLotMax7d:10,highLotMax7d:5}),
  2:Object.freeze({name:'Equilibrado',lowTierBudgetShare:.32,activityShare:.025,lowLotMax7d:22,highLotMax7d:10}),
  3:Object.freeze({name:'Agresivo',lowTierBudgetShare:.42,activityShare:.045,lowLotMax7d:36,highLotMax7d:18})
});
export function diversityPolicy(style=2){return DIVERSITY_POLICIES[Number(style)]||DIVERSITY_POLICIES[2];}
// Solo se activa al seleccionar la casilla de diversidad.
// Limita T4/T5 sin penalizar su existencia; las rutas premium caras requieren
// al menos una observación válida y nunca se fuerzan sin presupuesto.
export function diversityRouteCapacity(route,{style=2,horizonDays=7,available=Infinity}={}){
 const tier=variantParts(route?.id)?.tier||0;
 const initial=Number.isFinite(available)?Math.max(0,Math.floor(available)):Infinity;
 if(tier<4||tier>8||initial===0)return initial;
 const policy=diversityPolicy(style);
 const observed=effectiveDaily(route);
 if(observed===null||!(observed>0))return 0;
 const days=Math.max(1,Math.min(30,Number(horizonDays)||7));
 const units=Math.max(1,Number(route?.craftAmount)||1);
 const volumeRoom=Math.floor(observed*days*policy.activityShare/units);
 const tierHigh=tier>=6;
 // Sólo T6+ con historial real puede entrar con una fabricación exploratoria.
 const observedRoom=tierHigh?Math.max(1,volumeRoom):volumeRoom;
 const maxLot=Math.max(1,Math.floor((tierHigh?policy.highLotMax7d:policy.lowLotMax7d)*Math.sqrt(days/7)));
 return Math.max(0,Math.min(initial,observedRoom,maxLot));
}
export function diversityPlanStatistics(rows=[],budget=0){
 const byTier=new Map(),byEnchant=new Map();let lowSpent=0,totalSpent=0;
 for(const r of rows||[]){
  const p=variantParts(r.id);if(!p||!(r.qty>0))continue;
  const spend=r.qty*Number(r.capitalPerUnit||0);
  totalSpent+=spend;if(p.tier<=5)lowSpent+=spend;
  const t=byTier.get(p.tier)||{tier:p.tier,crafts:0,capital:0,ids:new Set()};
  t.crafts+=r.qty;t.capital+=spend;t.ids.add(r.id);byTier.set(p.tier,t);
  const e=byEnchant.get(p.enchant)||{enchant:p.enchant,crafts:0,capital:0};
  e.crafts+=r.qty;e.capital+=spend;byEnchant.set(p.enchant,e);
 }
 return {byTier:[...byTier.values()].sort((a,b)=>a.tier-b.tier).map(v=>({...v,items:v.ids.size,ids:undefined})),
  byEnchant:[...byEnchant.values()].sort((a,b)=>a.enchant-b.enchant),
  lowSpent,totalSpent,lowShare:budget>0?lowSpent/budget:0};
}
