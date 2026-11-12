// MOTOR NUEVO v1 · Simulación pura a partir de historial + precios observados.
// Nunca fabrica recetas ni demanda, ni llena presupuesto mediante pérdidas esperadas.
import {purchaseQuote,freshestQuotes} from './market.js';
import {MARKETS,variant} from './branches.js';
import {trafficSignal,marketKey} from './market-intelligence.js';
import {optimizePortfolio} from './portfolio-engine.js';
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
 maxCapitalSharePct:40,maxTierSharePct:72,maxEnchantSharePct:78,maxFamilySharePct:68,maxMarketSharePct:100,stressGuard:true,deliveryCostPerUnit:0,historyPriceCapPct:10,fameLossBudgetPct:10});
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
 if(c.focus&&(!positive(c.focusPerCraft)||!positive(c.focusAvailable)||!Number.isFinite(n(c.focusBonus))||n(c.focusBonus)<0))throw Error('Para activar Focus necesitas verificar consumo por craft, Focus disponible y bono de producción en la configuración.');
 return c;
}
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
function maxCraftByDemand(history,amount,config){
 const fraction={prudent:.04,balanced:.12,dynamic:.23}[config.style];
 const volumeFraction=config.volume?Math.min(.30,fraction*1.35):fraction;
 const reliability=trafficSignal(history).confidence;
 const units=Number(history?.effectiveQuality1DailyUnits??gradeOneDaily(history))*Number(config.saleDays)*volumeFraction*reliability;
 // With explicit diversity allow 1 craft where *some* history exists, not absent history.
 const minimum=(config.diversify||config.goal==='fame')&&gradeOneDaily(history)>0?1:0;
 return Math.min(250,Math.max(minimum,Math.floor(units/amount)));
}
function deriveImpact(history,units,config){
 const share=units/Math.max(1,Number(history?.effectiveQuality1DailyUnits??gradeOneDaily(history))*Number(config.saleDays));
 return clamp(share*({prudent:.45,balanced:.75,dynamic:1.1}[config.style]),0,.33);
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
export function buildCandidates({top=[],recipes={},quotes=new Map(),config={},selectedIds=[],selectedMarkets=[],now=Date.now()}={}){
 const c=settings(config),allowed=new Set(selectedIds),markets=new Set(selectedMarkets),candidates=[],rejectedSamples=[],rejected={
  fueraFiltros:0,sinReceta:0,sinHistorial:0,sinPrecioVenta:0,sinPrecioMaterial:0,margenNegativo:0,sinCupo:0,fueraPresupuesto:0};
 // Save concrete exclusions: a T8 with 18 weekly units must not disappear silently.
 const record=(h,category,reason)=>{rejected[category]++;if(rejectedSamples.length<350)rejectedSamples.push({id:h.id,city:h.city,code:category,reason,
  q1UnitsDaily:gradeOneDaily(h),allQualitiesDaily:h.averageDailyUnits||0});};
 // One statistical row per item+city; history groups qualities 1–5, sale quote quality 1 only.
 for(const h of top){if(!markets.has(h.city)||allowed.size&&!allowed.has(h.id))continue;
  const variantInfo=variant(h.id);if(!variantInfo||!c.tiers.map(Number).includes(variantInfo.tier)||!c.enchants.map(Number).includes(variantInfo.ench)){record(h,'fueraFiltros','Tier o encantamiento no seleccionado');continue;}
  const recipe=recipes[h.id];if(!recipe||!Array.isArray(recipe.materials)||!recipe.materials.length){record(h,'sinReceta','No hay receta verificable');continue;}
  if(!observationCheck(h,c)){record(h,'sinHistorial','Sin actividad suficiente de calidad 1 en este destino');continue;}
  const mode=h.city==='Black Market'?'bid':'ask';const sale=freshestQuotes(quotes,h.id,h.city,mode,c.maxQuoteHours,now)[0];
  if(!sale){record(h,'sinPrecioVenta','No hay cotización de venta Q1 vigente');continue;}
  const mats=realMaterials(recipe,quotes,c,now);if(mats.missing.length){record(h,'sinPrecioMaterial',`Faltan precios de recursos: ${mats.missing.slice(0,3).join(', ')}`);continue;}
  const amount=Number(recipe.amountCrafted||recipe.amount||1);if(!Number.isSafeInteger(amount)||amount<1){record(h,'sinReceta','Salida por craft sin confirmar');continue;}
  const gross=mats.gross*(1+Number(c.buyBufferPct)/100)+Number(c.stationFee),
   net=mats.net*(1+Number(c.buyBufferPct)/100)+Number(c.stationFee)+amount*Number(c.deliveryCostPerUnit);
  if(!(gross>0)||gross>c.budget){record(h,'fueraPresupuesto','Un craft supera el capital disponible');continue;}
  const upper=maxCraftByDemand(h,amount,c);if(upper<1){record(h,'sinCupo','Actividad Q1 insuficiente para el lote mínimo');continue;}
  const marketFee=(Number(c.tax)+ (h.city==='Black Market'?0:Number(c.listingFee)))/100;
  // Prevent a one-off quote spike from being accepted as an executable clearing price.
  // Qualities must match: history Q1 for selling Q1. Q2-5 do not influence the cap.
  const histQ1=Number(h.stabilizedQuality1Price??h.quality1AveragePrice)||0;
  const cap=histQ1>0?histQ1*(1+Number(c.historyPriceCapPct)/100):sale.price;
  const planningPrice=Math.min(sale.price,cap);
  const salePerCraft=planningPrice*amount*(1-Number(c.sellHaircutPct)/100);
  const impactOne=deriveImpact(h,amount,c);const priceNet=salePerCraft*(1-marketFee)*(1-impactOne);
  const profit=priceNet-net;
  const roi=profit/gross*100;
  const stressProfit=salePerCraft*(1-marketFee)*(1-impactOne)*.9-net;
  const fameMode=c.goal==='fame';
  // Fama permite rutas a pérdida controlada; silver/equilibrado nunca.
  if((!fameMode&&(!(profit>0)||roi<Number(c.minRoiPct)||(c.stressGuard&&!c.diversify&&stressProfit<0)))
   ||(fameMode&&(roi<-25 || (profit<0&&Number(c.fameLossBudgetPct)===0)))){
    record(h,'margenNegativo',fameMode?'Pérdida por craft supera 25% del capital o límite de pérdida desactivado':'Beneficio / ROI / estrés insuficiente');continue;
  }
  const fame=estimatedFame(h.id,recipe,c.premium);
  const row={id:h.id,city:h.city,routeKey:marketKey(h.id,h.city),evidenceSource:h.evidenceSource||'AODP History Q1',confidence:trafficSignal(h).confidence,craftCity:c.bonusCity?(recipe.city||c.craftFallbackCity):c.craftFallbackCity,
   maxCrafts:upper,craftAmount:amount,history:h,trend:h.trend||'sin referencia',trendRatio:h.trendRatio??null,returnPct:returnRate({...c,recipe}).returnPct,
   grossCapitalPerCraft:gross,expectedCostPerCraft:net,materials:mats.materials,marketQuote:sale.price,planningPrice,historyQuality1Price:histQ1||null,
   saleObservedAt:new Date(sale.time).toISOString(),marketFee,priceImpactPct:impactOne*100,
   estimatedProfitPerCraft:profit,stressProfitPerCraft:stressProfit,expectedFamePerCraft:fame?.value||0,
   fameEstimated:!!fame?.estimated,focusPerCraft:c.focus?Number(c.focusPerCraft):0,qty:0};
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
function previewLine(row,qty,c){
 const units=qty*row.craftAmount,impact=deriveImpact(row.history,units,c);
 const revenue=row.planningPrice*units*(1-Number(c.sellHaircutPct)/100)*(1-row.marketFee)*(1-impact);
 const cost=row.expectedCostPerCraft*qty;
 return {revenue,cost,profit:revenue-cost,stressProfit:revenue*.9-cost,impact:impact*100};
}
/**
 * Allocation rules:
 *  - Never spend over budget or over observed Q1 demand allowance.
 *  - When diversity is on: first sample distinct selected tiers, then enchants, then items.
 *  - Use rounds rather than filling one SKU at a time to avoid market saturation.
 *  - Fame goal alone may lose silver, bounded by both per-route loss (25% of capital)
 *    and total permitted losses (fameLossBudgetPct of the initial budget).
 */
export function allocatePlan({candidates=[],config={},recipes={}}={}){
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
  const q=previewLine(line,line.qty,c);line.finalImpactPct=q.impact;line.totalProfit=q.profit;
  line.stressProfit=q.stressProfit;line.totalRevenue=q.revenue;line.totalCost=q.cost;
  line.unitSaleExpected=q.revenue/(line.qty*line.craftAmount);line.totalFame=line.expectedFamePerCraft*line.qty;
  line.coverageSharePct=(line.qty*line.craftAmount/Math.max(1,Number(line.history.effectiveQuality1DailyUnits??gradeOneDaily(line.history))*Number(c.saleDays)))*100;
  expectedProfit+=line.totalProfit;expectedCost+=line.totalCost;totalFame+=line.totalFame;sales+=line.qty*line.craftAmount;
  for(const m of line.materials){const key=m.id+'|'+m.city+'|'+m.craftCity;const old=purchase.get(key)||{id:m.id,city:m.city,craftCity:m.craftCity,unitPrice:m.price,transportPerUnit:m.transportPerUnit,landedUnitPrice:m.landedUnitPrice,
    savingsVsCraftCity:m.savingsVsCraftCity,riskRoute:m.riskRoute,gross:0,net:0,firstCraft:0};
   old.gross+=m.count*line.qty;old.net+=m.netCount*line.qty;old.firstCraft=Math.max(old.firstCraft,m.count);purchase.set(key,old);
  }
  const journal=journalEstimate(line.id,{value:line.expectedFamePerCraft},line.qty);
  if(journal){const j=journals.get(journal.id)||{...journal,fractional:0};j.fractional+=journal.fractional;journals.set(journal.id,j);}
 }
 const materials=[...purchase.values()].map(m=>{
  const gross=Math.ceil(m.gross),buy=Math.min(gross,Math.max(Math.ceil(m.net-1e-8),Math.ceil(m.firstCraft)));
  return {...m,buy,reuse:Math.max(0,gross-buy),buyWithBuffer:Math.ceil(buy*m.landedUnitPrice*(1+c.buyBufferPct/100))};
 }).sort((a,b)=>b.buy*b.unitPrice-a.buy*a.unitPrice);
 const externalPurchases=materials.filter(m=>m.city!==m.craftCity);
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
   roiOnCapital:totalCapital?expectedProfit/totalCapital*100:0,allowedFameLoss:lossCap,estimatedLosses:selected.reduce((s,r)=>s+Math.max(0,-r.totalProfit),0)},warnings};
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
