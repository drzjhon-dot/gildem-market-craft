// Tres estrategias comparables sobre el MISMO universo de rutas viables.
// No usan nuevas cotizaciones ni inventan actividad; recalculan compra y diarios.
import {allocatePortfolioV6} from './allocator-v6.js';
import {allocateBestPortfolio} from './motor3.js';
import {fitPlan} from './plan.js';
import {portfolioSettings} from './craft-plan-controls.js';
import {bulkItemExposureFraction} from './high-volume.js';
import {resolveStyle} from './market-impact.js';
export const PLAN_PROPOSALS=Object.freeze([
 {id:'silver',label:'Más silver',description:'Margen neto y capital eficiente',fameGoal:0,goal:'balanced'},
 {id:'balance',label:'Silver y rotación',description:'Margen, liquidez y variedades viables',fameGoal:1,goal:'daily'},
 {id:'fame',label:'Más fama',description:'Fama por silver sin sacrificar el margen',fameGoal:2,goal:'balanced'}
]);
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const lane=id=>{const m=String(id||'').match(/^T([1-8])_[A-Z0-9_]+(?:@([1-4]))?$/);return m?m[1]+'.'+(m[2]||'0'):'?';};
export function proposalMetrics(plan){
 const rows=plan?.rows||[];
 return {items:new Set(rows.map(r=>r.id)).size,variants:new Set(rows.map(r=>lane(r.id))).size,
  routes:rows.length,units:rows.reduce((s,r)=>s+num(r.qty)*Math.max(1,num(r.craftAmount)||1),0),
  fame:rows.reduce((s,r)=>s+num(r.qty)*num(r.craftFame),0),
  profit:num(plan?.totalProfit),capital:num(plan?.totalCost),stress:rows.reduce((s,r)=>s+num(r.qty)*num(r.stressProfit),0)};
}
export function proposalSignature(plan){return (plan?.rows||[]).map(r=>r.id+'|'+r.city+'|'+r.mode+'|'+r.qty).sort().join(';');}
export function makeCraftProposals(routes,budget,{style=2,horizonDays=14,focusLimit=null,pending=new Map(),useAll=true,primaryPlan=null,primaryGoal=1,forceDiversity=false,enforce=null}={}){
 const allowed=(routes||[]).filter(r=>r&&r.id&&num(r.profit)>0&&(forceDiversity||num(r.stressProfit)>0)&&num(r.capitalPerUnit)>0&&num(r.cost)>0);
 const cap=Math.max(0,num(budget));
 const observedIds=new Set(allowed.map(r=>r.id)).size;
 const baselineCap=bulkItemExposureFraction(allowed);
 const options=PLAN_PROPOSALS.map((spec,i)=>{
  const profile=portfolioSettings({style,fameGoal:spec.fameGoal,eligibleItems:observedIds});
  const riskFactor=spec.id==='balance'?.82:1; // Preferir cartera menos concentrada, sin inventar volumen.
  const fraction=Math.min(baselineCap,profile.itemFractionCeiling)*(spec.id==='balance'?.90:1);
  const estimate=allowed.length&&cap>0?allocateBestPortfolio(allocatePortfolioV6,allowed,cap,{
   goal:spec.goal,useAll,capFraction:resolveStyle(style).maxShare*riskFactor,
   unknownCap:0,horizonDays,focusLimit,minimumConfidence:0,intelligent:true,
   bulkMode:true,saturation:style,fameWeight:[0,.5,1][spec.fameGoal],
   maxPerItemFraction:fraction,maxVariants:80,targetDifferentItems:profile.targetDifferentItems,
   diversityLanes:forceDiversity&&profile.diversityLanes,diversityWeight:profile.diversityWeight,forceDiversity,
   pendingByMarket:pending instanceof Map?pending:new Map()
  }):{rows:[]};
  const fitted=fitPlan(estimate.rows||[],cap,focusLimit,{preserveTiers:forceDiversity});
  // v9.11 · Cada propuesta también cumple la configuración (filtros, límites, cobertura, usar todo).
  const plan=typeof enforce==='function'&&fitted?.rows?enforce(fitted):fitted;
  return {...spec,plan,metrics:proposalMetrics(plan),duplicateOf:null};
 });
 // La propuesta del objetivo elegido debe coincidir con el plan que acaba de
 // validarse contra el abastecimiento de materiales, no con una vista previa.
 const selected=Math.max(0,Math.min(2,Number(primaryGoal)||0));
 if(primaryPlan){options[selected].plan=primaryPlan;options[selected].metrics=proposalMetrics(primaryPlan);}
 for(let i=0;i<options.length;i++)for(let j=0;j<i;j++)if(proposalSignature(options[i].plan)===proposalSignature(options[j].plan)){
  options[i].duplicateOf=options[j].id;break;
 }
 return options;
}
