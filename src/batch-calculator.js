// Calculadora manual de lotes: operaciones transparentes, sin asumir demanda no observada.
// El plan automático conserva su propio motor. Este módulo no lo modifica.
import {MARKETS,variant} from './branches.js';
import {cheapestMaterial,freshestQuotes} from './market.js';
import {returnRate,estimatedFame,journalEstimate} from './planner.js';
const ROYALS=MARKETS.filter(c=>c!=='Black Market');
const validPrice=value=>Number.isFinite(Number(value))&&Number(value)>0?Number(value):null;
const saleImpact=(history,units,config)=>history?.averageDailyUnits>0
 ?Math.min(.33,units/Math.max(1,history.averageDailyUnits*(Number(config.saleDays)||7))*({prudent:.45,balanced:.75,dynamic:1.1}[config.style]||.75)):0;
export function baseStem(id){return String(id).replace(/^T\d+_/, 'T_').replace(/@\d+$/,'');}
export function variantChoices(ids,id){const stem=baseStem(id);return ids.filter(k=>baseStem(k)===stem&&variant(k));}
export function batchCalculate({items=[],recipes={},quotes=new Map(),history=[],config={},overrides={},now=Date.now()}={}){
 const rows=[],materials=new Map(),pendingMaterials=new Map(),journals=[],warnings=[];
 const buy=overrides.buy||{},sellBM=overrides.sellBM||{},sellRoyal=overrides.sellRoyal||{};
 if(config.focus&&(!(Number(config.focusPerCraft)>0)||!(Number(config.focusAvailable)>0)))throw Error('Focus activado: indica Focus por fabricación y Focus disponible antes de calcular.');
 if(config.focus&&items.reduce((n,item)=>n+Number(item.qty||0),0)*Number(config.focusPerCraft)>Number(config.focusAvailable))throw Error('Focus insuficiente para todas las fabricaciones del lote. Reduce las cantidades o desactiva Focus.');
 let capital=0,cost=0,fame=0,crafts=0,profitBM=0,profitRoyal=0,bmComplete=true,royalComplete=true;
 for(const item of items){
  const {id}=item,recipe=recipes[id],qty=Number(item.qty);
  if(!recipe?.materials?.length){rows.push({id,qty,reason:'Receta no verificada'});bmComplete=false;royalComplete=false;continue;}
  if(!Number.isSafeInteger(qty)||qty<1||qty>100000){rows.push({id,qty,reason:'Cantidad inválida (1 a 100.000)'});bmComplete=false;royalComplete=false;continue;}
  const craftAmount=Number(recipe.amountCrafted||recipe.amount||1);
  if(!Number.isSafeInteger(craftAmount)||craftAmount<1){rows.push({id,qty,reason:'Salida por fabricación sin verificar'});bmComplete=false;royalComplete=false;continue;}
  const rr=returnRate({...config,recipe,bonusCity:config.bonusCity!==false&&!item.noBonus}).returnPct/100;
  const matRows=[],missing=[];let gross=0,net=0;
  for(const m of recipe.materials){const count=Number(m.count),manual=validPrice(buy[m.id]);
   const observed=cheapestMaterial(quotes,m.id,ROYALS,Number(config.maxQuoteHours)||48,now);
   const price=manual||observed?.price,city=manual?'Manual':observed?.city;
   if(!m.id||!(count>0)||!Number.isFinite(count)){missing.push(m.id||'Material inválido');continue;}
   const maxReturn=(m.maxReturn===null||m.maxReturn===undefined)?Infinity:Number(m.maxReturn);
   const returned=m.ret===false?0:Math.min(count*rr,Number.isFinite(maxReturn)?maxReturn:Infinity);
   const effective=count-returned;
   // Preserve unquoted materials for manual pricing. Never treat an unknown price as zero.
   if(!(price>0)){
    missing.push(m.id);
    matRows.push({id:m.id,count,returned,price:null,city:null,observedAt:null,manual:false,netCount:effective,missing:true});
    continue;
   }
   gross+=count*price;net+=effective*price;
   matRows.push({id:m.id,count,returned,price,city,observedAt:manual?null:new Date(observed.time).toISOString(),manual:!!manual,netCount:effective});
  }
  const fameInfo=estimatedFame(id,recipe,config.premium!==false),itemFame=(fameInfo?.value||0)*qty;
  const base={id,qty,craftAmount,units:qty*craftAmount,craftCity:config.bonusCity!==false&&!item.noBonus?recipe.city||'Sin ciudad de especialidad':'Sin bono',returnPct:rr*100,fame:itemFame,fameEstimated:fameInfo?.estimated||false,materials:matRows};
  if(missing.length){
   // The preview ledger helps fill the missing quotes while remaining excluded from investment totals.
   for(const m of matRows){const key=m.id+'|'+(m.city||'Sin cotización');
    const prev=pendingMaterials.get(key)||{id:m.id,city:m.city,unitPrice:m.price,gross:0,net:0,returned:0,manual:m.manual,missing:!m.price,usedBy:[],pending:true};
    prev.gross+=m.count*qty;prev.net+=m.netCount*qty;prev.returned+=m.returned*qty;
    if(!prev.usedBy.includes(id))prev.usedBy.push(id);
    pendingMaterials.set(key,prev);
   }
   rows.push({...base,reason:'Sin precios de materiales: '+missing.slice(0,5).join(', ')});
   bmComplete=false;royalComplete=false;continue;
  }
  const itemCapital=(gross+(Number(config.stationFee)||0))*qty;
  const itemCost=(net+(Number(config.stationFee)||0))*qty;
  base.capital=itemCapital;base.cost=itemCost;
  capital+=itemCapital;cost+=itemCost;crafts+=qty;fame+=itemFame;
  for(const m of matRows){const key=m.id+'|'+m.city;const old=materials.get(key)||{id:m.id,city:m.city,unitPrice:m.price,gross:0,net:0,returned:0,manual:m.manual,usedBy:[]};
   old.gross+=m.count*qty;old.net+=m.netCount*qty;old.returned+=m.returned*qty;if(!old.usedBy.includes(id))old.usedBy.push(id);materials.set(key,old);
  }
  const j=journalEstimate(id,fameInfo,qty);if(j)journals.push({...j,forId:id,estimatedQty:Math.ceil(j.fractional)});
  const feeBM=(Number(config.tax)||0)/100,feeRoyal=(Number(config.tax)+Number(config.listingFee))/100;
  const manualBM=validPrice(sellBM[id]),manualRoyal=validPrice(sellRoyal[id]);
  const observedBM=freshestQuotes(quotes,id,'Black Market','bid',Number(config.maxQuoteHours)||48,now)[0];
  const bm=manualBM?{price:manualBM,time:now,manual:true}:observedBM;
  const bmHist=history.find(h=>h.id===id&&h.city==='Black Market');
  const impactBM=saleImpact(bmHist,base.units,config);
  base.bmPrice=bm?.price??null;base.bmManual=!!manualBM;base.bmObserved=bm&&!manualBM?new Date(bm.time).toISOString():null;
  base.bmHistorical=!!bmHist;base.impactBM=impactBM*100;
  base.profitBM=bm?base.units*bm.price*(1-feeBM)*(1-impactBM)-itemCost:null;
  const royalCandidates=manualRoyal?[{city:'Royal (precio manual)',price:manualRoyal,time:now,manual:true}]:ROYALS.flatMap(city=>freshestQuotes(quotes,id,city,'ask',Number(config.maxQuoteHours)||48,now).map(q=>({city,price:q.price,time:q.time,manual:false})));
  const best=royalCandidates.map(q=>{const h=history.find(x=>x.id===id&&x.city===q.city),impact=saleImpact(h,base.units,config);return {...q,impact,historical:!!h,profit:base.units*q.price*(1-feeRoyal)*(1-impact)-itemCost};}).sort((a,b)=>b.profit-a.profit)[0];
  base.royalCity=best?.city||null;base.royalPrice=best?.price??null;base.royalManual=!!best?.manual;base.royalObserved=best&&!best.manual?new Date(best.time).toISOString():null;
  base.royalHistorical=!!best?.historical;base.impactRoyal=(best?.impact||0)*100;base.profitRoyal=best?.profit??null;
  if(base.profitBM===null)bmComplete=false;else profitBM+=base.profitBM;
  if(base.profitRoyal===null)royalComplete=false;else profitRoyal+=base.profitRoyal;
  rows.push(base);
 }
 const grouped=[...materials.values()].map(m=>({...m,buy:Math.ceil(Math.max(0,m.net)),total:Math.ceil(Math.max(0,m.net))*m.unitPrice})).sort((a,b)=>a.id.localeCompare(b.id));
 const pending=[...pendingMaterials.values()].map(m=>({...m,buy:Math.ceil(Math.max(0,m.net)),total:null})).sort((a,b)=>a.id.localeCompare(b.id));
 const hasMissing=rows.some(r=>r.reason);
 if(hasMissing)warnings.push('Algunos artículos no tienen materiales o recetas verificadas; no se incluyen en los totales.');
 if(rows.some(r=>r.capital&&!r.bmHistorical&&!r.royalHistorical))warnings.push('Sin historial en el destino de algunos artículos: no se estima impacto de precio para esas ventas.');
 return {rows,materials:[...grouped,...pending],journals,warnings,totals:{capital,cost,fame,crafts,units:rows.filter(r=>!r.reason).reduce((n,r)=>n+r.units,0),profitBM:bmComplete&&!hasMissing?profitBM:null,profitRoyal:royalComplete&&!hasMissing?profitRoyal:null,buyCapital:grouped.reduce((n,m)=>n+m.total,0),incomplete:rows.filter(r=>r.reason).length}};
}
