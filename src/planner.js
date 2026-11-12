// MOTOR NUEVO v1 · Simulación pura a partir de historial + precios observados.
// Nunca fabrica recetas ni demanda, ni llena presupuesto mediante pérdidas esperadas.
import {purchaseQuote,freshestQuotes} from './market.js';
import {MARKETS,variant} from './branches.js';
import {trafficSignal,marketKey} from './market-intelligence.js';
import {optimizePortfolio,estimateRoute,grossSale} from './portfolio-engine.js';
import {bookEntry,offersAnyQuality,unitsBelow,depthUnits,walkBids} from './orderbook.js';
import {demandSignals} from './demand-signals.js';
import {journalValue,qualityExtraPerUnit,QUALITY_PROBS_DEFAULT,assessPurchases,purchaseSummary} from './economics.js';
const n=x=>Number.isFinite(Number(x))?Number(x):NaN;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const positive=x=>Number.isFinite(n(x))&&n(x)>0;
const REFINED=/^T([2-8])_(METALBAR|PLANKS|CLOTH|LEATHER|STONEBLOCK)(?:_LEVEL[1-4])?(?:@([1-4]))?$/;
const FAME={2:1.5,3:7.5,4:22.5,5:90,6:270,7:645,8:1395};
export const DEFAULTS=Object.freeze({budget:10_000_000,tiers:[4,5,6,7,8],enchants:[0,1,2,3],saleDays:7,
 style:'balanced',goal:'balanced',diversify:true,useBudget:false,volume:false,bonusCity:true,dailyBonus:0,
 focus:false,focusPerCraft:0,focusAvailable:0,focusBonus:59,premium:true,trendAnalysis:true,tax:4,listingFee:2.5,
 stationFee:0,maxQuoteHours:48,buyBufferPct:8,sellHaircutPct:2,minRoiPct:5,
 purchaseMode:'best-royal',inboundTransportPerUnit:0,includeCaerleonPurchases:false,craftFallbackCity:'Lymhurst',
 maxCapitalSharePct:40,maxTierSharePct:72,maxEnchantSharePct:78,maxFamilySharePct:68,maxMarketSharePct:100,stressGuard:true,deliveryCostPerUnit:0,historyPriceCapPct:10,fameLossBudgetPct:10,marketSignals:true,
 journalProfit:true,qualityBonus:false,qualityProbs:[...QUALITY_PROBS_DEFAULT],focusDiscountPct:0,focusEfficiency:0});
export function settings(cfg={}){const c={...DEFAULTS,...cfg};
 if(!Number.isSafeInteger(n(c.budget))||n(c.budget)<1000||n(c.budget)>1e12)throw Error('Presupuesto: entero entre 1.000 y un billón de silver.');
 if(!Array.isArray(c.tiers)||!c.tiers.length||c.tiers.some(x=>![4,5,6,7,8].includes(Number(x))))throw Error('Selecciona al menos un Tier válido.');
 if(!Array.isArray(c.enchants)||!c.enchants.length||c.enchants.some(x=>![0,1,2,3,4].includes(Number(x))))throw Error('Selecciona al menos un encantamiento válido.');
 if(![0,10,20].includes(Number(c.dailyBonus)))throw Error('Bono diario: 0%, 10% o 20%.');
 if(!['prudent','balanced','dynamic'].includes(c.style)||!['silver','balanced','fame'].includes(c.goal))throw Error('Estilo u objetivo inválido.');
 if(![1,3,7,14,30].includes(Number(c.saleDays)))throw Error('Horizonte de venta no válido.');
 if(![c.tax,c.listingFee,c.stationFee,c.maxQuoteHours,c.buyBufferPct,c.sellHaircutPct,c.minRoiPct,c.maxCapitalSharePct,c.deliveryCostPerUnit,c.inboundTransportPerUnit,c.historyPriceCapPct,c.fameLossBudgetPct,c.maxTierSharePct,c.maxEnchantSharePct,c.maxFamilySharePct,c.maxMarketSharePct].every(x=>Number.isFinite(n(x))&&n(x)>=0))throw Error('Comisiones y costes inválidos.');
 if(c.tax>30||c.listingFee>30||c.maxQuoteHours>168||c.maxQuoteHours<1||c.buyBufferPct>50||c.sellHaircutPct>30||c.minRoiPct>100||c.maxCapitalSharePct>100||c.maxCapitalSharePct<5||c.historyPriceCapPct>100||c.fameLossBudgetPct>30||[c.maxTierSharePct,c.maxEnchantSharePct,c.maxFamilySharePct,c.maxMarketSharePct].some(x=>Number(x)<10||Number(x)>100))throw Error('Límites de comisiones o vigencia inválidos.');
 if(!['best-royal','craft-city'].includes(c.purchaseMode)||!['Bridgewatch','Fort Sterling','Lymhurst','Martlock','Thetford','Caerleon'].includes(c.craftFallbackCity))throw Error('Configura un modo de compra y ciudad de fabricación válidos.');
 if(c.focus&&(!positive(c.focusAvailable)||!Number.isFinite(n(c.focusBonus))||n(c.focusBonus)<0||!(Number(c.focusDiscountPct)>=0&&Number(c.focusDiscountPct)<100)||(n(c.focusPerCraft)<0)))throw Error('Para activar Focus indica tu Focus disponible y el bono de producción. El coste de Focus por artículo se toma del juego; «Focus/craft» solo se usa si la receta no lo trae.');
 if(!Array.isArray(c.qualityProbs)||c.qualityProbs.length!==5||c.qualityProbs.some(x=>!(Number(x)>=0&&Number(x)<=1)))c.qualityProbs=[...QUALITY_PROBS_DEFAULT];
 return c;
}
/** Coste de Focus real: el del juego se reduce a la mitad por cada 10.000 puntos de eficiencia de Focus (FCE). */
export function focusCostFactor(c={}){const fce=Math.max(0,Math.min(100000,Number(c.focusEfficiency)||0));return Math.pow(.5,fce/10000)*(1-Math.max(0,Math.min(99,Number(c.focusDiscountPct)||0))/100);}
export function returnRate({bonusCity=true,recipe={},dailyBonus=0,focus=false,focusBonus=59}={}){
 const daily=recipe.dailyEnabled===false?0:Number(dailyBonus)||0;
 const bonus=18+(bonusCity&&recipe.city&&recipe.specialtyEnabled!==false?Number(recipe.specialtyBonus??15):0)+daily+(focus?Number(focusBonus):0);
 return {productionBonus:bonus,returnPct:100*bonus/(100+bonus)};
}
export function estimatedFame(id,recipe,premium=true){
 if(Number.isFinite(Number(recipe?.fame))&&Number(recipe.fame)>0)return {value:Number(recipe.fame)*(premium?1.5:1),estimated:false};
 let total=0,count=0,other=0;
 for(const m of recipe?.materials||[]){const found=String(m.id).match(REFINED);if(!found){other++;continue;}
  const level=Number(found[3]||m.id.match(/_LEVEL([1-4])/)?.[1]||0),tier=Number(found[1]);
  total+=(FAME[tier]||0)*Math.pow(2,level)*Number(m.count||0);count++;
 }
 return count&&total>0?{value:total*(premium?1.5:1),estimated:true,unverifiedMaterials:other}:null;
}
export function journalEstimate(id,fame,qty=1){if(!fame?.value)return null;
 const v=variant(id);if(!v||v.tier<4)return null;
 const stem=id.replace(/^T\d+_/,'');const type=stem.startsWith('MAIN_')||stem.startsWith('2H_')||/^(?:ARMOR|HEAD|SHOES|OFF|CAPE|BAG)/.test(stem);
 if(!type||stem.startsWith('2H_TOOL_'))return null;
 const prefix=/(?:MACE|AXE|SWORD|HAMMER|PLATE|CROSSBOW)/.test(stem)?'WARRIOR':/(?:BOW|SPEAR|DAGGER|LEATHER|QUARTERSTAFF)/.test(stem)?'HUNTER':/(?:CLOTH|FIRE|FROST|HOLY|NATURE|CURSED|ARCANE)/.test(stem)?'MAGE':'TOOLMAKER';
 const cap={4:3600,5:7200,6:14400,7:28380,8:58590}[v.tier];
 return {id:`T${v.tier}_JOURNAL_${prefix}_EMPTY`,name:{WARRIOR:'Diario de guerrero',HUNTER:'Diario de cazador',MAGE:'Diario de mago',TOOLMAKER:'Diario de fabricante'}[prefix],
  fractional:fame.value*qty/cap,estimated:true,source:'fama calculada a partir de recursos; capacidad de referencia, NO diario verificado del juego'};
}
// Ranking combines all qualities. Craft planning always trades quality 1.
// Fallback to legacy fixture values only when quality-specific data was not supplied.
export function gradeOneDaily(h){return h?.quality1DailyUnits??h?.averageDailyUnits??0;}
export function gradeOneDays(h){return h?.quality1ActiveDays??h?.activeDays??0;}
function observationCheck(history,config){
 if(!history||!(gradeOneDaily(history)>0)||!(gradeOneDays(history)>=1))return false;
 return config.diversify||config.goal==='fame'||config.style==='dynamic'||gradeOneDays(history)>=Math.min(2,history.days||7);
}
// v2.0.1: el estilo decide UNA sola vez qué parte de la actividad Q1 puedes cubrir.
// El impacto de precio es una propiedad del mercado, no del estilo: mismo coeficiente para todos.
export const MARKET_IMPACT=0.75;
export const JOURNAL_CAP_SHARE=0.25;
// Parte de las pujas rentables del Mercado Negro (vistas ahora) que el lote puede ocupar, según estilo.
export const BOOK_SHARE=Object.freeze({prudent:.5,balanced:.8,dynamic:1});
export const DEMAND_SHARE=Object.freeze({prudent:.06,balanced:.12,dynamic:.23});
// Un lote mínimo de 1 craft solo se admite si no supera esta parte de la actividad Q1 del horizonte.
export const MIN_LOT_MAX_SHARE=Object.freeze({prudent:.12,balanced:.18,dynamic:.25});
export function demandUnits(history){return Number(history?.effectiveQuality1DailyUnits??gradeOneDaily(history))||0;}
export function maxCraftByDemand(history,amount,config){
 const fraction=DEMAND_SHARE[config.style]??DEMAND_SHARE.balanced;
 const volumeFraction=config.volume?Math.min(.30,fraction*1.35):fraction;
 const reliability=trafficSignal(history).confidence;
 const horizon=demandUnits(history)*Number(config.saleDays);
 const units=horizon*volumeFraction*reliability;
 const byDemand=Math.floor(units/amount+1e-9);
 if(byDemand>=1)return Math.min(250,byDemand);
 // Diversidad/fama pueden pedir 1 craft en rutas finas, pero nunca si ese craft satura el destino.
 const allowMinimum=(config.diversify||config.goal==='fame')&&horizon>0&&amount/horizon<=(MIN_LOT_MAX_SHARE[config.style]??.18);
 return allowMinimum?1:0;
}
function deriveImpact(history,units,config){
 const share=units/Math.max(1,demandUnits(history)*Number(config.saleDays));
 return clamp(share*MARKET_IMPACT,0,.33);
}
function realMaterials(recipe,quotes,config,now){
 const craftCity=config.bonusCity&&recipe.city?recipe.city:config.craftFallbackCity;
 let gross=0,net=0,missing=[],materials=[];
 const rr=returnRate({...config,recipe}).returnPct/100;
 for(const m of recipe.materials||[]){const count=Number(m.count);if(!m.id||!(count>0)||!Number.isFinite(count)){missing.push(m.id||'Material inválido');continue;}
  const quote=purchaseQuote(quotes,m.id,craftCity,config,now);
  if(!quote){missing.push(m.id);continue;}
  const back=m.ret===false?0:Math.min(count*rr,Number.isFinite(Number(m.maxReturn))&&m.maxReturn!==null?Number(m.maxReturn):Infinity);
  gross+=count*quote.landedUnitPrice;net+=(count-back)*quote.landedUnitPrice;
  materials.push({id:m.id,count,returned:back,netCount:count-back,price:quote.unitPrice,landedUnitPrice:quote.landedUnitPrice,transportPerUnit:quote.transportPerUnit,craftCity,city:quote.city,
   savingsVsCraftCity:quote.savingsVsCraftCity,riskRoute:quote.riskRoute,observedAt:new Date(quote.time).toISOString()});
 }
 return {gross,net,missing,materials};
}
export function buildCandidates({top=[],recipes={},quotes=new Map(),config={},selectedIds=[],selectedMarkets=[],qualityBidMap=null,orderbook=null,now=Date.now()}={}){
 const c=settings(config),allowed=new Set(selectedIds),markets=new Set(selectedMarkets),candidates=[],rejectedSamples=[],rejected={
  fueraFiltros:0,sinReceta:0,sinHistorial:0,sinPrecioVenta:0,sinPrecioMaterial:0,margenNegativo:0,sinCupo:0,fueraPresupuesto:0};
 // Save concrete exclusions: a T8 with 18 weekly units must not disappear silently.
 const record=(h,category,reason)=>{rejected[category]++;if(rejectedSamples.length<350)rejectedSamples.push({id:h.id,city:h.city,code:category,reason,
  q1UnitsDaily:gradeOneDaily(h),allQualitiesDaily:h.averageDailyUnits||0});};
 // One statistical row per item+city; history groups qualities 1–5, sale quote quality 1 only.
 for(const raw of top){if(!markets.has(raw.city)||allowed.size&&!allowed.has(raw.id))continue;
  // v2.1: la serie diaria Q1 puede reducir (nunca ampliar) la demanda y el precio usados.
  const signals=c.marketSignals===false?null:demandSignals(raw);
  const h=signals?{...raw,demandSignals:signals,effectiveQuality1DailyUnits:Math.min(Number(raw.effectiveQuality1DailyUnits??gradeOneDaily(raw)),signals.demandDaily)}:raw;
  const variantInfo=variant(h.id);if(!variantInfo||!c.tiers.map(Number).includes(variantInfo.tier)||!c.enchants.map(Number).includes(variantInfo.ench)){record(h,'fueraFiltros','Tier o encantamiento no seleccionado');continue;}
  const recipe=recipes[h.id];if(!recipe||!Array.isArray(recipe.materials)||!recipe.materials.length){record(h,'sinReceta','No hay receta verificable');continue;}
  if(!observationCheck(h,c)){record(h,'sinHistorial','Sin actividad suficiente de calidad 1 en este destino');continue;}
  const mode=h.city==='Black Market'?'bid':'ask';const sale=freshestQuotes(quotes,h.id,h.city,mode,c.maxQuoteHours,now)[0];
  if(!sale){record(h,'sinPrecioVenta','No hay cotización de venta Q1 vigente');continue;}
  const mats=realMaterials(recipe,quotes,{...c,focus:false},now);if(mats.missing.length){record(h,'sinPrecioMaterial',`Faltan precios de recursos: ${mats.missing.slice(0,3).join(', ')}`);continue;}
  const amount=Number(recipe.amountCrafted||recipe.amount||1);if(!Number.isSafeInteger(amount)||amount<1){record(h,'sinReceta','Salida por craft sin confirmar');continue;}
  // v2.5: diarios llenos como ganancia. Comprar el vacío suma capital; venderlo lleno reduce el coste neto.
  const craftCity=c.bonusCity?(recipe.city||c.craftFallbackCity):c.craftFallbackCity;
  const fame=estimatedFame(h.id,recipe,c.premium);
  const journal=c.journalProfit===false?null:journalValue({quotes,journal:journalEstimate(h.id,fame,1),craftCity,config:c,now});
  // Tope prudente: los diarios nunca cuentan más del 25 % de la venta del objeto, para que el plan
  // siga guiado por la demanda del objeto y no por un mercado de diarios cuya profundidad no se verifica.
  const journalCap=sale.price*amount*JOURNAL_CAP_SHARE;
  const journalGain=journal?.valuePerCraft>0?Math.min(journal.valuePerCraft,journalCap):0,journalCapital=journalGain>0?journal.emptyCostPerCraft:0;
  if(journal&&journal.valuePerCraft>journalCap)journal.capped=true;
  const fixed=Number(c.stationFee)+amount*Number(c.deliveryCostPerUnit),buffer=1+Number(c.buyBufferPct)/100;
  const gross=mats.gross*buffer+Number(c.stationFee)+journalCapital,
   net=mats.net*buffer+fixed-journalGain;
  // v2.5: Focus por artículo. El coste base sale del juego (craftingfocus) con tu descuento de especialización.
  const focusPoints=positive(recipe.focusPerCraft)?Number(recipe.focusPerCraft)*focusCostFactor(c):positive(c.focusPerCraft)?Number(c.focusPerCraft):0;
  const matsFocus=c.focus&&focusPoints>0?realMaterials(recipe,quotes,{...c,focus:true},now):null;
  const netFocus=matsFocus&&!matsFocus.missing.length?matsFocus.net*buffer+fixed-journalGain:null;
  if(!(gross>0)||gross>c.budget){record(h,'fueraPresupuesto','Un craft supera el capital disponible');continue;}
  // v2.6: libro de órdenes (si el recolector de GitHub lo ha publicado y es reciente).
  const book=orderbook?.available?bookEntry(orderbook,h.id,h.city,1,now):null;
  const bookBids=h.city==='Black Market'&&book?.r?.length?book.r:null;
  const competitors=h.city!=='Black Market'&&orderbook?.available?offersAnyQuality(orderbook,h.id,h.city,now):null;
  let upper=maxCraftByDemand(h,amount,c),bookNote=null;
  if(bookBids){
   // Pujas reales por encima del punto de equilibrio: se pueden vender ya mismo.
   const fee=(Number(c.tax))/100,breakEven=(netFocus!==null?Math.min(net,netFocus):net)/amount/((1-fee)*(1-Number(c.sellHaircutPct)/100));
   const profitableUnits=depthUnits(bookBids,breakEven),byBook=Math.min(250,Math.floor(profitableUnits*(BOOK_SHARE[c.style]??.8)/amount));
   if(byBook>upper){bookNote={raisedFrom:upper,to:byBook};upper=byBook;}
  }
  let competitionUnits=0;
  if(competitors?.length){competitionUnits=unitsBelow(competitors,sale.price);
   if(competitionUnits>0){const horizon=demandUnits(h)*Number(c.saleDays),free=Math.max(0,horizon-competitionUnits);
    const fraction=(c.volume?Math.min(.30,(DEMAND_SHARE[c.style]??.12)*1.35):(DEMAND_SHARE[c.style]??.12))*trafficSignal(h).confidence;
    const byCompetition=Math.floor(free*fraction/amount+1e-9);
    if(byCompetition<upper){if(byCompetition<1){record(h,'sinCupo',`Competencia: ${competitionUnits} u. ya publicadas a tu precio o menos cubren la actividad Q1 de ${c.saleDays} días`);continue;}upper=byCompetition;}}}
  if(upper<1){const share=amount/Math.max(1e-9,demandUnits(h)*Number(c.saleDays))*100;record(h,'sinCupo',`Un solo craft cubriría ${share.toFixed(0)}% de la actividad Q1 de ${c.saleDays} días: saturaría el destino`);continue;}
  const marketFee=(Number(c.tax)+ (h.city==='Black Market'?0:Number(c.listingFee)))/100;
  // Prevent a one-off quote spike from being accepted as an executable clearing price.
  // Qualities must match: history Q1 for selling Q1. Q2-5 do not influence the cap.
  const baseQ1=Number(h.stabilizedQuality1Price??h.quality1AveragePrice)||0,recentQ1=Number(signals?.recentPrice)||0;
  // Si el precio Q1 de los últimos 3 días está por debajo del de la ventana, se planifica con el reciente.
  const histQ1=baseQ1>0&&recentQ1>0?Math.min(baseQ1,recentQ1):baseQ1||recentQ1;
  const cap=histQ1>0?histQ1*(1+Number(c.historyPriceCapPct)/100):sale.price;
  const basePlanningPrice=Math.min(sale.price,cap);
  // v2.5 (opcional): extra esperado en Mercado Negro por piezas de calidad 2–5.
  const qualityExtra=c.qualityBonus&&h.city==='Black Market'?qualityExtraPerUnit(qualityBidMap?.get(h.id),basePlanningPrice,c.qualityProbs):0;
  const planningPrice=basePlanningPrice+qualityExtra;
  const oneCraft=grossSale({planningPrice,history:h,bookBids},amount,c);
  const salePerCraft=oneCraft.gross*(1-Number(c.sellHaircutPct)/100);
  const impactOne=Math.max(0,oneCraft.impact);const priceNet=salePerCraft*(1-marketFee);
  const profit=priceNet-(netFocus!==null?Math.min(net,netFocus):net);
  const roi=profit/gross*100;
  const stressProfit=priceNet*.9-net;
  const fameMode=c.goal==='fame';
  // Fama permite rutas a pérdida controlada; silver/equilibrado nunca.
  if((!fameMode&&(!(profit>0)||roi<Number(c.minRoiPct)||(c.stressGuard&&!c.diversify&&stressProfit<0)))
   ||(fameMode&&(roi<-25 || (profit<0&&Number(c.fameLossBudgetPct)===0)))){
    record(h,'margenNegativo',fameMode?'Pérdida por craft supera 25% del capital o límite de pérdida desactivado':'Beneficio / ROI / estrés insuficiente');continue;
  }
  const row={id:h.id,city:h.city,routeKey:marketKey(h.id,h.city),evidenceSource:h.evidenceSource||'AODP History Q1',confidence:trafficSignal(h).confidence,craftCity,
   maxCrafts:upper,craftAmount:amount,history:h,trend:h.trend||'sin referencia',trendRatio:h.trendRatio??null,demandSignals:signals,returnPct:returnRate({...c,focus:false,recipe}).returnPct,
   grossCapitalPerCraft:gross,expectedCostPerCraft:net,materials:mats.materials,marketQuote:sale.price,planningPrice,historyQuality1Price:histQ1||null,
   saleObservedAt:new Date(sale.time).toISOString(),marketFee,priceImpactPct:impactOne*100,
   estimatedProfitPerCraft:profit,stressProfitPerCraft:stressProfit,expectedFamePerCraft:fame?.value||0,
   fameEstimated:!!fame?.estimated,qty:0,
   // Focus opcional por craft: el motor decide cuántos crafts lo usan.
   focusPerCraft:netFocus!==null?focusPoints:0,costWithFocus:netFocus,materialsFocus:netFocus!==null?matsFocus.materials:null,
   returnPctFocus:netFocus!==null?returnRate({...c,focus:true,recipe}).returnPct:null,focusFromGame:positive(recipe.focusPerCraft),
   journal:journal&&journalGain>0?journal:null,journalMissing:journal&&!(journalGain>0)?journal:null,journalGainPerCraft:journalGain,
   basePlanningPrice,qualityExtraPerUnit:qualityExtra,
   bookBids,bookAgeHours:book?.ageHours??null,bookDepth:bookBids?depthUnits(bookBids):null,bookFills:book?.f||null,bookNote,competitionUnits};
  candidates.push(row);
 }
 return {candidates,rejected,rejectedSamples,config:c};
}
function score(r,c){
 const roi=r.estimatedProfitPerCraft/Math.max(1,r.grossCapitalPerCraft),silver=r.estimatedProfitPerCraft;
 const fame=r.expectedFamePerCraft/Math.max(1,r.grossCapitalPerCraft);
 const active=(r.history.quality1ActiveDays??r.history.activeDays??1)/Math.max(1,r.history.days||7);
 const historyWeight=.75+.25*Math.max(0,Math.min(1,active));
 if(c.goal==='fame'){
  // Fama real/estimada por silver consumido. Los tiers altos obtienen un pequeño desempate.
  const tier=variant(r.id)?.tier||4;
  return (fame + tier*.0003 + Math.max(-.15,roi)*.004)*historyWeight;
 }
 if(c.goal==='silver')return (roi*3+Math.log1p(Math.max(0,silver))/75+fame*.002)*historyWeight;
 return (roi*3+Math.log1p(Math.max(0,silver))/110+Math.log1p(Math.max(0,fame))*.08)*historyWeight;
}
function previewLine(row,qty,c,fq=0){
 // Misma cuenta que el motor de cartera (libro de órdenes, impacto, Focus).
 const e=estimateRoute(row,qty,c,fq);return {revenue:e.revenue,cost:e.cost,profit:e.profit,stressProfit:e.stressProfit,impact:e.impact,bookUnits:e.bookUnits};
 }
/**
 * Allocation rules:
 *  - Never spend over budget or over observed Q1 demand allowance.
 *  - When diversity is on: first sample distinct selected tiers, then enchants, then items.
 *  - Use rounds rather than filling one SKU at a time to avoid market saturation.
 *  - Fame goal alone may lose silver, bounded by both per-route loss (25% of capital)
 *    and total permitted losses (fameLossBudgetPct of the initial budget).
 */
/**
 * Compra mínima para fabricar TODO el lote reutilizando el retorno.
 * Cada craft devuelve recursos que sirven para el siguiente, pero el retorno del último
 * craft ya no se usa: compra = neto + retorno de un craft (el mayor del grupo), nunca más que el bruto.
 * Es seguro en cualquier orden de fabricación. Valores esperados: el retorno real en el juego varía.
 */
export function purchaseNeeded(gross,net,lastReturn){
 return Math.min(Math.ceil(gross-1e-8),Math.ceil(net+lastReturn-1e-8));
}
export function allocatePlan({candidates=[],config={},recipes={},materialHistory=[],orderbook=null,now=Date.now()}={}){
 const c=settings(config),warnings=[],allocationNotes=[];
 const optimized=optimizePortfolio(candidates,c);
 warnings.push(...optimized.warnings);
 const selected=optimized.selected;
 const available=optimized.best.budgetLeft;
 const focusRemaining=optimized.best.focusLeft;
 const allocatedLoss=optimized.best.loss;
 const reasonFor=optimized.best.rejections;
 const routes=[...optimized.selected,...optimized.unusedRoutes];
 const fameMode=c.goal==='fame',lossCap=fameMode?c.budget*c.fameLossBudgetPct/100:0;

 const purchase=new Map(),journals=new Map();let expectedProfit=0,expectedCost=0,totalFame=0,sales=0;
 for(const line of selected){
  const fq=line.focusQty||0,q=previewLine(line,line.qty,c,fq);line.focusSpent=fq*(line.focusPerCraft||0);line.bookUnitsSold=q.bookUnits||0;line.finalImpactPct=q.impact;line.totalProfit=q.profit;
  line.stressProfit=q.stressProfit;line.totalRevenue=q.revenue;line.totalCost=q.cost;
  line.unitSaleExpected=q.revenue/(line.qty*line.craftAmount);line.totalFame=line.expectedFamePerCraft*line.qty;
  line.coverageSharePct=(line.qty*line.craftAmount/Math.max(1,Number(line.history.effectiveQuality1DailyUnits??gradeOneDaily(line.history))*Number(c.saleDays)))*100;
  expectedProfit+=line.totalProfit;expectedCost+=line.totalCost;totalFame+=line.totalFame;sales+=line.qty*line.craftAmount;
  // Con Focus, esos crafts devuelven más material: se suma su neto por separado.
  const parts=[[line.materials,line.qty-fq],...(fq>0&&line.materialsFocus?[[line.materialsFocus,fq]]:[])];
  for(const [list,crafts] of parts)for(const m of list){if(!(crafts>0))continue;const key=m.id+'|'+m.city+'|'+m.craftCity;const old=purchase.get(key)||{id:m.id,city:m.city,craftCity:m.craftCity,unitPrice:m.price,transportPerUnit:m.transportPerUnit,landedUnitPrice:m.landedUnitPrice,
    savingsVsCraftCity:m.savingsVsCraftCity,riskRoute:m.riskRoute,observedAt:m.observedAt,gross:0,net:0,lastReturn:0};
   old.gross+=m.count*crafts;old.net+=m.netCount*crafts;old.lastReturn=Math.max(old.lastReturn,m.returned);purchase.set(key,old);
  }
  const journal=journalEstimate(line.id,{value:line.expectedFamePerCraft},line.qty);
  if(journal){const j=journals.get(journal.id)||{...journal,fractional:0};j.fractional+=journal.fractional;journals.set(journal.id,j);}
 }
 const materials=assessPurchases([...purchase.values()].map(m=>{
  const gross=Math.ceil(m.gross-1e-8),buy=purchaseNeeded(m.gross,m.net,m.lastReturn);
  return {...m,buy,reuse:Math.max(0,gross-buy),buyWithBuffer:Math.ceil(buy*m.landedUnitPrice*(1+c.buyBufferPct/100))};
 }).sort((a,b)=>b.buy*b.unitPrice-a.buy*a.unitPrice),materialHistory,now,orderbook);
 const externalPurchases=materials.filter(m=>m.city!==m.craftCity);
 const purchaseCheck=purchaseSummary(materials);
 if(purchaseCheck.hard)warnings.push(`${purchaseCheck.hard} materiales necesitan más de 3 días de mercado para comprarlos: el beneficio ajustado descuenta un sobrecoste estimado.`);
 if(purchaseCheck.inflated)warnings.push(`${purchaseCheck.inflated} materiales cotizan ≥25 % por encima de su media reciente: revisa antes de comprar.`);
 if(externalPurchases.length&&c.inboundTransportPerUnit===0)warnings.push('Compras entre ciudades: el coste de transporte de materiales está configurado en 0. Añade una estimación antes de comprar.');
 if(externalPurchases.some(m=>m.riskRoute))warnings.push('Hay compras con traslado hacia o desde Caerleon: riesgo de zona roja no incluido.');
 const totalCapital=c.budget-available;
 if(totalCapital>c.budget+0.001)throw Error('Error de asignación: presupuesto excedido.');
 if(!fameMode&&selected.some(r=>r.totalProfit<=0))throw Error('Error de asignación: ruta con pérdidas en objetivo de silver.');
 if(fameMode&&allocatedLoss>lossCap+.01)throw Error('Error de asignación: límite de pérdida para fama excedido.');
 if(fameMode&&selected.some(r=>r.totalProfit<0))warnings.push(`Fama por silver: pérdida máxima autorizada ${c.fameLossBudgetPct}% del presupuesto (${Math.round(lossCap).toLocaleString('es-ES')} silver).`);
 for(const r of routes)if(!r.qty)allocationNotes.push({id:r.id,city:r.city,code:'noAsignado',reason:r.reason||reasonFor.get(r.routeKey)||'Ruta viable, pero priorizada después de otras variantes',q1UnitsDaily:gradeOneDaily(r.history),allQualitiesDaily:r.history.averageDailyUnits||0});
 return {rows:selected.sort((a,b)=>b.totalProfit-a.totalProfit),materials,allocationNotes,scenarioComparisons:optimized.solutions,exposureLimits:optimized.exposure,
  journals:[...journals.values()].map(j=>({...j,estimatedQty:Math.ceil(j.fractional-1e-8)})),
  summary:{budget:c.budget,style:c.style,goal:c.goal,diversify:c.diversify,useBudget:c.useBudget,allocationMethod:"Portfolio Engine 2.0 · tres estrategias · beneficio marginal + exposición por tiers/familias/encantamientos",capitalReserved:totalCapital,remaining:available,totalProfit:expectedProfit,totalCost:expectedCost,
   totalFame,royalPurchaseRoutes:externalPurchases.length,purchaseTransportEstimated:externalPurchases.reduce((sum,m)=>sum+m.buy*m.transportPerUnit,0),
   estimatedPurchaseSavings:externalPurchases.reduce((sum,m)=>sum+(m.savingsVsCraftCity||0)*m.buy,0),units:sales,crafts:selected.reduce((s,x)=>s+x.qty,0),focusSpent:c.focus?c.focusAvailable-focusRemaining:0,
   roiOnCapital:totalCapital?expectedProfit/totalCapital*100:0,
   journalValue:selected.reduce((s,r)=>s+(r.journalGainPerCraft||0)*r.qty,0),
   qualityExtra:selected.reduce((s,r)=>s+(r.qualityExtraPerUnit||0)*r.qty*r.craftAmount*(1-r.marketFee),0),
   purchaseExtraCost:purchaseCheck.extraCost,purchaseHard:purchaseCheck.hard,purchaseLarge:purchaseCheck.large,purchaseInflated:purchaseCheck.inflated,
   profitAfterPurchases:expectedProfit-purchaseCheck.extraCost,focusCrafts:selected.reduce((s,r)=>s+(r.focusQty||0),0),allowedFameLoss:lossCap,estimatedLosses:selected.reduce((s,r)=>s+Math.max(0,-r.totalProfit),0)},warnings};
}

// Calculadora individual, sin filtro por beneficio: muestra incluso una pérdida.
export function simulateItem({id,city,qty=1,recipes={},quotes=new Map(),history,config={},now=Date.now()}={}){
 const c=settings(config),recipe=recipes[id];
 if(!recipe?.materials?.length)throw Error('La receta de este artículo no está disponible.');
 const amount=Number(recipe.amountCrafted||recipe.amount||1),count=Number(qty);
 if(!Number.isSafeInteger(count)||count<1||count>100000)throw Error('Número de crafts inválido (1–100.000).');
 if(!Number.isSafeInteger(amount)||amount<1)throw Error('La cantidad de salida de la receta no está verificada.');
 const materials=realMaterials(recipe,quotes,c,now);
 if(materials.missing.length)throw Error('Materiales sin cotización válida: '+materials.missing.slice(0,7).join(', '));
 const sale=freshestQuotes(quotes,id,city,city==='Black Market'?'bid':'ask',c.maxQuoteHours,now)[0];
 if(!sale)throw Error('No existe cotización reciente de venta para '+city+'.');
 const units=count*amount;
 const impact=history?deriveImpact(history,units,c):0;
 const fee=(Number(c.tax)+(city==='Black Market'?0:Number(c.listingFee)))/100;
 const grossRevenue=units*sale.price*(1-fee)*(1-impact);
 const cost=(materials.net+Number(c.stationFee))*count;
 const capital=(materials.gross+Number(c.stationFee))*count;
 return {id,city,qty:count,units,price:sale.price,observedAt:new Date(sale.time).toISOString(),
  grossRevenue,cost,capital,profit:grossRevenue-cost,roi:capital?(grossRevenue-cost)/capital*100:0,
  impactPercent:impact*100,returnPct:returnRate({...c,recipe}).returnPct,materials:materials.materials,
  fame:estimatedFame(id,recipe,c.premium),historical:!!history};
}
