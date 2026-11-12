// Reglas compartidas del juego (configuración, retorno, Focus, fama, diarios) y calculadora individual.
// El reparto del plan está en engine-v3.js (Motor 3.0); el motor 2.x se retiró en v3.0.
import {purchaseQuote,freshestQuotes} from './market.js';
import {MARKETS,variant} from './branches.js';
import {trafficSignal,marketKey} from './market-intelligence.js';
import {QUALITY_PROBS_DEFAULT} from './economics.js';
const n=x=>Number.isFinite(Number(x))?Number(x):NaN;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const positive=x=>Number.isFinite(n(x))&&n(x)>0;
const REFINED=/^T([2-8])_(METALBAR|PLANKS|CLOTH|LEATHER|STONEBLOCK)(?:_LEVEL[1-4])?(?:@([1-4]))?$/;
const FAME={2:1.5,3:7.5,4:22.5,5:90,6:270,7:645,8:1395};
export const DEFAULTS=Object.freeze({budget:10_000_000,tiers:[4,5,6,7,8],enchants:[0,1,2,3],saleDays:7,priority:'fast-buy',
 style:'balanced',goal:'balanced',diversify:true,useBudget:false,volume:false,bonusCity:true,dailyBonus:0,
 focus:false,focusPerCraft:0,focusAvailable:0,focusBonus:59,premium:true,trendAnalysis:true,tax:4,listingFee:2.5,
 stationFee:0,maxQuoteHours:48,buyBufferPct:2,sellHaircutPct:0,minRoiPct:5,
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
// Impacto de precio de la Calculadora (venta de un lote frente a la actividad Q1 del horizonte).
export const MARKET_IMPACT=0.75;
export const JOURNAL_CAP_SHARE=0.25;
export function demandUnits(history){return Number(history?.effectiveQuality1DailyUnits??gradeOneDaily(history))||0;}
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
/**
 * Compra mínima para fabricar TODO el lote reutilizando el retorno.
 * Cada craft devuelve recursos que sirven para el siguiente, pero el retorno del último
 * craft ya no se usa: compra = neto + retorno de un craft (el mayor del grupo), nunca más que el bruto.
 * Es seguro en cualquier orden de fabricación. Valores esperados: el retorno real en el juego varía.
 */
export function purchaseNeeded(gross,net,lastReturn){
 return Math.min(Math.ceil(gross-1e-8),Math.ceil(net+lastReturn-1e-8));
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
