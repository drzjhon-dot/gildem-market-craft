import {purchaseComponents} from './refining-integration.js';
// Gildem Craft Pro · Cartera inteligente v8.6.5.
// Balancea la exposición SIN confundir actividad observada con ventas ejecutadas.
const positive = v => Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0;
export const marketKey = (id, city) => `${id}|${city}`;

// Solo los lotes INICIADOS se consideran stock real pendiente. Los planes
// guardados sin marcar como ejecutados no son inventario físico.
export function pendingUnitsByMarket(portfolios = []) {
 const pending = new Map();
 for (const portfolio of portfolios || []) {
  if (!portfolio || portfolio.started !== true) continue;
  for (const lot of portfolio.lots || []) {
   if (!lot?.id || !lot?.market) continue;
   const sold = (lot.sales || []).reduce((n, sale) => n + positive(sale.qty), 0);
   const remaining = Math.max(0, Math.floor(positive(lot.qty) - sold));
   const key = marketKey(lot.id, lot.market);
   if (remaining) pending.set(key, (pending.get(key) || 0) + remaining);
  }
 }
 return pending;
}

export function pendingAdjustedCapacity(route, baseCapacity, pending = new Map()) {
 const stock = positive(pending?.get?.(marketKey(route.id, route.city)));
 const unitsPerCraft = Math.max(1, positive(route.craftAmount) || 1);
 return Math.max(0, Math.floor(positive(baseCapacity) - Math.ceil(stock / unitsPerCraft)));
}

// No es un límite del mercado. Define cuánto capital autoriza a inmovilizar el
// usuario en esta cartera antes de una nueva verificación.
export function investmentBudget(budget, { reservePercent = 0 } = {}) {
 const gross = positive(budget), fraction = Math.min(.50, Math.max(0, positive(reservePercent) / 100));
 const spendable = Math.floor(gross * (1 - fraction));
 return { gross, spendable, reserve: gross - spendable, reservePercent: fraction * 100 };
}

// Las ofertas se evalúan por tramos de precio. No suponer que miles de materiales
// cuestan lo mismo que el primer stack de venta. No se imputan cantidades ausentes.
export function weightedPurchaseQuote(levels = [], quantity = 0, { maxUnitPrice = Infinity, useFraction = 1 } = {}) {
 const requested = Math.floor(positive(quantity));
 const fraction = Math.min(1, Math.max(0, positive(useFraction)));
 const ordered = [...(levels || [])].filter(l => positive(l.price) > 0 && positive(l.amount) > 0)
  .sort((a,b) => a.price-b.price);
 let filled = 0, cost = 0, highest = null;
 for (const level of ordered) {
  if (level.price > maxUnitPrice) break;
  const available = Math.floor(positive(level.amount) * fraction);
  const take = Math.min(requested - filled, available);
  if (take < 1) continue;
  filled += take;cost += take * level.price;highest=level.price;
  if (filled >= requested) break;
 }
 return { requested, filled, complete: filled >= requested, missing: requested - filled,
  cost, averageUnitPrice: filled ? cost / filled : null, highestUnitPrice: highest };
}

export function materialDepthAssessment(materials = [], sellLevels = new Map(), { reserveAllowance = 0, profitAllowance = 0, useFraction = .60 } = {}) {
 const grossCost = materials.reduce((sum,m) => sum + positive(m.qtyGross) * positive(m.unitPrice), 0);
 const extra = Math.max(0, Math.min(positive(reserveAllowance), positive(profitAllowance)));
 const rows = [];
 for (const m of materials) {
  const needed = Math.ceil(positive(m.qtyGross)), quoted = positive(m.unitPrice);
  const quota = grossCost ? extra * (needed * quoted) / grossCost : 0;
  const ceiling = quoted + (needed ? quota / needed : 0);
  const levels = sellLevels.get(marketKey(m.id,m.city)) || [];
  const evaluated = weightedPurchaseQuote(levels,needed,{maxUnitPrice:ceiling,useFraction});
  const hasBook = levels.length > 0;
  rows.push({id:m.id,city:m.city,qty:needed,quotedUnitPrice:quoted,ceiling,
   ...evaluated,hasBook,estimatedExtraCost:Math.max(0,evaluated.cost - evaluated.filled*quoted),
   missingReason: !hasBook?'Sin libro de venta observable':evaluated.missing?'Oferta barata insuficiente':'Disponible en niveles observados'});
 }
 return { rows, checked: rows.filter(r=>r.hasBook).length, missing: rows.filter(r=>r.missing>0).length,
  verifiedFull:rows.length>0&&rows.every(r=>r.complete),
  firstBatchOnly:rows.some(r=>r.missing>0),totalEstimatedExtra: rows.reduce((a,r)=>a+r.estimatedExtraCost,0)};
}

// Distintos objetos primero, cantidades adicionales después. Nunca se fuerza
// diversificación inventando demanda o beneficio; si hay 3 rentables, solo 3.
export function portfolioDiversityStats(rows = [], { budget = 0, reserve = 0, pending = new Map() } = {}) {
 const items = new Map(), cities = new Map(), tiers = new Map();
 for (const row of rows) {
  const cost = positive(row.qty) * positive(row.capitalPerUnit);
  const id = row.id;
  items.set(id,(items.get(id)||0)+cost);
  cities.set(row.city,(cities.get(row.city)||0)+cost);
  const tier = String(id).match(/^T([4-8])_/)?.[1] || '?';
  tiers.set(tier,(tiers.get(tier)||0)+cost);
 }
 const committed = [...items.values()].reduce((a,b)=>a+b,0);
 return { differentItems: items.size, markets: cities.size, tiers: tiers.size,
  committed, reserve:positive(reserve), budget:positive(budget),
  maxItemExposure: committed?Math.max(0,...items.values())/committed:0,
  pendingMarkets:pending?.size||0,
  perMarket:[...cities].map(([city,capital])=>({city,capital})).sort((a,b)=>b.capital-a.capital)};
}

// Primer lote con materiales respaldados por profundidad observada. No se
// trata de stock reservado ni de órdenes realmente ejecutadas.
export function stagedMaterialNeeds(rows = []) {
 const byMaterial = new Map();
 for (const row of rows || []) {
  const full = Math.floor(positive(row.qty));
  const first = row.procurementFirstBatch == null
   ? (row.patientSupplyPending ? 0 : full)
   : Math.max(0, Math.min(full, Math.floor(positive(row.procurementFirstBatch))));
  if (!first) continue;
  for (const mat of row.materials || []) {
   // Refinado expandido a sus materias primas exactamente como en el plan.
   for (const p of purchaseComponents(mat)) {
    const id = p.id, city = p.city || mat.city;
    if (!id || !city || !(positive(p.count) > 0)) continue;
    const key = marketKey(id,city),previous = byMaterial.get(key)||{
     id,city,qty:0,unitPrice:positive(p.originalPrice)||positive(p.unitPrice)||positive(mat.unitPrice)
    };
    previous.qty += first * positive(p.count);
    byMaterial.set(key,previous);
   }
  }
 }
 return [...byMaterial.values()].sort((a,b)=>a.city.localeCompare(b.city)||a.id.localeCompare(b.id));
}

// Clasificación descriptiva de OBSERVACIONES, nunca una promesa de ventas.
export function observedRotation(route){
 const raw=route?.demandDaily??(route?.activity?.observations>0?route.activity.observedDaily:null);
 if(raw===null||raw===undefined||!Number.isFinite(Number(raw)))return {label:'Sin historial',tier:'unknown'};
 const daily=Math.max(0,Number(raw));
 if(daily>=100)return {label:'Actividad alta',tier:'high',daily};
 if(daily>=10)return {label:'Actividad media',tier:'medium',daily};
 return {label:'Actividad lenta',tier:'slow',daily};
}

export function validateIntelligentEdits(rows = [],budget,{itemFraction=.12,bulkMode=false}={}) {
 const cap=positive(budget),eachCap=cap*Math.min(.50,Math.max(.05,positive(itemFraction)));
 const totals=new Map(),cities=new Map(),tiers=new Map();let grand=0;
 for(const row of rows||[]){
  if(!Number.isSafeInteger(Number(row.qty))||Number(row.qty)<0)return {ok:false,reason:'La cantidad debe ser un entero no negativo'};
  const spend=positive(row.qty)*positive(row.capitalPerUnit);
  grand+=spend;totals.set(row.id,(totals.get(row.id)||0)+spend);
  cities.set(row.city,(cities.get(row.city)||0)+spend);
  const tier=String(row.id).match(/^T([4-8])_/)?.[1];
  if(tier)tiers.set(tier,(tiers.get(tier)||0)+spend);
 }
 if(grand>cap+.001)return {ok:false,reason:'La edición supera el presupuesto. Reduce cantidades o genera un nuevo plan.'};
 const rowFraction=new Map();
 for(const row of rows||[])if(Number.isFinite(Number(row.itemExposureFraction)))rowFraction.set(row.id,Math.max(rowFraction.get(row.id)||0,Math.min(.75,Number(row.itemExposureFraction))));
 for(const [id,spent] of totals)if(spent>Math.max(eachCap,cap*(rowFraction.get(id)||0))+.001)return {ok:false,reason:`Exposición excesiva en ${id}: máximo autorizado del capital por objeto en Cartera inteligente.`};
 if(cities.size>1){const max=cap*(bulkMode?Math.max(.72,1/cities.size+.20):Math.max(.45,1/cities.size+.12));
  if([...cities.values()].some(spent=>spent>max+.001))return {ok:false,reason:'Demasiado capital concentrado en una ciudad Royal. Reduce cantidades o regenera el plan.'};}
 if(tiers.size>1&&[...tiers.values()].some(spent=>spent>cap*(bulkMode?.85:.60)+.001))
  return {ok:false,reason:'Demasiado capital concentrado en un mismo tier. Reduce cantidades o regenera el plan.'};
 return {ok:true,committed:grand,remaining:Math.max(0,cap-grand)};
}
