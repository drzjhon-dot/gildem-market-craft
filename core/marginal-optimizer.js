// Optimizador del Motor 3.0 (portado de Gildem Market & Craft 3.0).
// Reparto "greedy perezoso" por rentabilidad marginal: cada bloque de producción se compara con
// los demás por beneficio adicional / capital adicional. Como la venta pierde precio al crecer el
// lote y la compra encarece al vaciar el mercado de materiales, el beneficio marginal baja solo:
// el motor se detiene donde deja de compensar, sin topes fijos de rutas.
//
// Una ruta expone:
//  key, step, max                         → bloques y máximo de unidades de producción
//  groups {dim:valor}                     → exposición (tier, encantamiento, familia, mercado…)
//  division                               → (opcional) ciudad de venta para limitar divisiones
//  focusPts, focusSavingPerPoint          → (opcional) Focus por unidad y ahorro por punto
//  mats(useFocus) → [{key,units}]         → materiales netos comprados por unidad (para el deslizamiento)
//  weightPerUnit(useFocus)                → (opcional) kg comprados por unidad
//  totals(q,fq) → {revenue,cost,fame,cushion}   (sin deslizamiento compartido)
// El "ledger" guarda, por material y ciudad, el volumen diario y el precio: comprar más días de
// mercado encarece cada unidad adicional (5 % por día extra, tope 25 %).

export const SLIP_PER_DAY=.05,SLIP_CAP=.25;
/** Sobrecoste acumulado (en "unidades de precio") por comprar x unidades con un volumen diario d. */
export function slipExtra(x,daily){
 if(!(daily>0)||!(x>daily))return 0;
 const capAt=daily*(1+SLIP_CAP/SLIP_PER_DAY),k=SLIP_PER_DAY/daily;
 if(x<=capAt)return k*(x-daily)**2/2;
 return k*(capAt-daily)**2/2+SLIP_CAP*(x-capAt);
}
class Heap{constructor(){this.a=[];}
 get size(){return this.a.length;}
 peek(){return this.a[0];}
 push(x){const a=this.a;a.push(x);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(a[p].s>=a[i].s)break;[a[p],a[i]]=[a[i],a[p]];i=p;}}
 pop(){const a=this.a,top=a[0],last=a.pop();if(a.length){a[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;
  if(l<a.length&&a[l].s>a[m].s)m=l;if(r<a.length&&a[r].s>a[m].s)m=r;if(m===i)break;[a[m],a[i]]=[a[i],a[m]];i=m;}}return top;}
}
/** Umbral de "llenado" de Focus: solo las rutas que más ahorran por punto lo usan. */
export function focusThreshold(routes,focusCap){
 if(!(focusCap>0))return Infinity;
 const list=routes.filter(r=>r.focusPts>0&&r.focusSavingPerPoint>0).map(r=>[r.focusSavingPerPoint,r.max*r.focusPts]).sort((a,b)=>b[0]-a[0]);
 let acc=0;for(const [s,need] of list){acc+=need;if(acc>=focusCap)return s;}
 return list.length?list[list.length-1][0]:Infinity;
}
/**
 * @param o.routes
 * @param o.budget           capital máximo
 * @param o.ledger           Map key→{daily,price}
 * @param o.goal             'silver'|'balanced'|'fame'
 * @param o.fameSilver       valor en silver de 1 punto de fama (objetivo equilibrado)
 * @param o.minMarginalRoi   rentabilidad mínima de cada bloque adicional (fracción)
 * @param o.limits           {dim:fracción} límite de capital por grupo, relativo a la base del plan
 * @param o.routeCapShare    límite de capital por ruta (fracción de la base)
 * @param o.focusCap,o.weightCap,o.maxDivisions,o.lossCap,o.routeLossShare
 */
export function optimize(o){
 const routes=o.routes.filter(r=>r.max>=1&&r.step>=1);
 const ledger=new Map([...(o.ledger||new Map())].map(([k,v])=>[k,{daily:Number(v.daily)||0,price:Number(v.price)||0,units:0}]));
 const goal=o.goal||'silver',fameSilver=Number(o.fameSilver)||0,minRoi=Number(o.minMarginalRoi)||0;
 const st=new Map(routes.map(r=>[r.key,{q:0,fq:0,cap:0,profit:0,fame:0,slip:0,base:r.totals(0,0)}]));
 // Base de exposición: lo que costaría el plan con todas las rutas al máximo, sin pasar del presupuesto.
 let full=0;for(const r of routes){const t=r.totals(r.max,0);full+=t.cost+(t.cushion||0);}
 const base=Math.max(1,Math.min(Number(o.budget)||0,full));
 const groupCap=new Map(),limits={};
 // Un límite imposible (p. ej. 20 % con solo 3 tiers) se eleva a 100/N + 5 %, como en el motor 2.x.
 for(const [dim,lim] of Object.entries(o.limits||{})){if(!(lim>0)||lim>=1)continue;
  const n=new Set(routes.map(r=>r.groups?.[dim]).filter(x=>x!=null)).size;limits[dim]=n>1?Math.max(lim,1/n+.05):1;}
 const threshold=focusThreshold(routes,Number(o.focusCap)||0);
 let budgetLeft=Number(o.budget)||0,focusLeft=Number(o.focusCap)||0,weightLeft=o.weightCap>0?Number(o.weightCap):Infinity,loss=0;
 const divisions=new Set(),maxDiv=o.maxDivisions>0?Number(o.maxDivisions):Infinity;
 const rejections=new Map();
 function slipCost(list,add){let extra=0;for(const m of list){const l=ledger.get(m.key);if(!l||!(l.daily>0))continue;
  const u=m.units*add;extra+=l.price*(slipExtra(l.units+u,l.daily)-slipExtra(l.units,l.daily));}return extra;}
 function marginal(r,dqWanted){
  const s=st.get(r.key);if(!s.q&&r.firstStep>dqWanted)dqWanted=r.firstStep;let dq=Math.min(dqWanted,r.max-s.q);if(dq<1)return null;
  const minFirst=!s.q&&r.firstStep>1?r.firstStep:1;
  const useF=r.focusPts>0&&r.focusSavingPerPoint>=threshold&&focusLeft>=r.focusPts;
  let dfq=useF?Math.min(dq,Math.floor(focusLeft/r.focusPts)):0;
  const evalAt=(dq,dfq)=>{const t0=s.q?r.totals(s.q,s.fq):s.base,t1=r.totals(s.q+dq,s.fq+dfq);
   const slip=slipCost(r.mats(false),dq-dfq)+(dfq?slipCost(r.mats(true),dfq):0);
   const dCost=t1.cost-t0.cost+slip,dCap=dCost+(s.q?0:(t1.cushion||0));
   const kg=r.weightPerUnit?(r.weightPerUnit(false)*(dq-dfq)+(dfq?r.weightPerUnit(true)*dfq:0)):0;
   return {dq,dfq,dRev:t1.revenue-t0.revenue,dCost,dCap,dFame:t1.fame-t0.fame,slip,kg};};
  let m=evalAt(dq,dfq);
  // Recorta el bloque al capital, peso y exposición disponibles.
  const room=[budgetLeft/Math.max(1e-9,m.dCap),m.kg>0?weightLeft/m.kg:Infinity];
  const cap=Number(o.routeCapShare)>0?o.routeCapShare*base:Infinity;room.push((cap-s.cap)/Math.max(1e-9,m.dCap));
  for(const [dim,val] of Object.entries(r.groups||{})){const lim=limits[dim];if(!(lim>0)||lim>=1)continue;
   room.push((lim*base-(groupCap.get(dim+'|'+val)||0))/Math.max(1e-9,m.dCap));}
  const f=Math.min(1,...room);
  if(f<1){const ndq=Math.floor(dq*f+1e-9);if(ndq<minFirst)return {blocked:true,why:room.indexOf(f)===0?'presupuesto':room.indexOf(f)===1?'peso':'exposición'};
   dfq=Math.min(dfq,ndq);dq=ndq;m=evalAt(dq,dfq);
   if(m.dCap>budgetLeft+1e-6||m.kg>weightLeft+1e-6)return {blocked:true,why:'presupuesto'};}
  const dProfit=m.dRev-m.dCost;
  let score,ok;
  if(goal==='fame'){score=m.dFame/Math.max(1,m.dCap)+dProfit/Math.max(1,m.dCap)*.002;
   const routeLoss=Math.max(0,-(s.profit+dProfit));
   ok=m.dFame>0&&(dProfit>=0||(loss+Math.max(0,-dProfit)<=(o.lossCap||0)&&routeLoss<=(o.routeLossShare??.25)*(s.cap+m.dCap)));}
  else{score=(dProfit+(goal==='balanced'?fameSilver*m.dFame:0))/Math.max(1,m.dCap);
   ok=dProfit>0&&dProfit/Math.max(1,m.dCap)>=minRoi;}
  return {...m,dProfit,score,ok};
 }
 // Siembra opcional (diversidad): un primer lote por grupo antes del reparto marginal.
 const accept=(r,m)=>{const s=st.get(r.key);s.q+=m.dq;s.fq+=m.dfq;s.cap+=m.dCap;s.profit+=m.dProfit;s.fame+=m.dFame;s.slip+=m.slip;
  budgetLeft-=m.dCap;focusLeft-=m.dfq*(r.focusPts||0);weightLeft-=m.kg;if(m.dProfit<0)loss+=-m.dProfit;if(r.division)divisions.add(r.division);
  for(const [dim,val] of Object.entries(r.groups||{}))groupCap.set(dim+'|'+val,(groupCap.get(dim+'|'+val)||0)+m.dCap);
  for(const [list,n] of [[r.mats(false),m.dq-m.dfq],[m.dfq?r.mats(true):[],m.dfq]])for(const x of list){const l=ledger.get(x.key);if(l)l.units+=x.units*n;}};
 for(const group of o.seedGroups||[]){if(group.some(r=>st.get(r.key)?.q))continue;for(const r of group){if(!st.has(r.key))continue;
   if(r.division&&!divisions.has(r.division)&&divisions.size>=maxDiv)continue;
   const m=marginal(r,r.firstStep||1);if(m&&!m.blocked&&m.ok){accept(r,m);break;}}}
 const heap=new Heap();
 for(const r of routes){const m=marginal(r,r.step);if(m?.ok)heap.push({r,s:m.score});else if(m)rejections.set(r.key,m.blocked?`Sin ${m.why} disponible`:'No alcanza la rentabilidad mínima ni con el primer bloque');}
 let guard=0;
 while(heap.size&&guard++<200000){
  const top=heap.pop(),r=top.r,s=st.get(r.key);
  if(r.division&&!divisions.has(r.division)&&divisions.size>=maxDiv){rejections.set(r.key,'Límite de divisiones (ciudades de venta) alcanzado');continue;}
  const m=marginal(r,r.step);
  if(!m||m.blocked||!m.ok){if(!s.q)rejections.set(r.key,m?.blocked?`Sin ${m.why} disponible`:'El primer bloque no alcanza la rentabilidad mínima');continue;}
  if(heap.size&&m.score<heap.peek().s-1e-12){heap.push({r,s:m.score});continue;}
  // Acepta el bloque.
  s.q+=m.dq;s.fq+=m.dfq;s.cap+=m.dCap;s.profit+=m.dProfit;s.fame+=m.dFame;s.slip+=m.slip;
  budgetLeft-=m.dCap;focusLeft-=m.dfq*(r.focusPts||0);weightLeft-=m.kg;
  if(m.dProfit<0)loss+=-m.dProfit;
  if(r.division)divisions.add(r.division);
  for(const [dim,val] of Object.entries(r.groups||{}))groupCap.set(dim+'|'+val,(groupCap.get(dim+'|'+val)||0)+m.dCap);
  for(const [list,n] of [[r.mats(false),m.dq-m.dfq],[m.dfq?r.mats(true):[],m.dfq]])for(const x of list){const l=ledger.get(x.key);if(l)l.units+=x.units*n;}
  if(s.q<r.max){const next=marginal(r,r.step);if(next?.ok)heap.push({r,s:next.score});}
 }
 const chosen=routes.filter(r=>st.get(r.key).q>0).map(r=>({route:r,...st.get(r.key)}));
 return {chosen,budgetLeft,focusLeft,weightLeft:Number.isFinite(weightLeft)?weightLeft:null,loss,base,rejections,
  divisions:[...divisions],ledger,focusThreshold:threshold};
}
