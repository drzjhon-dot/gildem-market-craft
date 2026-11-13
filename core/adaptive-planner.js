// Planificador de rotación paciente. Requiere márgenes calculables y positivos,
// pero NO confunde pocos registros de AODP con imposibilidad de vender.
// Los números de item_count son actividad observada, no ventas verificadas.
import {listingCapacity} from './demand-first.js';
const number=(x,d=0)=>Number.isFinite(Number(x))?Number(x):d;

export function patientCapacity(route,{maxPerRoute=6000,observedShare=.06,horizonDays=14}={}){
 return listingCapacity(route,{maxPerRoute,share:observedShare,horizonDays,unknownCap:1});
}

export function selectPatientRoutes(routes,{budget=Infinity,limit=350,horizonDays=14,observedShare=.06}={}){
 const accepted=[],rejected=[];
 for(const original of routes||[]){
  if(!original?.id||!original?.city)continue;
  const capital=number(original.capitalPerUnit),profit=number(original.profit);
  if(!(capital>0&&number(original.cost)>0&&number(original.sell)>0&&profit>0)){
   rejected.push({id:original.id,city:original.city,reason:'Sin precio o profit neto positivo'});continue;
  }
  if(Number.isFinite(budget)&&capital>budget){rejected.push({id:original.id,city:original.city,reason:'El presupuesto no cubre una unidad'});continue;}
  if(!Number.isFinite(original.ageHours)||original.ageHours<0||original.ageHours>72){
   rejected.push({id:original.id,city:original.city,reason:'Cotización sin fecha o más antigua que 72 h'});continue;
  }
  if(original.mode==='instant'&&original.city==='Black Market'&&(!original.depthVerified||number(original.marketCapacity)<=0)){
   rejected.push({id:original.id,city:original.city,reason:'Sin orden de compra inmediata verificable'});continue;
  }
  const capacity=patientCapacity(original,{horizonDays,observedShare});
  if(capacity<1){rejected.push({id:original.id,city:original.city,reason:'Sin capacidad para una venta inmediata'});continue;}
  const warnings=[];
  if(!original.activity?.observations)warnings.push('Sin historial observable: una unidad de prueba');
  else if(number(original.activity.observedDaily)<1)warnings.push('Actividad baja: la venta podría tardar varios días');
  if(number(original.stressProfit,0)<=0)warnings.push('Margen negativo si cae el precio o suben los materiales');
  if(number(original.ageHours)>24)warnings.push('Cotización anterior a 24 horas: comprobar de nuevo');
  if(original.city==='Black Market')warnings.push('El precio del NPC no garantiza ejecución de la orden publicada');
  if(original.competition?.known&&number(original.competition.unitsAhead)>0)warnings.push('Hay anuncios de otros vendedores por delante');
  if(!original.competition?.known&&original.city!=='Black Market')warnings.push('Competencia Royal no verificada');
  if(original.stationCost===0)warnings.push('Tarifa de fabricación configurada en cero');
  const reference=number(original.activity?.medianPrice)||number(original.activity?.avgPrice);
  if(reference>0&&original.sell>reference*1.15)warnings.push('Precio de venta anunciado por encima de la referencia histórica');
  // Almacenar el límite de la fase paciente en marketCapacity. Se trata de
  // una capacidad PROVISIONAL, no de una profundidad instantánea del libro.
  accepted.push({...original,marketCapacity:Math.min(capacity,Number.isFinite(original.hardMarketCapacity)?original.hardMarketCapacity:capacity),
   patientPlan:true,patientWarnings:warnings,liquidityStatus:warnings.length?'provisional':'lenta',
   expectedSaleDays:null});
 }
 // Índice mixto: prioriza margen positivo y actividad, sin exigir unidades/día.
 accepted.sort((a,b)=>{
  const score=x=>number(x.profit)/Math.max(1,number(x.capitalPerUnit))*Math.max(.25,Math.min(1,number(x.confidence?.score,40)/100))
    *(.72+.60*Math.min(1,Math.log1p(number(x.demandDaily??x.activity?.observedDaily))/Math.log1p(1000)));
  return score(b)-score(a);
 });
 return {accepted:accepted.slice(0,Math.max(1,limit)),rejected};
}

export function suggestedResearchPlan(ids,recipes,priceMap,inputs,{quoteFn,costFn,findPrice,historyByCity=new Map(),maxItems=8}={}){
 if(!quoteFn||!costFn||!findPrice)return [];
 const markets=inputs.market==='black'?['Black Market']:(inputs.cities||[]);
 const results=[];
 for(const id of ids||[]){
  const recipe=recipes[id];if(!recipe?.materials?.length||!recipe.city)continue;
  const craftCity=recipe.city;
  const rate=inputs.returnRateFor?inputs.returnRateFor(recipe,craftCity):24.8;
  const cost=costFn(recipe,materialId=>findPrice(materialId,craftCity),rate,Number(inputs.station)||0);
  const capital=cost?.rawMaterials||null;
  if(capital!=null&&capital>inputs.budget)continue;
  const perBatch=Math.max(1,Number(recipe.amountCrafted)||1);
  for(const city of markets){
   const referenceSide=city==='Black Market'?'buy_price_max':'sell_price_min';
   const q=quoteFn(priceMap,id,city,referenceSide,72);
   const tax=(city==='Black Market'?inputs.bmTax:inputs.royalTax)+inputs.listingFee;
   const target=cost?Math.ceil((cost.total+Number(inputs.transport||0))*1.03/(perBatch*Math.max(.1,1-tax/100))):null;
   const series=historyByCity.get(id+'|'+city)||[];
   const obs=series.reduce((sum,r)=>sum+Math.max(0,Number(r.item_count)||0),0);
   results.push({id,craftCity,city,qty:1,capital,target,reference:q?.price||null,ageHours:q?.ageHours??null,
    observed:obs,ready:!!(target&&q?.price>=target),missing:!cost?'Precios incompletos de materiales':!q?'Sin cotización de venta':'Precio por debajo de objetivo'});
  }
 }
 results.sort((a,b)=>Number(b.ready)-Number(a.ready)||b.observed-a.observed||Number(b.reference||0)-Number(a.reference||0));
 const out=[],seen=new Set();for(const r of results){if(seen.has(r.id))continue;seen.add(r.id);out.push(r);if(out.length>=maxItems)break;}
 return out;
}
