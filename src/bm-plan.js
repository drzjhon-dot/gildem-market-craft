// PLAN MERCADO NEGRO (v3.1) · motor simple y predecible para vender al Mercado Negro en pocos días.
// Reglas (las mismas del plan de espadas que funcionó):
//  1. Demanda real del Mercado Negro: ventas diarias medias (AODP o tabla pegada de otra web).
//  2. Cupo por artículo: nunca más del X % de lo que el Mercado Negro compra en el plazo (6 % de 3 días por defecto).
//  3. Valor por material: dentro del mismo nivel de poder (tier + encantamiento) y los mismos recursos,
//     se descartan las variantes que pagan bastante menos por material (casi siempre las encantadas).
//  4. Diversidad: varios artículos, repartidos entre tiers y familias, con tope de presupuesto por artículo.
//  5. Sin cotización de materiales NO se descarta nada: se usa un margen supuesto y se da el
//     PRECIO MÁXIMO al que conviene comprar cada material. Con precios reales (AODP o los tuyos) se afina.
import {variant} from './branches.js';
import {returnRate} from './planner.js';
import {premiumTax} from './economics.js';
import {purchaseQuote} from './market.js';

export const BM_DEFAULTS=Object.freeze({
 budget:10_000_000,saleDays:3,maxSharePct:6,maxItems:9,maxItemBudgetPct:25,minDailyUnits:3,
 assumedMarginPct:25,targetMarginPct:20,minValuePct:75,premium:true,bonusCity:true,dailyBonus:0,
 focusBonus:59,excludeArtifacts:true,useAodpMaterials:true,tiers:[4,5,6,7,8],enchants:[0,1,2,3,4],
 source:'aodp',branches:['sword'],matPrices:{}
});
const num=(x,d=0)=>Number.isFinite(Number(x))?Number(x):d;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

export function bmSettings(cfg={}){
 const c={...BM_DEFAULTS,...cfg};
 c.budget=clamp(Math.round(num(c.budget,BM_DEFAULTS.budget)),10_000,1e12);
 c.saleDays=clamp(Math.round(num(c.saleDays,3)),1,14);
 c.maxSharePct=clamp(num(c.maxSharePct,6),1,50);
 c.maxItems=clamp(Math.round(num(c.maxItems,9)),1,40);
 c.maxItemBudgetPct=clamp(num(c.maxItemBudgetPct,25),5,100);
 c.minDailyUnits=clamp(num(c.minDailyUnits,3),0,10_000);
 c.assumedMarginPct=clamp(num(c.assumedMarginPct,25),0,300);
 c.targetMarginPct=clamp(num(c.targetMarginPct,20),0,300);
 c.minValuePct=clamp(num(c.minValuePct,75),0,100);
 c.dailyBonus=[0,10,20].includes(Number(c.dailyBonus))?Number(c.dailyBonus):0;
 c.focusBonus=clamp(num(c.focusBonus,59),0,200);
 for(const k of ['tiers','enchants'])if(!Array.isArray(c[k])||!c[k].length)c[k]=[...BM_DEFAULTS[k]];
 if(!['aodp','paste'].includes(c.source))c.source='aodp';
 if(!Array.isArray(c.branches))c.branches=[...BM_DEFAULTS.branches];
 const mp={};for(const [id,v] of Object.entries(c.matPrices||{}))if(/^[A-Z0-9_@-]{3,100}$/.test(id)&&num(v)>0)mp[id]=num(v);
 c.matPrices=mp;c.tax=premiumTax(c.premium);
 return c;
}

/** "5,1M" → 5100000 · "8,7K" → 8700 · "584" → 584 · "1.234,5" → 1234.5 */
export function parseAmount(raw){
 let s=String(raw??'').trim().replace(/\s/g,'').replace(/silver|plata/gi,'');
 if(!s)return NaN;const m=s.match(/^(-?[\d.,]+)([kKmMbB]?)$/);if(!m)return NaN;
 let n=m[1];
 if(n.includes(',')&&n.includes('.'))n=n.lastIndexOf(',')>n.lastIndexOf('.')?n.replace(/\./g,'').replace(',','.'):n.replace(/,/g,'');
 else if(n.includes(','))n=/^\d{1,3}(,\d{3})+$/.test(n)&&!m[2]?n.replace(/,/g,''):n.replace(',','.');
 else if(/^\d{1,3}(\.\d{3})+$/.test(n)&&!m[2])n=n.replace(/\./g,'');
 const v=Number(n);if(!Number.isFinite(v))return NaN;
 return v*({k:1e3,m:1e6,b:1e9}[m[2].toLowerCase()]||1);
}

const ID_RE=/^T[1-8]_[A-Z0-9_]+(?:@[1-4])?$/;
/**
 * Lee una tabla copiada de una web de ventas del Mercado Negro (p. ej. «top selling items»).
 * Cada artículo empieza en una línea con su ID; la primera línea con tres cifras da
 * cantidad diaria · silver diario · precio medio. Admite filas tabuladas en una sola línea.
 */
export function parseBlackMarketTable(text){
 const rows=[],skipped=[];let cur=null;
 const flush=()=>{if(!cur)return;
  if(cur.city&&!/black\s*market|mercado\s*negro/i.test(cur.city))skipped.push({id:cur.id,reason:'Otra ciudad: '+cur.city});
  else if(cur.nums)rows.push(toRow(cur));else skipped.push({id:cur.id,reason:'Sin cifras de venta'});cur=null;};
 const toRow=c=>{const [units,silver,price]=c.nums;
  // La cantidad viene redondeada (0 = menos de 0,5/día): silver/precio da el valor real.
  const daily=silver>0&&price>0?silver/price:units;
  return {id:c.id,dailyUnits:daily,price,dailySilver:silver>0?silver:daily*price,source:'tabla'};};
 for(const line of String(text||'').split(/\r?\n/)){
  const cells=line.split(/\t|\s{2,}|;/).map(x=>x.trim()).filter(Boolean);if(!cells.length)continue;
  const idCell=cells.find(x=>ID_RE.test(x));
  if(idCell){flush();cur={id:idCell,city:null,nums:null};}
  if(!cur)continue;
  for(const x of cells)if(/black\s*market|mercado\s*negro|caerleon|lymhurst|martlock|thetford|bridgewatch|fort\s*sterling|brecilien/i.test(x)&&!cur.city)cur.city=x;
  const nums=cells.filter(x=>!ID_RE.test(x)&&!/^T\d\.\d$/.test(x)).map(parseAmount).filter(Number.isFinite);
  if(!cur.nums&&nums.length>=3)cur.nums=nums.slice(-3);
 }
 flush();
 const seen=new Map();for(const r of rows)if(!seen.has(r.id))seen.set(r.id,r);
 return {rows:[...seen.values()],skipped};
}

/** Demanda del Mercado Negro desde el historial AODP (todas las calidades) y la puja actual Q1. */
export function demandFromAodp(history=[],quotes=new Map(),{now=Date.now(),maxQuoteHours=24}={}){
 const out=[];
 for(const h of history){if(h.city!=='Black Market')continue;
  const q=quotes.get?.(h.id+'|Black Market')?.bid;const fresh=q&&now-q.time<=maxQuoteHours*3600e3&&q.price>0;
  const hist=num(h.quality1AveragePrice)||num(h.averageUnitPrice);
  // Puja fresca de calidad 1 = precio real de venta instantánea; si no hay, media Q1 −3 %.
  const price=fresh?q.price:hist*.97;if(!(price>0))continue;
  out.push({id:h.id,dailyUnits:num(h.averageDailyUnits),price,dailySilver:num(h.averageDailySilver),source:fresh?'puja actual':'historial −3 %',activeDays:h.activeDays,days:h.days});
 }
 return out;
}

const resourceKind=id=>String(id).replace(/^T\d_/,'').replace(/_LEVEL\d/,'').replace(/@\d$/,'');
const familyOf=id=>String(id).replace(/^T\d_/,'').replace(/@\d$/,'');
const isArtifactMat=m=>m.ret===false||/ARTEFACT|ARTIFACT|_RUNE|_SOUL|_RELIC|_SHARD_AVALON/.test(m.id);

function materialQuote(c,quotes,id,craftCity,now){
 if(c.matPrices[id])return {price:c.matPrices[id],source:'tuyo'};
 if(!c.useAodpMaterials||!quotes)return null;
 const q=purchaseQuote(quotes,id,craftCity,{purchaseMode:'best-royal',maxQuoteHours:48},now);
 return q?{price:q.landedUnitPrice??q.unitPrice,source:'AODP '+q.city,city:q.city}:null;
}

/**
 * Plan del Mercado Negro.
 * @param demand [{id,dailyUnits,price}] precio = lo que paga el Mercado Negro por unidad.
 */
export function planBlackMarket({demand=[],recipes={},quotes=null,config={},names={},now=Date.now()}={}){
 const c=bmSettings(config),tax=c.tax/100,rejected=[],warnings=[];
 const name=id=>names[id]||id;
 const reject=(id,reason)=>rejected.push({id,reason});
 const rr=(recipe,focus)=>returnRate({bonusCity:c.bonusCity,recipe:{city:recipe.city,specialtyEnabled:recipe.specialtyEnabled,specialtyBonus:recipe.specialtyBonus,dailyEnabled:recipe.dailyEnabled},dailyBonus:c.dailyBonus,focus,focusBonus:c.focusBonus}).returnPct/100;
 // 1 · candidatos válidos
 const cands=[];
 for(const d of demand){const v=variant(d.id);
  if(!v){reject(d.id,'ID no reconocido');continue;}
  if(!c.tiers.includes(v.tier)||!c.enchants.includes(v.ench)){continue;}
  if(!(d.price>0)){reject(d.id,'Sin precio del Mercado Negro');continue;}
  if(num(d.dailyUnits)<c.minDailyUnits){reject(d.id,`Se venden ${fmt(d.dailyUnits)}/día (mínimo ${c.minDailyUnits})`);continue;}
  const recipe=recipes[d.id];if(!recipe?.materials?.length){reject(d.id,'Sin receta en el catálogo');continue;}
  const mats=recipe.materials.filter(m=>m.id&&num(m.count)>0);
  const artifacts=mats.filter(isArtifactMat),base=mats.filter(m=>!isArtifactMat(m));
  if(artifacts.length&&c.excludeArtifacts){reject(d.id,'Lleva artefacto (desactivado en la configuración)');continue;}
  if(!base.length){reject(d.id,'Receta sin recursos refinados');continue;}
  const matCount=base.reduce((s,m)=>s+num(m.count),0);
  cands.push({...d,tier:v.tier,ench:v.ench,level:v.tier+v.ench,recipe,mats,base,artifacts,matCount,
   signature:base.map(m=>resourceKind(m.id)).sort().join('+'),family:familyOf(d.id),valuePerMat:d.price/matCount});
 }
 // 2 · valor por material frente a lo mejor del mismo nivel de poder y mismos recursos
 const best=new Map();
 for(const x of cands){const k=x.level+'|'+x.signature,b=best.get(k);if(!b||x.valuePerMat>b.valuePerMat)best.set(k,x);}
 const valued=[];
 for(const x of cands){const b=best.get(x.level+'|'+x.signature);x.relValue=x.valuePerMat/b.valuePerMat;x.bestPeer=b.id;
  if(x.relValue*100<c.minValuePct){reject(x.id,`Paga ${Math.round((1-x.relValue)*100)} % menos por material que ${name(b.id)} (mismo nivel de poder)`);continue;}
  valued.push(x);}
 // 3 · coste, margen y precio máximo de material
 const viable=[];
 for(const x of valued){
  const r0=rr(x.recipe,false),r1=rr(x.recipe,true),net=x.price*(1-tax);
  const netMats=r=>x.base.reduce((s,m)=>s+num(m.count)*(m.ret===false?1:1-r),0);
  let artifactCost=0,artifactMissing=false;
  for(const a of x.artifacts){const q=materialQuote(c,quotes,a.id,x.recipe.city,now);if(q)artifactCost+=q.price*num(a.count);else artifactMissing=true;}
  if(artifactMissing){reject(x.id,'Lleva artefacto sin precio: escríbelo en la lista de compra o desactiva los artefactos');continue;}
  const maxMat=r=>Math.max(0,(net/(1+c.targetMarginPct/100)-artifactCost)/netMats(r));
  const priced=x.base.map(m=>({m,q:materialQuote(c,quotes,m.id,x.recipe.city,now)}));
  const known=priced.every(p=>p.q);
  let unitCost,costSource;
  if(known){unitCost=priced.reduce((s,{m,q})=>s+num(m.count)*(m.ret===false?1:1-r0)*q.price,0)+artifactCost;costSource=priced.some(p=>p.q.source==='tuyo')?'tus precios':'AODP';}
  else{unitCost=net/(1+c.assumedMarginPct/100);costSource='supuesto';}
  const margin=net/unitCost-1;
  if(known&&margin*100<c.targetMarginPct){reject(x.id,`Margen real ${Math.round(margin*100)} % (objetivo ${c.targetMarginPct} %)`);continue;}
  const cap=Math.floor(x.dailyUnits*c.saleDays*c.maxSharePct/100);
  if(cap<1){reject(x.id,`Con ${fmt(x.dailyUnits)}/día no cabe ni 1 unidad en el ${c.maxSharePct} % de ${c.saleDays} días`);continue;}
  viable.push({...x,net,unitCost,costSource,margin,cap,rrNoFocus:r0,rrFocus:r1,maxMatNoFocus:maxMat(r0),maxMatFocus:maxMat(r1),artifactCost,priced});
 }
 // 4 · selección con diversidad
 // Puntuación: margen × valor por material × capacidad (un artículo que solo admite 1–2 unidades
 // no debe quitar un hueco del plan a otro que puede absorber capital de verdad).
 const itemCapScore=c.budget*c.maxItemBudgetPct/100;
 for(const x of viable){x.capFactor=Math.min(1,x.cap*x.unitCost/(itemCapScore*.4));x.score=Math.max(0,x.margin)*x.relValue*x.capFactor;}
 viable.sort((a,b)=>b.score-a.score||b.dailyUnits*b.price-a.dailyUnits*a.price);
 const tierCount=new Set(viable.map(x=>x.tier)).size||1,maxPerTier=Math.max(1,Math.ceil(c.maxItems/tierCount)),maxPerFamily=Math.max(2,Math.ceil(c.maxItems/2));
 const picked=[],perTier=new Map(),perFamily=new Map();
 const itemCap=c.budget*c.maxItemBudgetPct/100;
 for(const x of viable){if(picked.length>=c.maxItems)break;
  if(x.unitCost>itemCap||x.unitCost>c.budget){reject(x.id,`Una unidad cuesta ~${fmt(x.unitCost)}: más que el tope por artículo`);continue;}
  if((perTier.get(x.tier)||0)>=maxPerTier||(perFamily.get(x.family)||0)>=maxPerFamily){x.waiting=true;continue;}
  picked.push(x);perTier.set(x.tier,(perTier.get(x.tier)||0)+1);perFamily.set(x.family,(perFamily.get(x.family)||0)+1);}
 // Si sobran huecos, se aceptan los que esperaban por diversidad.
 for(const x of viable)if(picked.length<c.maxItems&&x.waiting&&!picked.includes(x)&&x.unitCost<=itemCap)picked.push(x);
 for(const x of viable)if(!picked.includes(x)&&!rejected.some(r=>r.id===x.id))reject(x.id,`Fuera por diversidad: ya hay ${c.maxItems} artículos en el plan`);
 // 5 · reparto del presupuesto por rondas (todos avanzan a la vez)
 let left=c.budget;const units=new Map(picked.map(x=>[x.id,0]));
 for(let guard=0;guard<10_000;guard++){let moved=false;
  for(const x of picked){const u=units.get(x.id);if(u>=x.cap)continue;
   const lot=Math.max(1,Math.ceil(x.cap/5)),room=Math.min(x.cap-u,Math.floor((itemCap-u*x.unitCost)/x.unitCost),Math.floor(left/x.unitCost),lot);
   if(room<1)continue;units.set(x.id,u+room);left-=room*x.unitCost;moved=true;}
  if(!moved)break;}
 const rows=picked.filter(x=>units.get(x.id)>0).map(x=>{const u=units.get(x.id);
  return {id:x.id,name:name(x.id),tier:x.tier,ench:x.ench,units:u,price:x.price,priceSource:x.source,dailyUnits:x.dailyUnits,
   sharePct:100*u/(x.dailyUnits*c.saleDays),perDay:Math.ceil(u/c.saleDays),revenue:u*x.net,capital:u*x.unitCost,profit:u*(x.net-x.unitCost),
   margin:x.margin,costSource:x.costSource,maxMatNoFocus:x.maxMatNoFocus,maxMatFocus:x.maxMatFocus,relValue:x.relValue,
   materials:x.mats.map(m=>({id:m.id,count:num(m.count),ret:!isArtifactMat(m)})),rr:x.rrNoFocus};});
 rows.sort((a,b)=>b.price-a.price);
 // 6 · lista de compra (neta del retorno sin Focus, crafteando en tandas)
 const buy=new Map();
 for(const r of rows){const x=picked.find(p=>p.id===r.id);
  for(const m of r.materials){const e=buy.get(m.id)||{id:m.id,name:name(m.id),recipeUnits:0,buyUnits:0,maxPrice:Infinity,artifact:!m.ret,usedBy:[]};
   e.recipeUnits+=m.count*r.units;e.buyUnits+=m.count*r.units*(m.ret?1-r.rr:1);
   if(m.ret)e.maxPrice=Math.min(e.maxPrice,x.maxMatNoFocus);e.usedBy.push(r.id);buy.set(m.id,e);}}
 const shopping=[...buy.values()].map(e=>{const q=materialQuote(c,quotes,e.id,recipes[e.usedBy[0]]?.city,now);
  const buyUnits=Math.ceil(e.buyUnits);
  return {...e,buyUnits,maxPrice:Number.isFinite(e.maxPrice)?e.maxPrice:null,quote:q?.price??null,quoteSource:q?.source??null,
   overMax:q&&Number.isFinite(e.maxPrice)?q.price>e.maxPrice:false,maxCost:Number.isFinite(e.maxPrice)?buyUnits*e.maxPrice:null};})
  .sort((a,b)=>a.id.localeCompare(b.id));
 const summary={capital:rows.reduce((s,r)=>s+r.capital,0),revenue:rows.reduce((s,r)=>s+r.revenue,0),profit:rows.reduce((s,r)=>s+r.profit,0),
  units:rows.reduce((s,r)=>s+r.units,0),items:rows.length,left:Math.max(0,left),budget:c.budget,assumed:rows.some(r=>r.costSource==='supuesto')};
 if(summary.assumed)warnings.push(`Algunos artículos no tienen precio de materiales: su coste usa un margen supuesto del ${c.assumedMarginPct} %. Escribe tus precios en la lista de compra para calcular el margen real.`);
 if(summary.left>c.budget*.15&&rows.length)warnings.push(`Sobran ${fmt(summary.left)} de silver: sube el % del volumen, añade ramas o permite más artículos.`);
 if(!rows.length&&!demand.length)warnings.push('No hay datos de demanda del Mercado Negro.');
 return {config:c,rows,shopping,summary,warnings,rejected,candidates:cands.length};
}
const fmt=n=>Math.round(num(n)*10)/10>=1000?Math.round(num(n)).toLocaleString('es-ES'):(Math.round(num(n)*10)/10).toLocaleString('es-ES');
