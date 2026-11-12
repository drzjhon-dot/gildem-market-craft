// MOTOR NUEVO v1 · Simulación pura a partir de historial + precios observados.
// Nunca fabrica recetas ni demanda, ni llena presupuesto mediante pérdidas esperadas.
import {cheapestMaterial,freshestQuotes} from './market.js';
import {MARKETS,variant} from './branches.js';
const n=x=>Number.isFinite(Number(x))?Number(x):NaN;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const positive=x=>Number.isFinite(n(x))&&n(x)>0;
const REFINED=/^T([2-8])_(METALBAR|PLANKS|CLOTH|LEATHER|STONEBLOCK)(?:_LEVEL[1-4])?(?:@([1-4]))?$/;
const FAME={2:1.5,3:7.5,4:22.5,5:90,6:270,7:645,8:1395};
export const DEFAULTS=Object.freeze({budget:10_000_000,tiers:[4,5,6,7,8],enchants:[0,1,2,3],saleDays:7,
 style:'balanced',goal:'balanced',diversify:false,useBudget:false,volume:false,bonusCity:true,dailyBonus:0,
 focus:false,focusPerCraft:0,focusAvailable:0,focusBonus:59,premium:true,tax:4,listingFee:2.5,
 stationFee:0,maxQuoteHours:48});
export function settings(cfg={}){const c={...DEFAULTS,...cfg};
 if(!Number.isSafeInteger(n(c.budget))||n(c.budget)<1000||n(c.budget)>1e12)throw Error('Presupuesto: entero entre 1.000 y un billón de silver.');
 if(!Array.isArray(c.tiers)||!c.tiers.length||c.tiers.some(x=>![4,5,6,7,8].includes(Number(x))))throw Error('Selecciona al menos un Tier válido.');
 if(!Array.isArray(c.enchants)||!c.enchants.length||c.enchants.some(x=>![0,1,2,3,4].includes(Number(x))))throw Error('Selecciona al menos un encantamiento válido.');
 if(![0,10,20].includes(Number(c.dailyBonus)))throw Error('Bono diario: 0%, 10% o 20%.');
 if(!['prudent','balanced','dynamic'].includes(c.style)||!['silver','balanced','fame'].includes(c.goal))throw Error('Estilo u objetivo inválido.');
 if(![1,3,7,14,30].includes(Number(c.saleDays)))throw Error('Horizonte de venta no válido.');
 if(![c.tax,c.listingFee,c.stationFee,c.maxQuoteHours].every(x=>Number.isFinite(n(x))&&n(x)>=0))throw Error('Comisiones y costes inválidos.');
 if(c.tax>30||c.listingFee>30||c.maxQuoteHours>168||c.maxQuoteHours<1)throw Error('Límites de comisiones o vigencia inválidos.');
 if(c.focus&&(!positive(c.focusPerCraft)||!positive(c.focusAvailable)||!Number.isFinite(n(c.focusBonus))||n(c.focusBonus)<0))throw Error('Para activar Focus necesitas verificar consumo por craft, Focus disponible y bono de producción en la configuración.');
 return c;
}
export function returnRate({bonusCity=true,recipe={},dailyBonus=0,focus=false,focusBonus=59}={}){
 const daily=recipe.dailyEnabled===false?0:Number(dailyBonus)||0;
 const bonus=18+(bonusCity&&recipe.city&&recipe.specialtyEnabled!==false?15:0)+daily+(focus?Number(focusBonus):0);
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
function observationCheck(history,config){
 if(!history||!(history.averageDailyUnits>0)||!(history.activeDays>=1))return false;
 return config.diversify||config.style==='dynamic'||history.activeDays>=Math.min(2,history.days);
}
function maxCraftByDemand(history,amount,config){
 const fraction={prudent:.06,balanced:.13,dynamic:.22}[config.style];
 const volumeFraction=config.volume?Math.min(.30,fraction*1.35):fraction;
 const units=history.averageDailyUnits*Number(config.saleDays)*volumeFraction;
 // With explicit diversity allow 1 craft where *some* history exists, not absent history.
 const minimum=config.diversify&&history.averageDailyUnits>0?1:0;
 return Math.min(250,Math.max(minimum,Math.floor(units/amount)));
}
function deriveImpact(history,units,config){
 const share=units/Math.max(1,history.averageDailyUnits*Number(config.saleDays));
 return clamp(share*({prudent:.45,balanced:.75,dynamic:1.1}[config.style]),0,.33);
}
function realMaterials(recipe,quotes,config,now){
 let gross=0,net=0,missing=[],materials=[];
 const rr=returnRate({...config,recipe}).returnPct/100;
 for(const m of recipe.materials||[]){const count=Number(m.count);if(!m.id||!(count>0)||!Number.isFinite(count)){missing.push(m.id||'Material inválido');continue;}
  const quote=cheapestMaterial(quotes,m.id,MARKETS.filter(c=>c!=='Black Market'),config.maxQuoteHours,now);
  if(!quote){missing.push(m.id);continue;}
  const back=m.ret===false?0:Math.min(count*rr,Number.isFinite(Number(m.maxReturn))&&m.maxReturn!==null?Number(m.maxReturn):Infinity);
  gross+=count*quote.price;net+=(count-back)*quote.price;
  materials.push({id:m.id,count,returned:back,netCount:count-back,price:quote.price,city:quote.city,observedAt:new Date(quote.time).toISOString()});
 }
 return {gross,net,missing,materials};
}
export function buildCandidates({top=[],recipes={},quotes=new Map(),config={},selectedIds=[],selectedMarkets=[],now=Date.now()}={}){
 const c=settings(config),allowed=new Set(selectedIds),markets=new Set(selectedMarkets),candidates=[],rejected={
  fueraFiltros:0,sinReceta:0,sinHistorial:0,sinPrecioVenta:0,sinPrecioMaterial:0,margenNegativo:0,sinCupo:0,fueraPresupuesto:0};
 // One statistical row per item+city; history groups qualities 1–5, sale quote quality 1 only.
 for(const h of top){if(!markets.has(h.city)||allowed.size&&!allowed.has(h.id))continue;
  const variantInfo=variant(h.id);if(!variantInfo||!c.tiers.map(Number).includes(variantInfo.tier)||!c.enchants.map(Number).includes(variantInfo.ench)){rejected.fueraFiltros++;continue;}
  const recipe=recipes[h.id];if(!recipe||!Array.isArray(recipe.materials)||!recipe.materials.length){rejected.sinReceta++;continue;}
  if(!observationCheck(h,c)){rejected.sinHistorial++;continue;}
  const mode=h.city==='Black Market'?'bid':'ask';const sale=freshestQuotes(quotes,h.id,h.city,mode,c.maxQuoteHours,now)[0];
  if(!sale){rejected.sinPrecioVenta++;continue;}
  const mats=realMaterials(recipe,quotes,c,now);if(mats.missing.length){rejected.sinPrecioMaterial++;continue;}
  const amount=Number(recipe.amountCrafted||recipe.amount||1);if(!Number.isSafeInteger(amount)||amount<1){rejected.sinReceta++;continue;}
  const gross=mats.gross+Number(c.stationFee),net=mats.net+Number(c.stationFee);
  if(!(gross>0)||gross>c.budget){rejected.fueraPresupuesto++;continue;}
  const upper=maxCraftByDemand(h,amount,c);if(upper<1){rejected.sinCupo++;continue;}
  const marketFee=(Number(c.tax)+ (h.city==='Black Market'?0:Number(c.listingFee)))/100;
  const salePerCraft=sale.price*amount;
  const impactOne=deriveImpact(h,amount,c);const priceNet=salePerCraft*(1-marketFee)*(1-impactOne);
  const profit=priceNet-net;
  if(!(profit>0)){rejected.margenNegativo++;continue;}
  const stressProfit=salePerCraft*(1-marketFee)*(1-impactOne)*.9-net;
  const fame=estimatedFame(h.id,recipe,c.premium);
  const row={id:h.id,city:h.city,craftCity:c.bonusCity?(recipe.city||'Sin especialidad'):'Sin bono de ciudad',
   maxCrafts:upper,craftAmount:amount,history:h,returnPct:returnRate({...c,recipe}).returnPct,
   grossCapitalPerCraft:gross,expectedCostPerCraft:net,materials:mats.materials,marketQuote:sale.price,
   saleObservedAt:new Date(sale.time).toISOString(),marketFee,priceImpactPct:impactOne*100,
   estimatedProfitPerCraft:profit,stressProfitPerCraft:stressProfit,expectedFamePerCraft:fame?.value||0,
   fameEstimated:!!fame?.estimated,focusPerCraft:c.focus?Number(c.focusPerCraft):0,qty:0};
  candidates.push(row);
 }
 return {candidates,rejected,config:c};
}
function score(r,c){const roi=r.estimatedProfitPerCraft/Math.max(1,r.grossCapitalPerCraft),silver=r.estimatedProfitPerCraft;
 const fame=r.expectedFamePerCraft/Math.max(1,r.grossCapitalPerCraft);
 const historicalStrength=Math.min(1,.55+(.45*r.history.activeDays/Math.max(1,r.history.days)));
 const diversityWeight=c.diversify?1:0;
 if(c.goal==='fame')return (roi*2+Math.log1p(Math.max(0,fame))*0.12+Math.log1p(silver)/100)*historicalStrength+diversityWeight*.001;
 if(c.goal==='silver')return (roi*3+Math.log1p(silver)/75+fame*.002)*historicalStrength;
 return (roi*3+Math.log1p(silver)/110+Math.log1p(Math.max(0,fame))*.08)*historicalStrength;
}
export function allocatePlan({candidates=[],config={},recipes={}}={}){
 const c=settings(config),remainingById=new Map(),warnings=[];
 // A crafted ID cannot be allocated simultaneously in multiple destinations: unique best route.
 for(const row of candidates){const prior=remainingById.get(row.id);if(!prior||score(row,c)>score(prior,c))remainingById.set(row.id,{...row,qty:0});}
 const routes=[...remainingById.values()].sort((a,b)=>score(b,c)-score(a,c)||b.estimatedProfitPerCraft-a.estimatedProfitPerCraft);
 let available=c.budget,focusRemaining=c.focus?Number(c.focusAvailable):Infinity;
 const picked=new Map();
 function add(row,limit){let nCan=Math.min(row.maxCrafts-row.qty,Math.floor((available+1e-6)/row.grossCapitalPerCraft),
  c.focus?Math.floor(focusRemaining/row.focusPerCraft):Infinity,limit);
  nCan=Math.max(0,Math.floor(nCan));if(!nCan)return 0;
  row.qty+=nCan;available-=nCan*row.grossCapitalPerCraft;focusRemaining-=nCan*row.focusPerCraft;picked.set(row.id,row);return nCan;
 }
 if(c.diversify){for(const tier of [6,7,8]){if(!c.tiers.map(Number).includes(tier))continue;
  const choices=routes.filter(r=>Number(r.id.match(/^T(\d)/)?.[1])===tier&&r.qty<1);
  if(choices.length&&!choices.some(r=>add(r,1)))warnings.push(`No hay presupuesto/Focus para reservar al menos un craft T${tier} viable.`);
  if(!choices.length)warnings.push(`T${tier}: ninguna receta con historial, cotización y margen esperado positivo. No se fuerza.`);
 }}
 // Batches moderate, broad allocation; no phantom opportunities to justify a target budget.
 const maxLines=c.volume?32:22;
 for(const route of routes){if(picked.size>=maxLines&&!picked.has(route.id))continue;
  const max=c.useBudget?Infinity:Math.max(1,Math.ceil(route.maxCrafts*(c.style==='prudent'?.55:.75)));
  add(route,max);
 }
 const selected=[...picked.values()].sort((a,b)=>b.qty*b.estimatedProfitPerCraft-a.qty*a.estimatedProfitPerCraft);
 const purchase=new Map();const journals=new Map();let expectedProfit=0,expectedCost=0,totalFame=0,sales=0;
 for(const line of selected){const qty=line.qty,units=line.craftAmount*qty,h=line.history;
  const impact=deriveImpact(h,units,c);const grossRevenue=line.marketQuote*units*(1-line.marketFee)*(1-impact);
  const netMaterialCost=line.expectedCostPerCraft*qty;
  line.finalImpactPct=impact*100;
  line.totalProfit=grossRevenue-netMaterialCost;
  line.stressProfit=grossRevenue*.9-netMaterialCost;
  line.totalRevenue=grossRevenue;line.totalCost=netMaterialCost;line.unitSaleExpected=grossRevenue/units;
  line.totalFame=line.expectedFamePerCraft*qty;
  // IMPORTANT: quantity-dependent impact can turn initially positive route negative.
  // Reducing the batch is better than returning a loss-making recommendation.
  while(line.qty>0&&line.totalProfit<=0){line.qty--;const q=line.qty,u=line.craftAmount*q,i=deriveImpact(h,u,c);
   line.finalImpactPct=i*100;line.totalRevenue=line.marketQuote*u*(1-line.marketFee)*(1-i);line.totalCost=line.expectedCostPerCraft*q;
   line.totalProfit=line.totalRevenue-line.totalCost;line.stressProfit=line.totalRevenue*.9-line.totalCost;line.totalFame=line.expectedFamePerCraft*q;
  }
  // refund allocated reserve for trimmed units
  if(line.qty<qty){available+=(qty-line.qty)*line.grossCapitalPerCraft;focusRemaining+=(qty-line.qty)*line.focusPerCraft;}
  if(line.qty===0)continue;
  expectedProfit+=line.totalProfit;expectedCost+=line.totalCost;totalFame+=line.totalFame;sales+=line.qty*line.craftAmount;
  for(const m of line.materials){const key=m.id+'|'+m.city;const old=purchase.get(key)||{id:m.id,city:m.city,unitPrice:m.price,gross:0,net:0,firstCraft:0};
   old.gross+=m.count*line.qty;old.net+=m.netCount*line.qty;old.firstCraft=Math.max(old.firstCraft,m.count);purchase.set(key,old);
  }
  const journal=journalEstimate(line.id,{value:line.expectedFamePerCraft},line.qty);
  if(journal){const j=journals.get(journal.id)||{...journal,fractional:0};j.fractional+=journal.fractional;journals.set(journal.id,j);}
 }
 const rows=selected.filter(x=>x.qty>0);
 const materials=[...purchase.values()].map(m=>{
  const gross=Math.ceil(m.gross),buy=Math.min(gross,Math.max(Math.ceil(m.net-1e-8),Math.ceil(m.firstCraft)));
  return {...m,buy,reuse:Math.max(0,gross-buy)};
 }).sort((a,b)=>b.buy*b.unitPrice-a.buy*a.unitPrice);
 const totalCapital=c.budget-available;
 if(totalCapital>c.budget+0.001)throw Error('Error de asignación: presupuesto excedido.');
 if(rows.some(r=>r.totalProfit<=0))throw Error('Error de asignación: ruta con pérdidas.');
 return {rows,materials,journals:[...journals.values()].map(j=>({...j,estimatedQty:Math.ceil(j.fractional-1e-8)})),
  summary:{budget:c.budget,capitalReserved:totalCapital,remaining:available,totalProfit:expectedProfit,totalCost:expectedCost,
   totalFame,units:sales,crafts:rows.reduce((s,x)=>s+x.qty,0),focusSpent:c.focus?c.focusAvailable-focusRemaining:0,
   roiOnCapital:totalCapital?expectedProfit/totalCapital*100:0},warnings};
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
