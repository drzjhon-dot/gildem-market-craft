// MOTOR 3.0 · Crafteo para ciudades Royal y Mercado Negro.
// Diferencias con el motor 2.x:
//  · Prioridad de compra/venta (como en la sección Refinamiento): orden de venta, orden de compra o instantáneo.
//  · Capacidad de venta según la parte del volumen Q1 que una orden de venta puede captar (por estilo),
//    con caída de precio progresiva en vez de un recorte plano del 9 % y topes fijos de rutas.
//  · El capital es el que realmente sale del bolsillo: neto del retorno + el retorno de un craft.
//  · El encarecimiento de materiales se reparte entre TODAS las rutas que comparten material.
//  · Sin cotización de venta pero con historial Q1, la ruta se valora a precio histórico (con menos confianza).
import {freshestQuotes,purchaseQuote,SAFE_ROYAL_PURCHASE_CITIES,HOUR} from './market.js';
import {variant} from './branches.js';
import {trafficSignal,marketKey,familyKey} from './market-intelligence.js';
import {settings,returnRate,estimatedFame,journalEstimate,focusCostFactor,purchaseNeeded,gradeOneDaily,JOURNAL_CAP_SHARE} from './planner.js';
import {bookEntry,offersAnyQuality,unitsBelow,depthUnits,walkBids} from './orderbook.js';
import {demandSignals} from './demand-signals.js';
import {journalValue,assessPurchases,purchaseSummary} from './economics.js';
import {optimize} from './optimizer.js';

export const ENGINE_V3='Motor 3.0 · beneficio marginal · órdenes de venta · materiales compartidos';
export const PRIORITIES=Object.freeze({
 'fast-buy':{buy:'instant',sell:'order',label:'Compra rápida',hint:'Compras al instante y vendes con orden de venta'},
 silver:{buy:'order',sell:'order',label:'Más silver',hint:'Orden de compra para materiales y orden de venta: más margen, más espera'},
 'fast-sale':{buy:'instant',sell:'instant',label:'Venta rápida',hint:'Compras y vendes al instante a las órdenes existentes'}
});
// Parte del volumen Q1 del horizonte que tus órdenes pueden captar.
export const CAPTURE=Object.freeze({prudent:.20,balanced:.30,dynamic:.45});
// Caída de precio al cubrir el 100 % del volumen del horizonte (orden de venta / venta instantánea).
export const IMPACT=Object.freeze({order:.30,instant:.60});
// Ritmo de venta de una orden de venta en primera posición (fracción del volumen diario).
export const SELL_RATE=.5;
export const BALANCED_FAME_SILVER=.6;
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const positive=x=>Number.isFinite(Number(x))&&Number(x)>0;

export function settingsV3(cfg={}){
 const c=settings({buyBufferPct:2,sellHaircutPct:0,...cfg});
 if(!PRIORITIES[c.priority])c.priority='fast-buy';
 return c;
}
function buyCities(c,craftCity){
 const list=c.purchaseMode==='craft-city'?[craftCity]:[...SAFE_ROYAL_PURCHASE_CITIES,...(c.includeCaerleonPurchases?['Caerleon']:[])];
 if(craftCity==='Caerleon'&&!list.includes('Caerleon'))list.push('Caerleon');
 return [...new Set(list.filter(Boolean))];
}
/** Precio de compra de un material según la prioridad: instantáneo (oferta) u orden de compra (puja + comisión). */
export function materialPrice(quotes,id,craftCity,c,now=Date.now()){
 const instant=purchaseQuote(quotes,id,craftCity,c,now);
 if(PRIORITIES[c.priority]?.buy!=='order')return instant?{...instant,mode:'instant'}:null;
 const fee=1+num(c.listingFee)/100,transport=num(c.inboundTransportPerUnit);let best=null;
 for(const city of buyCities(c,craftCity)){const bid=freshestQuotes(quotes,id,city,'bid',num(c.maxQuoteHours)||48,now)[0];if(!bid)continue;
  const unit=Math.ceil(bid.price+1)*fee,landed=unit+(city===craftCity?0:transport);
  if(!best||landed<best.landedUnitPrice)best={...bid,city,unitPrice:unit,price:unit,transportPerUnit:city===craftCity?0:transport,landedUnitPrice:landed,craftCity,
   riskRoute:(city==='Caerleon'||craftCity==='Caerleon')&&city!==craftCity,mode:'order'};}
 if(best&&(!instant||best.landedUnitPrice<instant.landedUnitPrice))return {...best,savingsVsCraftCity:null,localPrice:instant?.localPrice??null};
 return instant?{...instant,mode:'instant'}:null;
}
function materialsFor(recipe,quotes,c,now,craftCity,focus){
 const rr=returnRate({...c,focus,recipe}).returnPct/100;const list=[],missing=[];
 for(const m of recipe.materials||[]){const count=Number(m.count);if(!m.id||!(count>0)){missing.push(m.id||'?');continue;}
  const q=materialPrice(quotes,m.id,craftCity,c,now);if(!q){missing.push(m.id);continue;}
  const back=m.ret===false?0:Math.min(count*rr,Number.isFinite(Number(m.maxReturn))&&m.maxReturn!==null?Number(m.maxReturn):Infinity);
  list.push({id:m.id,count,returned:back,netCount:count-back,price:q.unitPrice,landedUnitPrice:q.landedUnitPrice,transportPerUnit:q.transportPerUnit,
   city:q.city,craftCity,mode:q.mode,savingsVsCraftCity:q.savingsVsCraftCity??null,riskRoute:q.riskRoute,observedAt:new Date(q.time).toISOString()});}
 return {list,missing,rr};
}
/** Confianza 0,3–1 de que el volumen observado se repita: frecuencia, estabilidad y frescura. */
export function confidenceOf(h,signals,quoteAgeHours){
 let k=trafficSignal(h).confidence||.45;
 if(signals?.spike)k*=.6;else if(signals?.falling)k*=.75;else if(signals?.cv>1)k*=.85;
 if(quoteAgeHours==null)k*=.8;else if(quoteAgeHours>24)k*=.85;
 return Math.max(.3,Math.min(1,k));
}
/** Ingresos brutos (antes de comisiones) por vender u unidades. */
export function saleGross(r,u){
 if(!(u>0))return 0;let rev=0,rest=u;
 if(r.bookBids){const w=walkBids(r.bookBids,u,r.price);rev+=w.revenue;rest=w.remaining;}
 const H=Math.max(1,r.horizonUnits),k=r.impactK;
 // Precio medio con caída lineal: el último lote se vende k·(cuota) por debajo del precio de referencia.
 const share=Math.min(1,rest/H);
 return rev+r.price*rest*(1-k*share/2);
}
export function buildRoutesV3({top=[],recipes={},quotes=new Map(),config={},selectedIds=[],selectedMarkets=[],orderbook=null,qualityBidMap=null,now=Date.now()}={}){
 const c=settingsV3(config),allowed=new Set(selectedIds),markets=new Set(selectedMarkets),routes=[],rejectedSamples=[];
 const rejected={fueraFiltros:0,sinReceta:0,sinHistorial:0,sinPrecioVenta:0,sinPrecioMaterial:0,margenNegativo:0,sinCupo:0,fueraPresupuesto:0};
 const record=(h,code,reason)=>{rejected[code]++;if(rejectedSamples.length<350)rejectedSamples.push({id:h.id,city:h.city,code,reason,q1UnitsDaily:gradeOneDaily(h),allQualitiesDaily:h.averageDailyUnits||0});};
 const pr=PRIORITIES[c.priority],capture=(CAPTURE[c.style]??.3)*(c.volume?1.25:1);
 const tax=num(c.tax)/100,listFee=num(c.listingFee)/100,buffer=1+num(c.buyBufferPct)/100,haircut=1-num(c.sellHaircutPct)/100;
 for(const raw of top){
  if(!markets.has(raw.city)||allowed.size&&!allowed.has(raw.id))continue;
  const v=variant(raw.id);if(!v||!c.tiers.map(Number).includes(v.tier)||!c.enchants.map(Number).includes(v.ench)){record(raw,'fueraFiltros','Tier o encantamiento no seleccionado');continue;}
  const recipe=recipes[raw.id];if(!recipe?.materials?.length){record(raw,'sinReceta','No hay receta verificable');continue;}
  const amount=Number(recipe.amountCrafted||recipe.amount||1);if(!Number.isSafeInteger(amount)||amount<1){record(raw,'sinReceta','Salida por craft sin confirmar');continue;}
  const signals=c.marketSignals===false?null:demandSignals(raw);
  const daily=Math.min(num(raw.effectiveQuality1DailyUnits??gradeOneDaily(raw)),signals?.demandDaily??Infinity);
  if(!(daily>0)){record(raw,'sinHistorial','Sin actividad Q1 en este destino');continue;}
  const h={...raw,demandSignals:signals,effectiveQuality1DailyUnits:daily};
  const bm=h.city==='Black Market',saleMode=bm?'instant':pr.sell;
  // Precio de referencia: cotización actual limitada por el histórico Q1 reciente.
  const quote=freshestQuotes(quotes,h.id,h.city,saleMode==='order'?'ask':'bid',c.maxQuoteHours,now)[0];
  const histBase=num(h.stabilizedQuality1Price??h.quality1AveragePrice),recent=num(signals?.recentPrice);
  const hist=histBase>0&&recent>0?Math.min(histBase,recent):histBase||recent;
  const capPrice=hist>0?hist*(1+num(c.historyPriceCapPct)/100):Infinity;
  let price,priceSource,quoteAge=null;
  if(quote){price=Math.min(quote.price,capPrice);priceSource=quote.price>capPrice?'histórico (cotización inflada)':'cotización actual';quoteAge=(now-quote.time)/HOUR;}
  else if(saleMode==='order'&&hist>0){price=hist*.97;priceSource='histórico Q1 (sin órdenes de venta visibles)';}
  else{record(h,'sinPrecioVenta',saleMode==='order'?'Sin cotización ni historial de precio Q1':'Sin pujas (órdenes de compra) vigentes');continue;}
  const craftCity=c.bonusCity?(recipe.city||c.craftFallbackCity):c.craftFallbackCity;
  const base=materialsFor(recipe,quotes,c,now,craftCity,false);
  if(base.missing.length){record(h,'sinPrecioMaterial',`Faltan precios de recursos: ${base.missing.slice(0,3).join(', ')}`);continue;}
  const focusPoints=positive(recipe.focusPerCraft)?Number(recipe.focusPerCraft)*focusCostFactor(c):positive(c.focusPerCraft)?Number(c.focusPerCraft):0;
  const withFocus=c.focus&&focusPoints>0?materialsFor(recipe,quotes,c,now,craftCity,true):null;
  const fame=estimatedFame(h.id,recipe,c.premium);
  const journal=c.journalProfit===false?null:journalValue({quotes,journal:journalEstimate(h.id,fame,1),craftCity,config:c,now});
  const journalCap=price*amount*JOURNAL_CAP_SHARE,journalGain=journal?.valuePerCraft>0?Math.min(journal.valuePerCraft,journalCap):0;
  const journalCapital=journalGain>0?num(journal.emptyCostPerCraft):0;
  const unitCost=list=>list.reduce((s,m)=>s+m.netCount*m.landedUnitPrice,0)*buffer;
  const grossCost=base.list.reduce((s,m)=>s+m.count*m.landedUnitPrice,0)*buffer;
  const costNo=unitCost(base.list),costF=withFocus&&!withFocus.missing.length?unitCost(withFocus.list):null;
  const fixed=num(c.stationFee)+amount*num(c.deliveryCostPerUnit);
  const fee=saleMode==='order'?tax+listFee:tax;
  const conf=confidenceOf(h,signals,quoteAge);
  const horizonUnits=daily*Number(c.saleDays);
  // Libro de órdenes (si existe): pujas del Mercado Negro y competencia en Royal.
  const book=orderbook?.available?bookEntry(orderbook,h.id,h.city,1,now):null;
  const bookBids=bm&&book?.r?.length?book.r:null;
  let capUnits=horizonUnits*capture*conf,competitionUnits=0;
  if(!bm&&orderbook?.available){const comp=offersAnyQuality(orderbook,h.id,h.city,now);
   if(comp?.length){competitionUnits=unitsBelow(comp,price);if(competitionUnits>0)capUnits=Math.min(capUnits,Math.max(0,horizonUnits-competitionUnits)*capture*conf);}}
  if(bookBids){const breakEven=Math.min(costNo,costF??Infinity)/amount/((1-fee)*haircut);
   capUnits=Math.max(capUnits,depthUnits(bookBids,breakEven)*(c.style==='prudent'?.5:c.style==='dynamic'?1:.8));}
  let maxCrafts=Math.floor(capUnits/amount+1e-9);
  if(maxCrafts<1){
   if(amount<=horizonUnits*.25*conf)maxCrafts=1;
   else{record(h,'sinCupo',`Un craft (${amount} u.) cubriría ${(amount/Math.max(1e-9,horizonUnits)*100).toFixed(0)}% de la actividad Q1 de ${c.saleDays} días${competitionUnits?` (competencia: ${competitionUnits} u. ya publicadas)`:''}`);continue;}
  }
  const route={id:h.id,city:h.city,routeKey:marketKey(h.id,h.city),history:h,demandSignals:signals,trend:h.trend||'sin referencia',trendRatio:h.trendRatio??null,
   craftCity,craftAmount:amount,saleMode,price,priceSource,marketQuote:quote?.price??null,historyQuality1Price:hist||null,saleObservedAt:quote?new Date(quote.time).toISOString():null,
   planningPrice:price,horizonUnits,impactK:IMPACT[saleMode],bookBids,bookDepth:bookBids?depthUnits(bookBids):null,competitionUnits,
   confidence:conf,evidenceSource:h.evidenceSource||'AODP History Q1',returnPct:base.rr*100,returnPctFocus:withFocus?withFocus.rr*100:null,
   materials:base.list,materialsFocus:costF!==null?withFocus.list:null,costNoFocus:costNo,costWithFocus:costF,focusPerCraft:costF!==null?focusPoints:0,
   focusFromGame:positive(recipe.focusPerCraft),grossCapitalPerCraft:grossCost+num(c.stationFee)+journalCapital,expectedCostPerCraft:costNo+fixed-journalGain,
   marketFee:fee,haircut,fixedPerCraft:fixed,journal:journal&&journalGain>0?journal:null,journalMissing:journal&&!(journalGain>0)?journal:null,journalGainPerCraft:journalGain,journalCapital,
   expectedFamePerCraft:fame?.value||0,fameEstimated:!!fame?.estimated,maxCrafts,
   recommendedCrafts:Math.max(0,Math.floor(horizonUnits*CAPTURE.balanced*conf/amount)),
   tier:v.tier,ench:v.ench,family:familyKey(h.id)};
  // Rentabilidad del primer craft (sin deslizamiento): descarta rutas a pérdida desde el principio.
  const first=routeTotals(route,1,costF!==null&&costF<costNo?1:0);
  const profit1=first.revenue-first.cost;
  route.estimatedProfitPerCraft=profit1;route.roiFirstCraft=profit1/Math.max(1,first.cost+first.cushion);
  if(c.goal!=='fame'&&!(profit1>0)){record(h,'margenNegativo',`Pierde ${Math.round(-profit1).toLocaleString('es-ES')} silver por craft al ${priceSource}`);continue;}
  if(c.goal==='fame'&&route.roiFirstCraft<-.25){record(h,'margenNegativo','Pérdida por craft superior al 25 % del capital');continue;}
  routes.push(route);
 }
 return {candidates:routes,rejected,rejectedSamples,config:c};
}
/** Totales de una ruta con q crafts, de ellos fq con Focus (sin el encarecimiento compartido). */
export function routeTotals(r,q,fq=0){
 const units=q*r.craftAmount,gross=saleGross(r,units);
 const revenue=gross*(1-r.marketFee)*r.haircut;
 const mats=(q-fq)*r.costNoFocus+(fq&&r.costWithFocus!=null?fq*r.costWithFocus:0);
 const cost=mats+q*(r.fixedPerCraft-r.journalGainPerCraft+r.journalCapital);
 // Colchón: el retorno del último craft no se reutiliza → hay que comprarlo una vez.
 const cushion=q>0?r.materials.reduce((s,m)=>s+m.returned*m.landedUnitPrice,0):0;
 return {revenue,cost,fame:q*r.expectedFamePerCraft,cushion,gross};
}
export function planV3({candidates=[],config={},materialHistory=[],orderbook=null,now=Date.now()}={}){
 const c=settingsV3(config),warnings=[];
 // Volumen diario de cada material en cada ciudad de compra → encarecimiento por comprar muchos días de mercado.
 const hist=new Map((materialHistory||[]).map(h=>[h.id+'|'+h.city,h]));const ledger=new Map();
 for(const r of candidates)for(const m of [...r.materials,...(r.materialsFocus||[])]){const key=m.id+'|'+m.city;if(ledger.has(key))continue;
  ledger.set(key,{daily:num(hist.get(key)?.averageDailyUnits),price:m.landedUnitPrice});}
 const limits=c.diversify?{tier:c.maxTierSharePct/100,ench:c.maxEnchantSharePct/100,family:c.maxFamilySharePct/100,market:c.maxMarketSharePct/100}:{};
 const routes=candidates.map(r=>{const step=Math.max(1,Math.floor(r.maxCrafts/30));
  const focusSaving=r.costWithFocus!=null?r.costNoFocus-r.costWithFocus:0;
  return {key:r.routeKey,step,max:r.maxCrafts,groups:{tier:'T'+r.tier,ench:'.'+r.ench,family:r.family,market:r.city},
   focusPts:c.focus&&focusSaving>0?r.focusPerCraft:0,focusSavingPerPoint:r.focusPerCraft>0?focusSaving/r.focusPerCraft:0,
   mats:f=>(f&&r.materialsFocus?r.materialsFocus:r.materials).map(m=>({key:m.id+'|'+m.city,units:m.netCount})),
   totals:(q,fq)=>routeTotals(r,q,fq),row:r};});
 const res=optimize({routes,budget:c.budget,ledger,goal:c.goal,fameSilver:BALANCED_FAME_SILVER,
  minMarginalRoi:c.useBudget?0:num(c.minRoiPct)/100,limits,routeCapShare:c.diversify?c.maxCapitalSharePct/100:0,
  focusCap:c.focus?num(c.focusAvailable):0,lossCap:c.goal==='fame'?c.budget*num(c.fameLossBudgetPct)/100:0});
 const rows=[],purchase=new Map(),journals=new Map();let profit=0,cost=0,fame=0,units=0,capital=0;
 for(const ch of res.chosen){const r=ch.route.row,t=routeTotals(r,ch.q,ch.fq),u=ch.q*r.craftAmount;
  const line={...r,qty:ch.q,focusQty:ch.fq,focusSpent:ch.fq*(r.focusPerCraft||0),totalRevenue:t.revenue,totalCost:t.cost+ch.slip,materialSlip:ch.slip,
   totalProfit:t.revenue-t.cost-ch.slip,capital:ch.cap,totalFame:t.fame,unitSaleExpected:t.gross/Math.max(1,u),
   finalImpactPct:(1-t.gross/Math.max(1e-9,r.price*u))*100,stressProfit:t.revenue*.9-t.cost-ch.slip,
   coverageSharePct:u/Math.max(1e-9,r.horizonUnits)*100,
   daysToSell:r.saleMode==='order'?u/Math.max(1e-9,r.history.effectiveQuality1DailyUnits*SELL_RATE*r.confidence):0,
   risky:ch.q>Math.max(1,r.recommendedCrafts)};
  line.grossCapitalPerCraft=r.grossCapitalPerCraft;line.estimatedProfitPerCraft=line.totalProfit/ch.q;
  rows.push(line);profit+=line.totalProfit;cost+=line.totalCost;fame+=t.fame;units+=u;capital+=ch.cap;
  const parts=[[r.materials,ch.q-ch.fq],...(ch.fq&&r.materialsFocus?[[r.materialsFocus,ch.fq]]:[])];
  for(const [list,n] of parts)for(const m of list){if(!(n>0))continue;const key=m.id+'|'+m.city+'|'+m.craftCity;
   const o=purchase.get(key)||{id:m.id,city:m.city,craftCity:m.craftCity,unitPrice:m.price,transportPerUnit:m.transportPerUnit,landedUnitPrice:m.landedUnitPrice,mode:m.mode,
    savingsVsCraftCity:m.savingsVsCraftCity,riskRoute:m.riskRoute,observedAt:m.observedAt,gross:0,net:0,lastReturn:0};
   o.gross+=m.count*n;o.net+=m.netCount*n;o.lastReturn=Math.max(o.lastReturn,m.returned);purchase.set(key,o);}
  const j=journalEstimate(r.id,{value:r.expectedFamePerCraft},ch.q);
  if(j){const x=journals.get(j.id)||{...j,fractional:0};x.fractional+=j.fractional;journals.set(j.id,x);}
 }
 const materials=assessPurchases([...purchase.values()].map(m=>{const gross=Math.ceil(m.gross-1e-8),buy=purchaseNeeded(m.gross,m.net,m.lastReturn);
  return {...m,buy,reuse:Math.max(0,gross-buy),buyWithBuffer:Math.ceil(buy*m.landedUnitPrice*(1+num(c.buyBufferPct)/100))};}).sort((a,b)=>b.buy*b.unitPrice-a.buy*a.unitPrice),materialHistory,now,orderbook);
 const check=purchaseSummary(materials),external=materials.filter(m=>m.city!==m.craftCity);
 if(check.inflated)warnings.push(`${check.inflated} materiales cotizan ≥25 % por encima de su media reciente: revisa antes de comprar.`);
 if(external.length&&!num(c.inboundTransportPerUnit))warnings.push('Compras en otras ciudades: el transporte de materiales está en 0. Añade una estimación si no lo llevas tú.');
 if(external.some(m=>m.riskRoute))warnings.push('Hay compras con traslado hacia o desde Caerleon: riesgo de zona roja no incluido.');
 const risky=rows.filter(r=>r.risky),riskyCapital=risky.reduce((s,r)=>s+r.capital,0);
 const verdict=risky.length&&riskyCapital>capital*.3?'risky':rows.length?'ok':'empty';
 if(verdict==='risky')warnings.push(`Plan arriesgado: ${risky.length} rutas superan la cantidad recomendada (30 % del volumen Q1 del horizonte). Puede tardar más en venderse o bajar el precio.`);
 const allocationNotes=[];for(const r of candidates)if(!rows.some(x=>x.routeKey===r.routeKey))allocationNotes.push({id:r.id,city:r.city,code:'noAsignado',
  reason:res.rejections.get(r.routeKey)||'Viable, pero otras rutas rinden más por silver invertido',q1UnitsDaily:gradeOneDaily(r.history),allQualitiesDaily:r.history.averageDailyUnits||0});
 rows.sort((a,b)=>b.totalProfit-a.totalProfit);
 return {engine:'v3',rows,materials,allocationNotes,scenarioComparisons:[],exposureLimits:limits,verdict,
  journals:[...journals.values()].map(j=>({...j,estimatedQty:Math.ceil(j.fractional-1e-8)})),
  summary:{budget:c.budget,style:c.style,goal:c.goal,priority:c.priority,diversify:c.diversify,useBudget:c.useBudget,allocationMethod:ENGINE_V3,
   capitalReserved:capital,remaining:c.budget-capital,totalProfit:profit,totalCost:cost,totalFame:fame,units,crafts:rows.reduce((s,r)=>s+r.qty,0),
   roiOnCapital:capital?profit/capital*100:0,focusSpent:rows.reduce((s,r)=>s+r.focusSpent,0),focusCrafts:rows.reduce((s,r)=>s+r.focusQty,0),
   royalPurchaseRoutes:external.length,purchaseTransportEstimated:external.reduce((s,m)=>s+m.buy*m.transportPerUnit,0),
   estimatedPurchaseSavings:external.reduce((s,m)=>s+(m.savingsVsCraftCity||0)*m.buy,0),
   materialSlip:rows.reduce((s,r)=>s+r.materialSlip,0),purchaseExtraCost:0,profitAfterPurchases:profit,purchaseHard:check.hard,purchaseLarge:check.large,purchaseInflated:check.inflated,
   journalValue:rows.reduce((s,r)=>s+r.journalGainPerCraft*r.qty,0),qualityExtra:0,riskyRoutes:risky.length,riskyCapital,
   recommendedCapital:rows.reduce((s,r)=>s+r.capital*Math.min(1,Math.max(1,r.recommendedCrafts)/r.qty),0),
   allowedFameLoss:c.goal==='fame'?c.budget*num(c.fameLossBudgetPct)/100:0,estimatedLosses:rows.reduce((s,r)=>s+Math.max(0,-r.totalProfit),0),shareTrim:null},warnings};
}
